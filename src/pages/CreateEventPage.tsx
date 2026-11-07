import { useMemo, useState } from 'react'
import { mutate, uid, useDB, useSettings } from '../store/db'
import { useAuth } from '../store/auth'
import { navigate } from '../lib/router'
import { Icon } from '../components/Icons'
import { Button, Chip, DurationField, Field, Segmented, Sheet, Switch } from '../components/ui'
import { CoverArt } from '../components/CoverArt'
import { PsychEditor } from '../components/PsychEditor'
import {
  DURATION_MAX,
  DURATION_MIN,
  DURATION_STEP,
  type Game,
  type JoinMode,
  type PsychTest,
} from '../types'
import { JOIN_MODE_LABEL } from '../types'
import { durationText, gameTitle, toDateKey } from '../lib/format'

function tomorrow() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d
}

export default function CreateEventPage({ gameId }: { gameId: string | null }) {
  const db = useDB()
  const settings = useSettings()
  const { user } = useAuth()
  const initial = gameId ? db.games.find((g) => g.id === gameId) ?? null : null

  const [game, setGame] = useState<Game | null>(initial)
  const [title, setTitle] = useState(initial ? `${initial.title} 拼车` : '')
  const [date, setDate] = useState(toDateKey(tomorrow()))
  const [time, setTime] = useState('19:30')
  const [duration, setDuration] = useState(initial?.durationMin ?? 180)
  const [city, setCity] = useState(user?.prefs.locations[0] ?? settings.locations[0] ?? '')
  const [customCity, setCustomCity] = useState('')
  const [venue, setVenue] = useState('')
  const [capacity, setCapacity] = useState(initial?.maxPlayers ?? 6)
  const [joinMode, setJoinMode] = useState<JoinMode>('open')
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [q, setQ] = useState('')
  const [psychEnabled, setPsychEnabled] = useState(false)
  const [psychTest, setPsychTest] = useState<PsychTest | null>(null)
  const [psychEditOpen, setPsychEditOpen] = useState(false)
  const [waitlistSize, setWaitlistSize] = useState(0)

  const pickerList = useMemo(() => {
    const s = q.trim().toLowerCase()
    return db.games
      .filter((g) => !s || g.title.toLowerCase().includes(s) || g.tags.some((t) => t.includes(s)))
      .slice(0, 40)
  }, [db.games, q])

  function chooseGame(g: Game) {
    setGame(g)
    setTitle(`${gameTitle(g)} 拼车`)
    setDuration(g.durationMin)
    setCapacity(g.maxPlayers)
    const hasTest = !!g.psychTests?.length
    setPsychEnabled(hasTest)
    setPsychTest(hasTest ? JSON.parse(JSON.stringify(g.psychTests![0])) : null)
    setWaitlistSize(0)
    setPickerOpen(false)
    setQ('')
  }

  function submit() {
    if (!user) return
    if (!title.trim()) {
      setErr('给这车起个名字')
      return
    }
    if (!venue.trim()) {
      setErr('填一下具体地点')
      return
    }
    const placeName = city === '__custom__' ? customCity.trim() : city
    if (!placeName) {
      setErr('选一个地点，或者自己填一个')
      return
    }
    const startAt = new Date(`${date}T${time}:00`)
    if (Number.isNaN(startAt.getTime())) {
      setErr('时间填得不太对')
      return
    }
    if (startAt.getTime() < Date.now() - 60000) {
      setErr('开始时间已过，请选择将来的时间')
      return
    }

    // 需要心测时座位不绑定角色，由车头看完心测结果再分配；
    // 不需要心测时，若有角色表则把空位预先绑到角色，方便玩家自选、空位展示角色名+性别。
    const roles = !psychEnabled ? game?.roles ?? [] : []
    const id = uid('e')
    mutate((d) => {
      const mainSeats = Array.from({ length: capacity }, (_, i) => {
        const role = roles[i - 1]
        return {
          id: uid('st'),
          index: i,
          userId: i === 0 ? user.id : null,
          name: i === 0 ? user.nickname : null,
          contact: null,
          note: i === 0 ? '车头' : null,
          status: i === 0 ? ('filled' as const) : ('open' as const),
          roleName: role?.name ?? null,
          gender: role?.gender,
        }
      })
      const waitSeats = Array.from({ length: waitlistSize }, (_, i) => ({
        id: uid('st'),
        index: capacity + i,
        userId: null,
        name: null,
        contact: null,
        note: null,
        status: 'waitlist' as const,
        roleName: null,
      }))
      d.events.push({
        id,
        hostId: user.id,
        hostName: user.nickname,
        title: title.trim(),
        gameId: game?.id ?? null,
        gameTitle: game?.title ?? '自定义',
        kind: game?.kind ?? 'board',
        startAt: startAt.toISOString(),
        durationMin: duration,
        city: placeName,
        venue: venue.trim(),
        capacity,
        joinMode,
        note: note.trim(),
        seats: [...mainSeats, ...waitSeats],
        shareCode: Math.random().toString(36).slice(2, 10),
        status: 'open',
        waitlistSize,
        psych: { enabled: psychEnabled, test: psychEnabled ? psychTest : null },
        createdAt: new Date().toISOString(),
      })
    })
    navigate(`/event/${id}`)
  }

  return (
    <div className="anim-rise mx-auto max-w-2xl">
      <h1 className="font-display text-[24px] leading-tight tracking-wide text-paper">发车</h1>
      <p className="mt-1 text-[12.5px] text-faint">提交后自动生成上车链接，可直接分享</p>

      <div className="mt-5 space-y-5">
        {/* 选条目 */}
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-[13px] text-muted">玩什么</span>
            <button
              onClick={() => setPickerOpen(true)}
              className="text-[12px] text-brass/90 hover:text-brass"
            >
              {game ? '换一个' : '从仓库选'}
            </button>
          </div>
          {game ? (
            <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
              <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg border border-line">
                <CoverArt game={game} showSeal={false} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-[14px] text-paper">{gameTitle(game)}</div>
                <div className="mt-0.5 text-[11.5px] text-faint">
                  {game.minPlayers === game.maxPlayers ? `${game.minPlayers} 人` : `${game.minPlayers}-${game.maxPlayers} 人`} · {durationText(game.durationMin)}
                </div>
              </div>
              <button
                onClick={() => setGame(null)}
                className="rounded-lg p-1.5 text-faint hover:text-seal"
                aria-label="移除"
              >
                <Icon name="close" size={15} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setPickerOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line2 py-4 text-[13px] text-faint transition-colors hover:border-brassdim hover:text-muted"
            >
              <Icon name="search" size={15} /> 选一个剧本或桌游（也可以不选）
            </button>
          )}
        </div>

        <Field label="这车叫什么">
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setErr('')
            }}
            placeholder="比如：周五晚 · 年轮 硬核车"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="日期">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="开始时间">
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>

        <div>
          <div className="mb-1.5 text-[13px] text-muted">预计时长</div>
          <DurationField
            min={DURATION_MIN}
            max={DURATION_MAX}
            step={DURATION_STEP}
            value={duration}
            onChange={setDuration}
          />
        </div>

        <Field label="地点" hint="选一个，或者自己填">
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {settings.locations.map((c) => (
              <Chip key={c} active={city === c} onClick={() => setCity(c)}>
                {c}
              </Chip>
            ))}
            <Chip active={city === '__custom__'} onClick={() => setCity('__custom__')}>
              其他
            </Chip>
          </div>
          {city === '__custom__' && (
            <input
              className="mt-2"
              value={customCity}
              onChange={(e) => {
                setCustomCity(e.target.value)
                setErr('')
              }}
              placeholder="填一个地点，比如：苏州 · 姑苏区"
            />
          )}
        </Field>

        <Field label="具体场地">
          <input
            value={venue}
            onChange={(e) => {
              setVenue(e.target.value)
              setErr('')
            }}
            placeholder="比如：叁号推理馆 · 陆家嘴"
          />
        </Field>

        <Field label="人数上限" hint="含你自己">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCapacity((c) => Math.max(2, c - 1))}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface2 text-muted hover:text-paper"
            >
              <Icon name="minus" size={15} />
            </button>
            <span className="w-12 text-center font-display text-[18px] text-paper tabular-nums">
              {capacity}
            </span>
            <button
              onClick={() => setCapacity((c) => Math.min(30, c + 1))}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface2 text-muted hover:text-paper"
            >
              <Icon name="plus" size={15} />
            </button>
            <span className="ml-1 text-[11.5px] text-faint">发车后第一格是你自己的位子</span>
          </div>
        </Field>

        <Field label="上车方式">
          <Segmented
            value={joinMode}
            onChange={setJoinMode}
            options={[
              { value: 'open', label: '自由上车' },
              { value: 'approval', label: '需确认' },
              { value: 'invite', label: '仅邀请' },
            ]}
            className="w-full"
          />
          <p className="mt-1.5 text-[11.5px] text-faint">
            {joinMode === 'open'
              ? '谁拿到链接都能直接占位，先到先得。'
              : joinMode === 'approval'
                ? '别人提交后，需要你确认才占位。'
                : '只有你自己能把人放上车，适合熟人局。'}
          </p>
        </Field>

        <Field label="给来的人留句话" hint="选填">
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="比如：硬核本，请准时到场；附近有夜宵店，结束后可以一起吃。"
          />
        </Field>

        {/* 心测：剧本杀可在发车时启用，玩家上车前先做适配问卷 */}
        {game && (
          <div className="space-y-3 rounded-xl border border-line bg-surface/50 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[13px] text-paper">上车心测</div>
                <div className="mt-0.5 text-[11px] text-faint">
                  启用心测后玩家不能自选角色，需先作答，由你根据结果分配
                </div>
              </div>
              <Switch
                checked={psychEnabled}
                onChange={(v) => {
                  setPsychEnabled(v)
                  if (v && !psychTest)
                    setPsychTest(
                      game.psychTests?.length
                        ? JSON.parse(JSON.stringify(game.psychTests[0]))
                        : {
                            id: `pt_${Date.now().toString(36)}`,
                            title: `${game.title} · 角色适配问卷`,
                            questions: [
                              {
                                id: `q_${Date.now().toString(36)}`,
                                text: '',
                                options: [
                                  { id: `o_${Date.now().toString(36)}a`, label: '', tag: '' },
                                  { id: `o_${Date.now().toString(36)}b`, label: '', tag: '' },
                                ],
                              },
                            ],
                          },
                    )
                }}
                label="启用心测"
              />
            </div>

            {psychEnabled && psychTest && (
              <div className="space-y-2 border-t border-line/60 pt-3">
                {game.psychTests && game.psychTests.length > 1 && (
                  <div>
                    <div className="mb-1 text-[11px] text-faint">基于默认模板</div>
                    <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                      {game.psychTests.map((t, i) => (
                        <Chip
                          key={t.id}
                          active={psychTest.id === t.id}
                          onClick={() => setPsychTest(JSON.parse(JSON.stringify(t)))}
                        >
                          {t.title || `模板 ${i + 1}`}
                        </Chip>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between rounded-lg bg-ink/40 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-[12.5px] text-paper">{psychTest.title || '未命名问卷'}</div>
                    <div className="text-[10.5px] text-faint">
                      {psychTest.questions.length} 题 · 可基于模板自行增删
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setPsychEditOpen(true)}>
                    <Icon name="edit" size={13} /> 编辑
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 候补位 */}
        <Field label="候补位" hint="满车后想上车的人可以排候补，由你自行联系决定谁上车">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setWaitlistSize((c) => Math.max(0, c - 1))}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface2 text-muted hover:text-paper"
            >
              <Icon name="minus" size={15} />
            </button>
            <span className="w-12 text-center font-display text-[18px] text-paper tabular-nums">
              {waitlistSize}
            </span>
            <button
              onClick={() => setWaitlistSize((c) => Math.min(20, c + 1))}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface2 text-muted hover:text-paper"
            >
              <Icon name="plus" size={15} />
            </button>
            <span className="ml-1 text-[11.5px] text-faint">候补是否上车由你联系决定</span>
          </div>
        </Field>

        {err && <p className="text-[12.5px] text-seal">{err}</p>}

        <div className="flex gap-2 pt-1">
          <Button variant="ghost" className="flex-1" onClick={() => navigate('/calendar')}>
            取消
          </Button>
          <Button className="flex-[2]" size="lg" onClick={submit}>
            发车，生成上车链接
          </Button>
        </div>
      </div>

      <Sheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="从仓库选"
        subtitle={`${db.games.length} 个条目可选`}
        wide
      >
        <div className="relative mb-3">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
            <Icon name="search" size={15} />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜名字或标签"
            className="!pl-9 !py-2 !text-[13px]"
          />
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {pickerList.map((g) => (
            <button key={g.id} onClick={() => chooseGame(g)} className="text-left">
              <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-line">
                <CoverArt game={g} showSeal={false} />
              </div>
              <div className="mt-1 line-clamp-1 text-[11.5px] text-muted">{gameTitle(g)}</div>
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet
        open={psychEditOpen}
        onClose={() => setPsychEditOpen(false)}
        title="编辑心测"
        subtitle="可基于默认模板增删问题，或另起一份"
        wide
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setPsychEditOpen(false)}>
              完成
            </Button>
          </div>
        }
      >
        {psychTest && (
          <PsychEditor value={psychTest} onChange={setPsychTest} />
        )}
      </Sheet>
    </div>
  )
}
