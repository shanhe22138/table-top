import { useEffect, useMemo, useRef, useState } from 'react'
import { useDB, useSettings } from '../store/db'
import { useAuth } from '../store/auth'
import { href, navigate } from '../lib/router'
import { Icon } from '../components/Icons'
import { Button, Chip, EmptyState, Segmented, Sheet } from '../components/ui'
import { EventCard, EventRowMini } from '../components/cards'
import { CoverArt } from '../components/CoverArt'
import {
  WEEK_HEADERS,
  dateKeyOf,
  formatDateFull,
  formatTime,
  isSameDay,
  monthGrid,
  monthLabel,
  relativeDay,
  startOfWeek,
  toDateKey,
  weekDays,
  weekLabel,
} from '../lib/format'
import { GAME_KINDS, KIND_LABEL, playOption, type GameEvent, type GameKind } from '../types'
import Link from '../components/Link'
import { IS_BROWSER, isSmallScreen } from '../lib/platform'

type View = 'month' | 'week' | 'list' | 'cards'

/** 默认落在「有车的那个月」：本月够热闹就停在本月，否则跳到最近一车所在的月 */
function pickInitial(events: GameEvent[], dateKey: string | null) {
  if (dateKey) {
    const fixed = new Date(`${dateKey}T00:00:00`)
    if (!Number.isNaN(fixed.getTime())) {
      return { cursor: { year: fixed.getFullYear(), month: fixed.getMonth() }, key: dateKey }
    }
  }
  const now = new Date()
  const upcoming = events
    .filter(
      (e) => e.status !== 'cancelled' && new Date(e.startAt).getTime() >= now.getTime() - 3600000,
    )
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
  const thisMonth = upcoming.filter((e) => {
    const d = new Date(e.startAt)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })
  if (thisMonth.length >= 2 || !upcoming.length) {
    return { cursor: { year: now.getFullYear(), month: now.getMonth() }, key: toDateKey(now) }
  }
  const first = new Date(upcoming[0].startAt)
  return {
    cursor: { year: first.getFullYear(), month: first.getMonth() },
    key: toDateKey(first),
  }
}

