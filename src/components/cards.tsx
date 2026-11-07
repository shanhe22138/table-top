import type { Game, GameEvent } from '../types'
import { CoverArt } from './CoverArt'
import { Icon } from './Icons'
import { Avatar, Tag } from './ui'
import { bookTitle, durationText, formatTime, gameTitle, weekdayLabel } from '../lib/format'
import { href } from '../lib/router'
import Link from './Link'

export function GameCard({ game, compact = false }: { game: Game; compact?: boolean }) {
  return (
    <Link href={href(`/game/${game.id}`)} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-line bg-surface transition-all duration-300 group-hover:-translate-y-0.5 group-hover:border-brassdim/70">
        <CoverArt game={game} />
        <div className="absolute right-1.5 top-1.5 rounded-md bg-black/55 px-1.5 py-[3px] font-display text-[12px] leading-none text-brass backdrop-blur-sm">
          {game.rating.toFixed(1)}
        </div>
        <div className="absolute inset-x-0 bottom-0 px-2.5 pb-2.5">
          <div className="line-clamp-2 font-display text-[13px] leading-snug text-paper">
            {gameTitle(game)}
          </div>
          {!compact && (
            <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
              <span className="inline-flex items-center gap-0.5">
                <Icon name="users" size={10} /> {game.minPlayers}
                {game.maxPlayers !== game.minPlayers ? `-${game.maxPlayers}` : ''}
              </span>
              <span className="inline-flex items-center gap-0.5">
                <Icon name="clock" size={10} />
                {durationText(game.durationMin)}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

export function SeatBar({
  taken,
  total,
  className = '',
}: {
  taken: number
  total: number
  className?: string
}) {
  const pct = total ? Math.round((taken / total) * 100) : 0
  const full = taken >= total
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface3">
        <div
          className={`h-full rounded-full transition-all ${full ? 'bg-seal' : 'bg-brass'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`font-display text-[11px] tabular-nums ${full ? 'text-seal' : 'text-muted'}`}>
        {taken}/{total}
      </span>
    </div>
  )
}

export function EventCard({ event, showDate = true }: { event: GameEvent; showDate?: boolean }) {
  const taken = event.seats.filter((s) => s.status === 'filled').length
  const d = new Date(event.startAt)
  const done = event.status === 'done' || d.getTime() < Date.now() - 3600000
  const full = taken >= event.capacity

  return (
    <Link
      href={href(`/event/${event.id}`)}
      className={`block rounded-xl border border-line bg-surface p-3 transition-colors hover:border-line2 hover:bg-surface2/60 ${
        done ? 'opacity-60' : ''
      }`}
    >
      <div className="flex gap-3">
        {showDate && (
          <div className="w-11 shrink-0 border-r border-line pr-2 text-center">
            <div className="text-[10px] text-faint">{weekdayLabel(d)}</div>
            <div className="font-display text-[15px] leading-tight text-paper">
              {d.getMonth() + 1}/{d.getDate()}
            </div>
            <div className="text-[11px] text-brass">{formatTime(event.startAt)}</div>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <span className="line-clamp-1 flex-1 text-[14px] text-paper">{event.title}</span>
            <span className="shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] text-faint">
              {event.kind === 'script' ? '剧本杀' : '桌游'}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-muted">
            {!showDate && (
              <span className="inline-flex items-center gap-0.5 font-display tabular-nums text-brass">
                <Icon name="clock" size={11} /> {formatTime(event.startAt)}
              </span>
            )}
            <span className="inline-flex items-center gap-0.5">
              <Icon name="book" size={11} />{' '}
              {event.kind === 'script' ? bookTitle(event.gameTitle) : event.gameTitle}
            </span>
            <span className="inline-flex items-center gap-0.5">
              <Icon name="pin" size={11} /> {event.city} · {event.venue}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <SeatBar taken={taken} total={event.capacity} className="flex-1" />
            {full ? (
              <span className="text-[10px] text-seal">已满</span>
            ) : event.joinMode === 'open' ? (
              <span className="text-[10px] text-jade">可上车</span>
            ) : event.joinMode === 'approval' ? (
              <span className="text-[10px] text-muted">需确认</span>
            ) : (
              <span className="text-[10px] text-faint">仅邀请</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

export function EventRowMini({ event }: { event: GameEvent }) {
  const taken = event.seats.filter((s) => s.status === 'filled').length
  return (
    <Link
      href={href(`/event/${event.id}`)}
      className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-2 hover:border-line2"
    >
      <span className="font-display text-[11px] tabular-nums text-brass">
        {formatTime(event.startAt)}
      </span>
      <span className="min-w-0 flex-1 truncate text-[12px] text-paper">{event.title}</span>
      <span className="shrink-0 text-[10px] tabular-nums text-faint">
        {taken}/{event.capacity}
      </span>
    </Link>
  )
}

export function HostLine({
  name,
  avatar,
  userId,
}: {
  name: string
  avatar?: string | null
  userId?: string | null
}) {
  const body = (
    <>
      <Avatar name={name} src={avatar} size={22} />
      <span className="text-[12.5px] text-muted">{name}</span>
    </>
  )
  if (!userId) return <div className="flex items-center gap-2">{body}</div>
  return (
    <Link
      href={href(`/u/${userId}`)}
      className="inline-flex items-center gap-2 rounded-full transition-colors hover:text-paper"
      title={`查看 ${name} 的资料`}
    >
      {body}
    </Link>
  )
}

export function MetaLine({ event }: { event: GameEvent }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-muted">
      <span className="inline-flex items-center gap-1">
        <Icon name="clock" size={12} /> {durationText(event.durationMin)}
      </span>
      <span className="inline-flex items-center gap-1">
        <Icon name="users" size={12} /> {event.capacity} 人
      </span>
      <Tag>{event.city}</Tag>
    </div>
  )
}
