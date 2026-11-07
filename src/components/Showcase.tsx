import type { Game, ShowcaseItem } from '../types'
import { CoverArt } from './CoverArt'
import { Icon } from './Icons'
import { href } from '../lib/router'
import Link from './Link'

export function ShowcaseCard({
  item,
  game,
  editing = false,
  onRemove,
  onEdit,
}: {
  item: ShowcaseItem
  game?: Game
  /** 只有编辑模式才出现移除按钮和编辑入口 */
  editing?: boolean
  onRemove?: () => void
  onEdit?: () => void
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-xl border bg-surface transition-colors ${
        editing ? 'border-brass/45' : 'border-line'
      }`}
    >
      {editing && onEdit && (
        <>
          <button
            onClick={onEdit}
            className="absolute inset-0 z-[5] cursor-pointer"
            aria-label={`编辑「${item.title}」`}
          />
          <span className="pointer-events-none absolute bottom-1.5 right-1.5 z-[6] flex h-6 w-6 items-center justify-center rounded-md border border-brass/50 bg-black/70 text-brass backdrop-blur">
            <Icon name="edit" size={12} />
          </span>
        </>
      )}

      {editing && onRemove && (
        <button
          onClick={onRemove}
          className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-md border border-seal/50 bg-black/70 text-seal backdrop-blur transition-colors hover:bg-seal hover:text-white"
          aria-label={`移除「${item.title}」`}
        >
          <Icon name="close" size={13} />
        </button>
      )}

      {item.type === 'game' && game ? (
        <Link href={href(`/game/${game.id}`)} className="relative block aspect-[3/4]">
          <CoverArt game={game} />
          <div className="absolute inset-x-0 bottom-0 p-2.5">
            <div className="line-clamp-1 font-display text-[13px] text-paper">{item.title}</div>
            <div className="mt-0.5 line-clamp-1 text-[10.5px] text-muted">{item.subtitle}</div>
          </div>
        </Link>
      ) : item.type === 'role' ? (
        <div className="relative flex aspect-[3/4] flex-col justify-between overflow-hidden bg-gradient-to-br from-surface3 to-surface p-3">
          {item.image && (
            <>
              <img src={item.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
            </>
          )}
          <Icon name="user" size={16} className="relative text-brass/60" />
          <div className="relative">
            <div className="font-display text-[19px] leading-tight text-paper">{item.title}</div>
            <div className="mt-1 text-[10.5px] text-muted">{item.subtitle}</div>
            {item.note && (
              <p className="mt-2 line-clamp-3 text-[10.5px] leading-relaxed text-faint">{item.note}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="relative flex aspect-[3/4] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#241a16] to-surface p-3">
          {item.image && (
            <>
              <img src={item.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
            </>
          )}
          <Icon name="quote" size={18} className="relative text-brass/50" />
          <div className="relative">
            <p className="font-display text-[14px] leading-relaxed text-paper">{item.title}</p>
            {item.subtitle && <div className="mt-2 text-[10.5px] text-faint">—— {item.subtitle}</div>}
          </div>
        </div>
      )}

      {editing && item.custom && (
        <span className="pointer-events-none absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[9.5px] text-muted backdrop-blur">
          自填
        </span>
      )}
    </div>
  )
}

export function ShowcaseGrid({
  items,
  games,
  editing = false,
  onRemove,
  onEdit,
}: {
  items: ShowcaseItem[]
  games: Game[]
  editing?: boolean
  onRemove?: (id: string) => void
  onEdit?: (id: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
      {items.map((item) => (
        <ShowcaseCard
          key={item.id}
          item={item}
          game={item.gameId ? games.find((g) => g.id === item.gameId) : undefined}
          editing={editing}
          onRemove={onRemove ? () => onRemove(item.id) : undefined}
          onEdit={onEdit ? () => onEdit(item.id) : undefined}
        />
      ))}
    </div>
  )
}
