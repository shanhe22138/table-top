import { useMemo, useState } from 'react'
import { useDB, useSettings } from '../store/db'
import { useAuth } from '../store/auth'
import { navigate } from '../lib/router'
import { useDragScroll } from '../lib/dragscroll'
import { Icon } from '../components/Icons'
import { Button, Chip, EmptyState, ProgressBar, Segmented, Stars } from '../components/ui'
import { GameCard } from '../components/cards'
import { CoverArt } from '../components/CoverArt'
import { DragRow } from '../components/DragRow'
import Link from '../components/Link'
import {
  GAME_KINDS,
  KIND_LABEL,
  difficultyLabel,
  playOption,
  type Chart,
  type ChartEntry,
  type Game,
  type GameKind,
} from '../types'
import { facetsOf } from '../lib/taxonomy'
import { bookTitle, formatDuration, gameTitle } from '../lib/format'

type Sort = 'recommend' | 'rating' | 'players' | 'short'

export default function StorePage({ kind }: { kind: GameKind | null }) {
  const db = useDB()
  const settings = useSettings()
  const { isAdmin } = useAuth()
  const [q, setQ] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('recommend')
  const featDrag = useDragScroll()
  const freshDrag = useDragScroll()

  /** 仓库只按剧本杀 / 桌游分栏，其余玩法并入「全部」 */
  const activeKind: GameKind | null = kind === 'script' || kind === 'board' ? kind : null
  const kindTabs: Array<{ value: GameKind | null; label: string }> = [
    { value: null, label: '全部' },
    { value: 'script', label: KIND_LABEL.script },
    { value: 'board', label: KIND_LABEL.board },
  ]

  const facetGroups = useMemo(() => {
    if (!activeKind) return []
    const pool = new Set(settings.taxonomy[activeKind] ?? [])
    return facetsOf(activeKind)
      .map((f) => ({ ...f, tags: f.tags.filter((t) => pool.has(t)) }))
      .filter((f) => f.tags.length)
  }, [activeKind, settings])

  const list = useMemo(() => {
    let out = db.games.filter((g) => {
      if (activeKind && g.kind !== activeKind) return false
      if (tag && !g.tags.includes(tag)) return false
      if (q.trim()) {
        const s = q.trim().toLowerCase()
        if (
          !g.title.toLowerCase().includes(s) &&
          !g.subtitle.toLowerCase().includes(s) &&
          !g.tags.some((t) => t.toLowerCase().includes(s)) &&
          !g.publisher.toLowerCase().includes(s)
        )
          return false
      }
      return true
    })
    out = [...out]
    switch (sort) {
      case 'rating':
        out.sort((a, b) => b.rating - a.rating)
        break
      case 'players':
        out.sort((a, b) => b.maxPlayers - a.maxPlayers)
        break
      case 'short':
        out.sort((a, b) => a.durationMin - b.durationMin)
        break
      default:
        out.sort(
          (a, b) => b.rating * Math.log10(b.ratingCount + 10) - a.rating * Math.log10(a.ratingCount + 10),
        )
    }
    return out
  }, [db.games, activeKind, tag, q, sort])

  const featured = useMemo(
    () => db.games.filter((g) => g.featured && (!activeKind || g.kind === activeKind)).slice(0, 4),
    [db.games, activeKind],
  )

  const chart = db.charts[0] ?? null
  const fresh = useMemo(
    () => db.games.filter((g) => g.isNew && (!activeKind || g.kind === activeKind)).slice(0, 6),
    [db.games, activeKind],
  )

  const showHero = !q && !tag && sort === 'recommend'

  return (
    <div className="anim-rise">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] leading-tight tracking-wide text-paper">仓库</h1>
          <p className="mt-1 text-[12.5px] text-faint">
            {db.games.length} 个条目 · 看评分、看评测，也可以直接用它发车
          </p>
        </div>
        {isAdmin && (
          <Link
            href="#/admin"
            className="mt-1 shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-[12px] text-faint transition-colors hover:border-line2 hover:text-paper"
          >
            录入条目
          </Link>
        )}
      </div>

      <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto">
        {kindTabs.map((t) => (
          <Chip
            key={String(t.value)}
            active={activeKind === t.value}
            onClick={() => {
              setTag(null)
              navigate(t.value ? `/library?kind=${t.value}` : '/library')
            }}
          >
            {t.label}
          </Chip>
        ))}
      </div>

      <div className="mb-3 flex items-center justify-end">
        <Segmented
          value={sort}
          onChange={setSort}
          options={[
            { value: 'recommend', label: '推荐' },
            { value: 'rating', label: '评分' },
            { value: 'short', label: '时长' },
          ]}
        />
      </div>

      {/* 分面筛选：跟偏好页用的是同一套分类 */}
      {facetGroups.length > 0 ? (
        <div className="mb-4 space-y-2">
          {facetGroups.map((f) => (
            <DragRow className="flex gap-2 overflow-x-auto no-scrollbar">
              <span className="shrink-0 self-center text-[11px] text-faint">{f.label}</span>
              {f.tags.map((t) => (
                <Chip key={t} active={tag === t} onClick={() => setTag(tag === t ? null : t)}>
                  {t}
                </Chip>
              ))}
            </DragRow>
          ))}
          {tag && (
            <button
              onClick={() => setTag(null)}
              className="text-[11.5px] text-brass/80 hover:text-brass"
            >
              清除标签筛选
            </button>
          )}
        </div>
      ) : (
        <DragRow className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1">
          <Chip active={!tag} onClick={() => setTag(null)}>
            全部标签
          </Chip>
          {Array.from(
            new Set(['script', 'board'].flatMap((k) => settings.taxonomy[k as GameKind] ?? [])),
          ).map((t) => (
            <Chip key={t} active={tag === t} onClick={() => setTag(tag === t ? null : t)}>
              {t}
            </Chip>
          ))}
        </DragRow>
      )}

      {showHero && featured.length > 0 && (
        <div className="mb-7">
          <div
            ref={featDrag.ref}
            {...featDrag.handlers}
            data-drag="featured"
            className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1"
          >
            {featured.map((g) => (
              <HeroCard key={g.id} game={g} />
            ))}
          </div>
        </div>
      )}

      {showHero && chart && <ChartBoard chart={chart} games={db.games} />}

      {showHero && fresh.length > 0 && (
        <div className="mb-7">
          <div className="mb-2 flex items-baseline gap-2">
            <h2 className="font-display text-[15px] text-paper">新入库</h2>
            <span className="text-[11px] text-faint">本月刚加进来的</span>
          </div>
          <div
            ref={freshDrag.ref}
            {...freshDrag.handlers}
            data-drag="fresh"
            className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1"
          >
            {fresh.map((g) => (
              <Link
                key={g.id}
                href={`#/game/${g.id}`}
                className="relative w-[104px] shrink-0"
              >
                <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-line">
                  <CoverArt game={g} showSeal={false} />
                  <span className="absolute left-1 top-1 rounded bg-brass px-1 py-[1px] text-[9px] font-semibold text-[#1a1206]">
                    新
                  </span>
                </div>
                <div className="mt-1 line-clamp-1 text-[11px] text-muted">{gameTitle(g)}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-[16px] text-paper">
          {tag ? tag : kind ? KIND_LABEL[kind] : '全部条目'}
        </h2>
        <span className="text-[11.5px] text-faint">{list.length} 个</span>
      </div>

      {list.length ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {list.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="search"
          title="没有找到匹配的条目"
          desc="换个关键词或标签试试，管理员可以在后台录入新条目。"
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setQ('')
                setTag(null)
              }}
            >
              清空筛选
            </Button>
          }
        />
      )}
    </div>
  )
}

/* ───────── 月度榜单 ───────── */

function ChartBoard({ chart, games }: { chart: Chart; games: Game[] }) {
  return (
    <section className="mb-7 rounded-2xl border border-line bg-surface/50 p-4">
      <div className="mb-3">
        <h2 className="font-display text-[16px] text-paper">{chart.period.replace('-', ' 年 ')} 月榜</h2>
        <p className="mt-0.5 text-[11px] text-faint">每月统计一次，相对热度（数字越高越热门）</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <ChartColumn title="桌游 Top5" entries={chart.board} games={games} />
        <ChartColumn title="剧本杀 Top3" entries={chart.script} games={games} book />
        <SocialColumn chart={chart} />
      </div>
    </section>
  )
}

function ChartColumn({
  title,
  entries,
  games,
  book = false,
}: {
  title: string
  entries: ChartEntry[]
  games: Game[]
  book?: boolean
}) {
  return (
    <div className="rounded-xl border border-line/70 bg-surface2/30 p-3">
      <div className="mb-2 text-[11.5px] text-faint">{title}</div>
      <ol className="space-y-2">
        {entries.map((e) => {
          const g = e.gameId ? games.find((x) => x.id === e.gameId) : null
          const name = book ? bookTitle(e.title) : e.title
          const body = (
            <>
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded font-display text-[11px] tabular-nums ${
                    e.rank <= 3 ? 'bg-brass/20 text-brass' : 'bg-surface3 text-faint'
                  }`}
                >
                  {e.rank}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-paper">{name}</span>
                <span className="shrink-0 font-display text-[11.5px] tabular-nums text-brass">
                  {typeof e.heat === 'number' ? e.heat : '—'}
                </span>
              </div>
              {typeof e.heat === 'number' && (
                <div className="mt-1 pl-7">
                  <ProgressBar value={e.heat} tone={e.heat >= 70 ? 'brass' : 'jade'} />
                </div>
              )}
              {(e.note || g) && (
                <div className="mt-0.5 pl-7 text-[10.5px] text-faint">
                  {e.note ||
                    (g ? `${difficultyLabel(g.kind, g.difficulty)} · ${formatDuration(g.durationMin)}` : '')}
                </div>
              )}
            </>
          )
          return (
            <li key={`${e.rank}-${e.title}`}>
              {g ? (
                <Link href={`#/game/${g.id}`} className="block rounded-lg px-1 py-1 hover:bg-surface2">
                  {body}
                </Link>
              ) : (
                <div className="px-1 py-1">{body}</div>
              )}
            </li>
          )
        })}
        {entries.length === 0 && <li className="py-2 text-[11.5px] text-faint">本期没有数据</li>}
      </ol>
    </div>
  )
}