export default function CalendarPage({ initialDate = null }: { initialDate?: string | null }) {
  const db = useDB()
  const settings = useSettings()
  const { user } = useAuth()
  const today = new Date()
  const initRef = useRef(pickInitial(db.events, initialDate))

  // 窄屏默认用列表，时刻格子在手机上太挤
  const [view, setView] = useState<View>(() => isSmallScreen() ? 'list' : 'month')
  const [cursor, setCursor] = useState(initRef.current.cursor)
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(`${initRef.current.key}T00:00:00`)),
  )
  const [selectedKey, setSelectedKey] = useState(initRef.current.key)
  const [kind, setKind] = useState<'all' | GameKind>('all')
  const [place, setPlace] = useState<string | null>(null)
  const [prefOnly, setPrefOnly] = useState(false)
  const [hideEmptyDays, setHideEmptyDays] = useState(false)

  // 翻页动效：每次切月/周都重新播放一次滑入动画
  const [flip, setFlip] = useState(0)
  const [dir, setDir] = useState<'next' | 'prev'>('next')
  // 拖拽翻页时锁住文本选中，避免误选上方标题
  const [dragging, setDragging] = useState(false)
  // 拖动时时刻跟随鼠标的横向位移（px），松手后吸附归零
  const [dragX, setDragX] = useState(0)

  const prefs = user?.prefs
  const locations = settings.locations

  const gameById = useMemo(() => new Map(db.games.map((g) => [g.id, g])), [db.games])

  const filtered = useMemo(() => {
    return db.events.filter((e) => {
      if (e.status === 'cancelled') return false
      if (kind !== 'all' && e.kind !== kind) return false
      if (place && e.city !== place) return false
      if (prefOnly && prefs) {
        if (prefs.plays.length) {
          const game = e.gameId ? gameById.get(e.gameId) : null
          const hit = prefs.plays.some((k) => {
            const opt = playOption(k)
            if (!opt || opt.kind !== e.kind) return false
            if (!opt.tag) return true
            return game ? game.tags.includes(opt.tag) : false
          })
          if (!hit) return false
        }
        if (prefs.locations.length && !prefs.locations.includes(e.city)) return false
        if (prefs.durationRange) {
          const [lo, hi] = prefs.durationRange
          if (e.durationMin < lo || e.durationMin > hi) return false
        }
      }
      return true
    })
  }, [db.events, kind, place, prefOnly, prefs, gameById])

  const byDate = useMemo(() => {
    const map = new Map<string, GameEvent[]>()
    for (const e of filtered) {
      const k = dateKeyOf(e.startAt)
      const arr = map.get(k) ?? []
      arr.push(e)
      map.set(k, arr)
    }
    for (const arr of map.values()) arr.sort((a, b) => a.startAt.localeCompare(b.startAt))
    return map
  }, [filtered])

  const grid = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor])
  const week = useMemo(() => weekDays(weekStart), [weekStart])

  const monthCount = useMemo(
    () =>
      filtered.filter((e) => {
        const d = new Date(e.startAt)
        return d.getFullYear() === cursor.year && d.getMonth() === cursor.month
      }).length,
    [filtered, cursor],
  )

  const selectedEvents = byDate.get(selectedKey) ?? []

  const [daySheetKey, setDaySheetKey] = useState<string | null>(null)
  const daySheetEvents = daySheetKey ? byDate.get(daySheetKey) ?? [] : []

  // 从 ?d= 进来时定位到那天
  const handledDate = useRef<string | null>(null)
  useEffect(() => {
    if (!initialDate || handledDate.current === initialDate) return
    const fixed = new Date(`${initialDate}T00:00:00`)
    if (Number.isNaN(fixed.getTime())) return
    const evs = byDate.get(initialDate)
    if (!evs?.length) return
    handledDate.current = initialDate
    setCursor({ year: fixed.getFullYear(), month: fixed.getMonth() })
    setWeekStart(startOfWeek(fixed))
    setSelectedKey(initialDate)
    if (evs.length > 3 && isSmallScreen()) {
      setDaySheetKey(initialDate)
    }
  }, [initialDate, byDate])

  function handleDayPick(key: string, events: GameEvent[]) {
    setSelectedKey(key)
    if (events.length && isSmallScreen()) {
      setDaySheetKey(key)
    }
  }

  const upcoming = useMemo(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    return filtered
      .filter((e) => new Date(e.startAt).getTime() >= start.getTime())
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
  }, [filtered])

  const upcomingGroups = useMemo(() => {
    const groups: Array<{ key: string; events: GameEvent[] }> = []
    for (const e of upcoming) {
      const k = dateKeyOf(e.startAt)
      const last = groups[groups.length - 1]
      if (last && last.key === k) last.events.push(e)
      else groups.push({ key: k, events: [e] })
    }
    return groups
  }, [upcoming])

  /* ── 翻页 ── */

  function shiftMonth(delta: number) {
    const d = new Date(cursor.year, cursor.month + delta, 1)
    setCursor({ year: d.getFullYear(), month: d.getMonth() })
    setSelectedKey(toDateKey(d))
  }

  function shiftWeek(delta: number) {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + delta * 7)
    setWeekStart(d)
    setSelectedKey(toDateKey(d))
  }

  function shift(delta: number) {
    setDir(delta > 0 ? 'next' : 'prev')
    setFlip((f) => f + 1)
    if (view === 'week') shiftWeek(delta)
    else shiftMonth(delta)
  }

  function goToday() {
    setFlip((f) => f + 1)
    setCursor({ year: today.getFullYear(), month: today.getMonth() })
    setWeekStart(startOfWeek(today))
    setSelectedKey(toDateKey(today))
  }

  /* ── 触摸滑动（跟手） ── */

  const touch = useRef<{ x: number; y: number; t: number } | null>(null)
  const swipeHandlers = {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0]
      touch.current = { x: t.clientX, y: t.clientY, t: Date.now() }
      setDragging(true)
    },
    onTouchMove: (e: React.TouchEvent) => {
      const s = touch.current
      if (!s) return
      const t = e.touches[0]
      const dx = t.clientX - s.x
      const dy = t.clientY - s.y
      // 横向意图明确才跟手，避免影响纵向滚动
      if (Math.abs(dx) > Math.abs(dy)) setDragX(dx)
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = touch.current
      touch.current = null
      setDragging(false)
      if (!s) {
        setDragX(0)
        return
      }
      const t = e.changedTouches[0]
      const dx = t.clientX - s.x
      const dy = t.clientY - s.y
      const fastEnough = Date.now() - s.t < 900
      const horizontal = Math.abs(dx) >= 56 && Math.abs(dx) >= Math.abs(dy) * 1.5
      setDragX(0)
      if (fastEnough && horizontal) shift(dx < 0 ? 1 : -1)
    },
  }

  /* ── 鼠标拖拽（跟手，松手吸附到最近月/周） ── */

  const dragRef = useRef<{ x: number } | null>(null)
  const draggedRef = useRef(false)
  const mouseHandlers = {
    onMouseDown: (e: React.MouseEvent) => {
      if (e.button !== 0) return
      dragRef.current = { x: e.clientX }
      setDragging(true)
      // 拖动期间禁止整页选中，避免选中时刻上方的标题文字
      if (IS_BROWSER) document.body.style.userSelect = 'none'
    },
    onMouseMove: (e: React.MouseEvent) => {
      if (!dragRef.current) return
      setDragX(e.clientX - dragRef.current.x)
    },
    onMouseUp: (e: React.MouseEvent) => {
      const start = dragRef.current
      dragRef.current = null
      setDragging(false)
      if (IS_BROWSER) document.body.style.userSelect = ''
      if (!start) {
        setDragX(0)
        return
      }
      const dx = e.clientX - start.x
      // 位移超过阈值就翻页；否则回弹到当前月/周
      if (Math.abs(dx) >= 70) {
        draggedRef.current = true
        setTimeout(() => {
          draggedRef.current = false
        }, 0)
        setDragX(0)
        shift(dx < 0 ? 1 : -1)
      } else {
        setDragX(0)
      }
    },
    onMouseLeave: () => {
      if (IS_BROWSER) document.body.style.userSelect = ''
      if (dragRef.current) {
        dragRef.current = null
        setDragging(false)
        setDragX(0)
      }
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (!draggedRef.current) return
      e.preventDefault()
      e.stopPropagation()
    },
  }

  const periodLabel = view === 'week' ? weekLabel(weekStart) : monthLabel(cursor.year, cursor.month)

  return (
    <div className="anim-rise">
      {/* 标题区 */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] leading-tight tracking-wide text-paper">
            最近有什么车
          </h1>
          <p className="mt-1 text-[12.5px] text-faint">
            {view === 'week'
              ? `${periodLabel} · ${week.reduce((n, d) => n + (byDate.get(toDateKey(d))?.length ?? 0), 0)} 车`
              : view === 'month'
                ? `${monthLabel(cursor.year, cursor.month)} 共 ${monthCount} 车 · 左右滑动切月`
                : `${upcoming.length} 场待开`}
          </p>
        </div>
        <Segmented
          value={view}
          onChange={(v) => {
            setView(v)
            if (v === 'week') setWeekStart(startOfWeek(new Date(`${selectedKey}T00:00:00`)))
          }}
          options={[
            { value: 'month', label: '月', icon: 'calendar' },
            { value: 'week', label: '周', icon: 'clock' },
            { value: 'list', label: '列表', icon: 'list' },
            { value: 'cards', label: '卡片', icon: 'grid' },
          ]}
        />
      </div>

      {/* 筛选 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Chip
          active={kind === 'all' && !place && !prefOnly}
          onClick={() => {
            setKind('all')
            setPlace(null)
            setPrefOnly(false)
          }}
        >
          全部
        </Chip>
        {GAME_KINDS.map((k) => (
          <Chip key={k} active={kind === k} onClick={() => setKind(kind === k ? 'all' : k)}>
            {KIND_LABEL[k]}
          </Chip>
        ))}
        <span className="mx-1 w-px shrink-0 self-stretch bg-line" />
        {locations.map((c) => (
          <Chip key={c} active={place === c} onClick={() => setPlace(place === c ? null : c)}>
            {c}
          </Chip>
        ))}
        {user && (
          <>
            <span className="mx-1 w-px shrink-0 self-stretch bg-line" />
            <Chip active={prefOnly} onClick={() => setPrefOnly(!prefOnly)}>
              <span className="inline-flex items-center gap-1">
                <Icon name="sparkle" size={12} />
                按我的偏好
              </span>
            </Chip>
          </>
        )}
      </div>

      {view === 'list' ? (
        <ListView groups={upcomingGroups} />
      ) : view === 'cards' ? (
        <CardGrid events={upcoming} />
      ) : (
        <>
          {/* 翻页头 */}
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                onClick={() => shift(-1)}
                className="rounded-lg p-1.5 text-muted hover:bg-surface2 hover:text-paper"
                aria-label={view === 'week' ? '上一周' : '上个月'}
              >
                <Icon name="left" size={18} />
              </button>
              <span className="min-w-[7.5rem] text-center font-display text-[15px] text-paper">
                {periodLabel}
              </span>
              <button
                onClick={() => shift(1)}
                className="rounded-lg p-1.5 text-muted hover:bg-surface2 hover:text-paper"
                aria-label={view === 'week' ? '下一周' : '下个月'}
              >
                <Icon name="right" size={18} />
              </button>
            </div>
            <div className="flex items-center gap-1">
              {view === 'week' && (
                <button
                  onClick={() => setHideEmptyDays((v) => !v)}
                  className={`rounded-full border px-2.5 py-1 text-[11.5px] transition-colors ${
                    hideEmptyDays
                      ? 'border-brass/60 bg-brass/15 text-brass'
                      : 'border-line text-faint hover:text-paper'
                  }`}
                >
                  只看有车的日子
                </button>
              )}
              {view === 'week' && (
                <Button variant="ghost" size="sm" onClick={() => setView('month')}>
                  看整月
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={goToday}>
                回到今天
              </Button>
            </div>
          </div>

          {view === 'month' ? (
            <div
              className={`touch-pan-y overflow-hidden rounded-2xl border border-line bg-surface/60 ${dragging ? 'select-none' : ''}`}
              {...swipeHandlers}
              {...mouseHandlers}
              data-swipe="month"
            >
              <div
                style={{
                  transform: `translateX(${dragX}px)`,
                  transition: dragging ? 'none' : 'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
              <div key={flip} className={dir === 'next' ? 'anim-slide-next' : 'anim-slide-prev'}>
              <div className="grid grid-cols-7 border-b border-line bg-surface2/40">
                {WEEK_HEADERS.map((w) => (
                  <div key={w} className="py-2 text-center text-[11px] text-faint">
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {grid.map((d, i) => {
                  const key = toDateKey(d)
                  const inMonth = d.getMonth() === cursor.month
                  const isToday = isSameDay(d, today)
                  const isSelected = key === selectedKey
                  const events = byDate.get(key) ?? []
                  return (
                    <div
                      key={i}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleDayPick(key, events)}
                      onKeyDown={(ev) => {
                        if (ev.key === 'Enter' || ev.key === ' ') {
                          ev.preventDefault()
                          handleDayPick(key, events)
                        }
                      }}
                      className={`relative flex h-[54px] cursor-pointer flex-col items-center gap-0.5 border-b border-r border-line/60 px-0.5 pt-1 transition-colors sm:h-24 sm:items-stretch sm:px-1.5 ${
                        isSelected ? 'bg-brass/10 ring-1 ring-inset ring-brass/40' : 'hover:bg-surface2/60'
                      } ${(i + 1) % 7 === 0 ? 'border-r-0' : ''}`}
                    >
                      <div className="flex items-center justify-center sm:justify-between">
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full font-display text-[12.5px] tabular-nums ${
                            isToday
                              ? 'bg-brass font-semibold text-[#1a1206]'
                              : inMonth
                                ? isSelected
                                  ? 'text-brass'
                                  : 'text-paper'
                                : 'text-faint/50'
                          }`}
                        >
                          {d.getDate()}
                        </span>
                        {events.length > 0 && (
                          <span className="hidden text-[10px] tabular-nums text-faint sm:inline">
                            {events.length}
                          </span>
                        )}
                      </div>

                      <div className="mt-0.5 flex gap-1 sm:hidden">
                        {events.slice(0, 3).map((e) => (
                          <span
                            key={e.id}
                            className={`h-1.5 w-1.5 rounded-full ${
                              e.kind === 'script' ? 'bg-seal' : e.kind === 'board' ? 'bg-jade' : 'bg-brass'
                            }`}
                          />
                        ))}
                      </div>

                      <div className="hidden flex-1 flex-col gap-0.5 overflow-hidden sm:flex">
                        {events.slice(0, 3).map((e) => (
                          <Link
                            key={e.id}
                            href={href(`/event/${e.id}`)}
                            title={`${formatTime(e.startAt)} ${e.title}`}
                            onClick={(ev) => ev.stopPropagation()}
                            className={`truncate rounded px-1 py-[1px] text-[10px] leading-tight transition-colors ${
                              e.kind === 'script'
                                ? 'bg-seal/15 text-[#e29b8a] hover:bg-seal/30'
                                : e.kind === 'board'
                                  ? 'bg-jade/15 text-[#8ccdb4] hover:bg-jade/30'
                                  : 'bg-brass/15 text-brass hover:bg-brass/25'
                            }`}
                          >
                            {e.title}
                          </Link>
                        ))}
                        {events.length > 3 && (
                          <button
                            onClick={(ev) => {
                              ev.stopPropagation()
                              setDaySheetKey(key)
                            }}
                            className="px-1 text-left text-[10px] text-faint hover:text-brass"
                          >
                            +{events.length - 3} 全部
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              </div>
              </div>
            </div>
          ) : (
            <div
              {...swipeHandlers}
              {...mouseHandlers}
              data-swipe="week"
              className={`overflow-hidden ${dragging ? 'select-none' : ''}`}
            >
              <div
                style={{
                  transform: `translateX(${dragX}px)`,
                  transition: dragging ? 'none' : 'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                <div key={flip} className={dir === 'next' ? 'anim-slide-next' : 'anim-slide-prev'}>
                  <WeekBoard
                    week={week}
                    byDate={byDate}
                    today={today}
                    onPick={handleDayPick}
                    hideEmpty={hideEmptyDays}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 选中日 */}
          {view === 'month' && (
            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-[16px] text-paper">
                  {formatDateFull(`${selectedKey}T00:00:00`)}
                  <span className="ml-2 text-[12px] font-normal text-faint">
                    {selectedEvents.length ? `${selectedEvents.length} 场` : '没有安排'}
                  </span>
                </h2>
                <div className="hidden sm:block">
                  <Button variant="ghost" size="sm" onClick={() => navigate('/create')}>
                    <Icon name="plus" size={13} /> 这天发一车
                  </Button>
                </div>
              </div>
              {selectedEvents.length ? (
                <div className="space-y-2.5">
                  {selectedEvents.map((e) => (
                    <EventCard key={e.id} event={e} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon="calendar"
                  title="这天还没人发车"
                  desc="填写时间与地点即可发起一场，系统会生成分享链接。"
                  action={
                    <Button size="sm" onClick={() => navigate('/create')}>
                      发一车
                    </Button>
                  }
                />
              )}
            </div>
          )}
        </>
      )}

      <Sheet
        open={!!daySheetKey}
        onClose={() => setDaySheetKey(null)}
        title={daySheetKey ? formatDateFull(`${daySheetKey}T00:00:00`) : ''}
        subtitle={`${daySheetEvents.length} 场 · 点一下看详情`}
      >
        <div className="space-y-2.5">
          {daySheetEvents.map((e) => (
            <EventCard key={e.id} event={e} showDate={false} />
          ))}
        </div>
        <div className="mt-3">
          <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/create')}>
            <Icon name="plus" size={13} /> 这天发一车
          </Button>
        </div>
      </Sheet>

      <div className="mt-8 rounded-xl border border-line/60 bg-surface/40 px-4 py-3 text-[11.5px] leading-relaxed text-faint">
        提示：时刻里
        <span className="mx-1 inline-block h-1.5 w-1.5 rounded-full bg-seal align-middle" />
        代表剧本杀，
        <span className="mx-1 inline-block h-1.5 w-1.5 rounded-full bg-jade align-middle" />
        代表桌游，
        <span className="mx-1 inline-block h-1.5 w-1.5 rounded-full bg-brass align-middle" />
        代表跑团 / 海龟汤 / 社交推理等其他玩法。手机和桌面都可以左右滑动翻页。
      </div>
    </div>
  )
}

/* ───────── 周视图 ───────── */

function WeekBoard({
  week,
  byDate,
  today,
  onPick,
  hideEmpty = false,
}: {
  week: Date[]
  byDate: Map<string, GameEvent[]>
  today: Date
  onPick: (key: string, events: GameEvent[]) => void
  /** 只留有活动的日子 */
  hideEmpty?: boolean
}) {
  const shown = hideEmpty
    ? week.filter((d) => (byDate.get(toDateKey(d))?.length ?? 0) > 0)
    : week

  if (hideEmpty && shown.length === 0) {
    return (
      <EmptyState
        icon="calendar"
        title="这周没有活动"
        desc="换一周看看，或者自己发一车。"
        action={
          <Button size="sm" onClick={() => navigate('/create')}>
            发一车
          </Button>
        }
      />
    )
  }

  return (
    <>
      {/* 桌面：每天一列 */}
      <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface/60 sm:block">
        <div
          className="grid border-b border-line bg-surface2/40"
          style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}
        >
          {shown.map((d) => {
            const isToday = isSameDay(d, today)
            return (
              <div key={d.toISOString()} className="py-2 text-center">
                <div className="text-[11px] text-faint">
                  {WEEK_HEADERS[(d.getDay() + 6) % 7]}
                </div>
                <div
                  className={`mx-auto mt-1 flex h-6 w-6 items-center justify-center rounded-full font-display text-[12.5px] tabular-nums ${
                    isToday ? 'bg-brass font-semibold text-[#1a1206]' : 'text-paper'
                  }`}
                >
                  {d.getDate()}
                </div>
              </div>
            )
          })}
        </div>
        <div
          className="grid min-h-[260px]"
          style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}
        >
          {shown.map((d, i) => {
            const key = toDateKey(d)
            const events = byDate.get(key) ?? []
            return (
              <div
                key={key}
                className={`flex flex-col gap-1 border-r border-line/60 p-1.5 ${
                  i === shown.length - 1 ? 'border-r-0' : ''
                }`}
              >
                {events.length ? (
                  events.map((e) => (
                    <Link
                      key={e.id}
                      href={href(`/event/${e.id}`)}
                      className={`block rounded-lg border px-1.5 py-1 text-[10.5px] leading-tight transition-colors ${
                        e.kind === 'script'
                          ? 'border-seal/30 bg-seal/10 text-[#e29b8a] hover:bg-seal/20'
                          : e.kind === 'board'
                            ? 'border-jade/30 bg-jade/10 text-[#8ccdb4] hover:bg-jade/20'
                            : 'border-brass/30 bg-brass/10 text-brass hover:bg-brass/20'
                      }`}
                    >
                      <div className="font-display tabular-nums opacity-80">
                        {formatTime(e.startAt)}
                      </div>
                      <div className="mt-0.5 line-clamp-2">{e.title}</div>
                    </Link>
                  ))
                ) : (
                  <button
                    onClick={() => onPick(key, events)}
                    className="flex flex-1 items-center justify-center rounded-lg text-[11px] text-faint/60 hover:bg-surface2/60"
                  >
                    —
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 手机：按天竖排 */}
      <div className="space-y-2 sm:hidden">
        {shown.map((d) => {
          const key = toDateKey(d)
          const events = byDate.get(key) ?? []
          const isToday = isSameDay(d, today)
          return (
            <div
              key={key}
              className={`rounded-xl border p-2.5 ${
                isToday ? 'border-brass/40 bg-brass/[0.06]' : 'border-line bg-surface/60'
              }`}
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full font-display text-[12px] tabular-nums ${
                    isToday ? 'bg-brass text-[#1a1206]' : 'text-paper'
                  }`}
                >
                  {d.getDate()}
                </span>
                <span className="text-[11.5px] text-faint">
                  {WEEK_HEADERS[(d.getDay() + 6) % 7]} · {events.length ? `${events.length} 场` : '空'}
                </span>
                <button
                  onClick={() => onPick(key, events)}
                  className="ml-auto text-[11px] text-faint hover:text-brass"
                >
                  看这天
                </button>
              </div>
              {events.length ? (
                <div className="space-y-1.5">
                  {events.map((e) => (
                    <EventRowMini key={e.id} event={e} />
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-line/70 py-2 text-center text-[11px] text-faint/70">
                  没有安排
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

/* ───────── 列表视图 ───────── */

function ListView({ groups }: { groups: Array<{ key: string; events: GameEvent[] }> }) {
  if (!groups.length) {
    return (
      <EmptyState
        icon="calendar"
        title="没有符合条件的活动"
        desc="换个筛选条件，或者自己发一车。"
        action={
          <Button size="sm" onClick={() => navigate('/create')}>
            发一车
          </Button>
        }
      />
    )
  }
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.key}>
          <div className="mb-2 flex items-baseline gap-2">
            <span className="font-display text-[15px] text-paper">
              {relativeDay(`${group.key}T12:00:00`)}
            </span>
            <span className="text-[11.5px] text-faint">
              {group.key.slice(5).replace('-', '/')} · {group.events.length} 场
            </span>
          </div>
          <div className="space-y-2.5">
            {group.events.map((e) => (
              <EventCard key={e.id} event={e} showDate={false} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ───────── 卡片视图（小红书式瀑布流） ───────── */

function CardGrid({ events }: { events: GameEvent[] }) {
  const db = useDB()
  if (!events.length) {
    return (
      <EmptyState
        icon="calendar"
        title="没有符合条件的活动"
        desc="换个筛选条件，或者自己发一车。"
        action={
          <Button size="sm" onClick={() => navigate('/create')}>
            发一车
          </Button>
        }
      />
    )
  }
  return (
    <div className="columns-2 gap-2.5 md:columns-3 lg:columns-4">
      {events.map((e) => {
        const game = e.gameId ? db.games.find((g) => g.id === e.gameId) : null
        const taken = e.seats.filter((s) => s.status === 'filled').length
        return (
          <Link
            key={e.id}
            href={href(`/event/${e.id}`)}
            className="mb-2.5 block break-inside-avoid overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-line2"
          >
            <div className="relative aspect-[4/3] overflow-hidden">
              {game ? (
                <CoverArt game={game} showSeal={false} />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-surface3 to-surface" />
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2">
                <span className="rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-paper backdrop-blur">
                  {KIND_LABEL[e.kind]}
                </span>
              </div>
            </div>
            <div className="p-2.5">
              <div className="line-clamp-2 font-display text-[13px] leading-snug text-paper">
                {e.title}
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[10.5px] text-faint">
                <span className="tabular-nums">
                  {relativeDay(e.startAt)} {formatTime(e.startAt)}
                </span>
                <span className="tabular-nums">
                  {taken}/{e.capacity}
                </span>
              </div>
              <div className="mt-0.5 line-clamp-1 text-[10.5px] text-faint">{e.city} · {e.venue}</div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