function SocialColumn({ chart }: { chart: Chart }) {
  const maxHeat = chart.social.reduce((m, s) => Math.max(m, s.heat), 0)
  return (
    <div className="rounded-xl border border-line/70 bg-surface2/30 p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[11.5px] text-faint">社交推理热度</span>
        {maxHeat > 0 && <span className="text-[10px] text-faint">以最高 {maxHeat} 为 100%</span>}
      </div>
      <div className="space-y-2">
        {chart.social.map((s) => (
          <div key={s.key}>
            <div className="flex items-baseline justify-between text-[11.5px]">
              <span className="text-muted">{playOption(s.key)?.label ?? s.key}</span>
              <span className="font-display tabular-nums text-brass">{s.heat}</span>
            </div>
            <ProgressBar
              className="mt-1"
              value={s.heat}
              max={maxHeat || 1}
              tone={maxHeat > 0 && s.heat >= maxHeat * 0.7 ? 'brass' : 'jade'}
            />
          </div>
        ))}
        {chart.social.length === 0 && <p className="py-2 text-[11.5px] text-faint">本期没有数据</p>}
      </div>
    </div>
  )
}

function HeroCard({ game }: { game: Game }) {
  return (
    <Link
      href={`#/game/${game.id}`}
      className="relative block h-[172px] w-[300px] shrink-0 overflow-hidden rounded-xl border border-line sm:h-[196px] sm:w-[380px]"
    >
      <CoverArt game={game} />
      <div className="absolute inset-0 flex flex-col justify-end p-4">
        <div className="mb-1 flex items-center gap-1.5">
          <span className="rounded bg-brass/90 px-1.5 py-0.5 text-[10px] font-semibold text-[#1a1206]">
            精选
          </span>
          <span className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-paper backdrop-blur">
            {KIND_LABEL[game.kind]}
          </span>
        </div>
        <div className="font-display text-[19px] leading-tight text-paper">{gameTitle(game)}</div>
        <div className="mt-1 line-clamp-1 text-[12px] text-muted">{game.subtitle || game.description}</div>
        <div className="mt-2 flex items-center gap-3 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1">
            <Stars value={game.rating} size={11} />
            <span className="text-brass">{game.rating.toFixed(1)}</span>
          </span>
          <span>
            {game.minPlayers === game.maxPlayers
              ? `${game.minPlayers} 人`
              : `${game.minPlayers}-${game.maxPlayers} 人`}
          </span>
          <span>{formatDuration(game.durationMin)}</span>
        </div>
      </div>
    </Link>
  )
}
