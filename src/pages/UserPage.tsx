import { useState } from 'react'
import { useDB } from '../store/db'
import { useAuth } from '../store/auth'
import { navigate } from '../lib/router'
import { toggleLike, followUser, unfollowUser } from '../store/social'
import { Avatar, Button, EmptyState, Tag } from '../components/ui'
import { EventCard } from '../components/cards'
import { ShowcaseGrid } from '../components/Showcase'
import { Icon } from '../components/Icons'
import { copyText } from '../lib/platform'
import {
  KIND_LABEL,
  PLAY_OPTIONS,
  ROLE_LABEL,
  difficultyLabel,
  type GameEvent,
  type GameKind,
  type User,
} from '../types'
import { facetsOf } from '../lib/taxonomy'
import { durationText } from '../lib/format'

/** 玩过 / 主持过的统计，口径与「我的」页一致 */
function statsOf(user: User, events: GameEvent[]) {
  const hosted = events.filter((e) => e.hostId === user.id)
  const joined = events.filter((e) => e.hostId !== user.id && e.seats.some((s) => s.userId === user.id))
  const board = new Set<string>()
  const script = new Set<string>()
  const other = new Set<string>()
  for (const e of [...hosted, ...joined]) {
    if (!e.gameId) continue
    if (e.kind === 'board') board.add(e.gameId)
    else if (e.kind === 'script') script.add(e.gameId)
    else other.add(e.gameId)
  }
  return {
    board: board.size,
    script: script.size,
    other: other.size,
    hostedTotal: hosted.length,
    hostedScript: hosted.filter((e) => e.kind === 'script').length,
    hostedOther: hosted.filter((e) => e.kind !== 'script').length,
  }
}

export default function UserPage({ id }: { id: string }) {
  const db = useDB()
  const { user: me } = useAuth()
  const [copied, setCopied] = useState(false)
  const user = db.users.find((u) => u.id === id)

  if (!user) {
    return (
      <EmptyState
        icon="user"
        title="找不到这个玩家"
        desc="这个账号可能已经注销。"
        action={<Button onClick={() => navigate('/calendar')}>回到时刻</Button>}
      />
    )
  }

  const p = user.privacy
  const stat = statsOf(user, db.events)
  const isSelf = !!me && me.id === user.id
  const canInteract = !!me && !isSelf
  const liked = !!me && me.likedUsers.includes(user.id)
  const following = !!me && me.following.includes(user.id)
  const followerCount = user.followers.length
  const followingCount = user.following.length
  const showcase = db.showcase
    .filter((s) => s.userId === user.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const hostedAll = db.events
    .filter((e) => e.hostId === user.id && e.status !== 'cancelled')
    .sort((a, b) => b.startAt.localeCompare(a.startAt))
  const hosted = hostedAll.slice(0, 6)
  // 带过哪些本子：按标题去重后全部列出，不再写「剧本 X · 其他 Y」这种笼统分类
  const hostedGames = Array.from(new Set(hostedAll.map((e) => e.gameTitle).filter(Boolean)))

  const kinds = Array.from(
    new Set(
      user.prefs.plays
        .map((k) => PLAY_OPTIONS.find((o) => o.key === k)?.kind)
        .filter((k): k is GameKind => !!k),
    ),
  )

  // 偏好只要有任意内容才展示，全空就整段隐藏
  const hasPrefs =
    kinds.length > 0 ||
    !!user.prefs.durationRange ||
    user.prefs.locations.length > 0 ||
    user.prefs.boards.length > 0

  return (
    <div className="anim-rise">
      <button
        onClick={() => (history.length > 1 ? history.back() : navigate('/calendar'))}
        className="mb-3 inline-flex items-center gap-1 text-[13px] text-faint transition-colors hover:text-paper"
      >
        <Icon name="left" size={15} /> 返回
      </button>

      {/* 名片 */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="absolute inset-0 bg-gradient-to-br from-brass/[0.07] via-transparent to-jade/[0.05]" />
        <div className="relative flex items-start gap-4 p-4 sm:p-5">
          <Avatar name={user.nickname} src={user.avatar} size={64} className="text-[26px]" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-display text-[21px] tracking-wide text-paper">
                {user.nickname}
              </h1>
              {user.showUsername && (
                <span className="shrink-0 text-[11px] text-faint">@{user.username}</span>
              )}
              <button
                onClick={() => {
                  void copyText(user.uid)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                }}
                title="点击复制 uid"
                className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10.5px] transition-colors ${
                  copied
                    ? 'border-jade/50 text-jade'
                    : 'border-line/70 text-faint hover:border-line2 hover:text-muted'
                }`}
              >
                {copied ? '已复制' : `UID ${user.uid}`}
              </button>
              {user.role !== 'user' && (
                <span className="shrink-0 rounded bg-brass/15 px-1.5 py-0.5 text-[10px] text-brass">
                  {ROLE_LABEL[user.role]}
                </span>
              )}
              {user.host.enabled && p.host && (
                <span className="shrink-0 rounded bg-jade/15 px-1.5 py-0.5 text-[10px] text-jade">
                  主持人
                </span>
              )}
            </div>

            {canInteract && (
              <div className="mt-2.5 flex items-center gap-2">
                <Button
                  size="sm"
                  variant={following ? 'outline' : 'primary'}
                  onClick={() =>
                    following ? unfollowUser(me!.id, user.id) : followUser(me!.id, user.id)
                  }
                >
                  {following ? '已关注' : '关注'}
                </Button>
                <button
                  onClick={() => toggleLike(me!.id, user.id)}
                  aria-label={liked ? '取消点赞' : '点赞'}
                  title={liked ? '已点赞（匿名）' : '点赞（匿名）'}
                  className={`flex h-8 items-center gap-1 rounded-lg border px-2.5 text-[12px] transition-colors ${
                    liked
                      ? 'border-seal/40 bg-seal/10 text-seal'
                      : 'border-line text-faint hover:border-line2 hover:text-muted'
                  }`}
                >
                  <Icon name="heart" size={15} fill={liked ? 'currentColor' : 'none'} />
                  点赞
                </button>
              </div>
            )}

            {p.followers && (
              <div className="mt-2.5 flex items-center gap-3 text-[11.5px] text-faint">
                <span>
                  关注 <span className="text-muted">{followingCount}</span>
                </span>
                <span>
                  被关注 <span className="text-muted">{followerCount}</span>
                </span>
              </div>
            )}

            {p.bio && (
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
                {user.bio}
              </p>
            )}

            {(p.prefs || p.favRoles) && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {p.prefs &&
                  user.prefs.plays.map((k) => {
                    const opt = PLAY_OPTIONS.find((x) => x.key === k)
                    return opt ? <Tag key={k}>{opt.label}</Tag> : null
                  })}
                {p.prefs && user.prefs.locations.map((c) => <Tag key={c}>{c}</Tag>)}
                {p.favRoles && user.favRoles.slice(0, 4).map((r) => <Tag key={r}>喜欢 {r}</Tag>)}
              </div>
            )}
          </div>
        </div>

        {p.events && (
          <>
            <div className="relative grid grid-cols-3 divide-x divide-line border-t border-line">
              {[
                { label: '玩过的桌游', value: stat.board },
                { label: '玩过的剧本', value: stat.script },
                { label: '玩过的其他', value: stat.other },
              ].map((s) => (
                <div key={s.label} className="py-2.5 text-center">
                  <div className="font-display text-[17px] tabular-nums text-paper">{s.value}</div>
                  <div className="text-[10.5px] text-faint">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="relative border-t border-line px-4 py-2 text-center text-[11px] text-faint">
              主持过 {stat.hostedTotal} 场
              {stat.hostedTotal > 0 &&
                `（剧本 ${stat.hostedScript} · 其他 ${stat.hostedOther}）`}
            </div>
          </>
        )}
      </div>

      {/* 主持人 */}
      {user.host.enabled && p.host && (
        <section className="mt-6 rounded-2xl border border-brass/25 bg-brass/[0.04] p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Icon name="sparkle" size={15} className="text-brass" />
            <h2 className="font-display text-[16px] text-paper">主持人</h2>
            {user.host.types.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>
          <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
            <span className="tabular-nums">带过 {stat.hostedTotal} 场</span>
          </div>
          {hostedGames.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {hostedGames.map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </div>
          )}
          {user.host.intro && (
            <p className="text-[12.5px] leading-relaxed text-muted">{user.host.intro}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-faint">
            {user.host.venues.length > 0 && <span>常驻：{user.host.venues.join(' / ')}</span>}
            {user.host.contact && <span>联系：{user.host.contact}</span>}
          </div>
        </section>
      )}

      {/* 偏好：有内容才展示，全空整段隐藏 */}
      {p.prefs && hasPrefs && (
        <section className="mt-6">
          <h2 className="mb-3 font-display text-[16px] text-paper">偏好</h2>
          <div className="space-y-3">
            {user.prefs.durationRange && (
              <div className="flex items-baseline justify-between rounded-xl border border-line bg-surface/60 px-3.5 py-2.5 text-[12.5px]">
                <span className="text-muted">舒适时长</span>
                <span className="text-paper tabular-nums">
                  {durationText(user.prefs.durationRange[0])} – {durationText(user.prefs.durationRange[1])}
                </span>
              </div>
            )}
            {user.prefs.locations.length > 0 && (
              <div className="flex items-baseline justify-between rounded-xl border border-line bg-surface/60 px-3.5 py-2.5 text-[12.5px]">
                <span className="text-muted">常去</span>
                <span className="text-paper">{user.prefs.locations.join(' / ')}</span>
              </div>
            )}
            {user.prefs.boards.length > 0 && (
              <div className="rounded-xl border border-line bg-surface/60 p-3.5">
                <div className="mb-2 font-display text-[14px] text-paper">狼人杀板子</div>
                <div className="flex flex-wrap gap-1.5">
                  {user.prefs.boards.map((b) => (
                    <span
                      key={b}
                      className="rounded border border-line px-1.5 py-0.5 text-[11px] text-muted"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {kinds.map((k) => {
              const maxD = user.prefs.maxDifficulty[k]
              const tags = user.prefs.tags[k] ?? []
              const facets = facetsOf(k)
                .map((f) => ({ ...f, tags: f.tags.filter((t) => tags.includes(t)) }))
                .filter((f) => f.tags.length)
              return (
                <div key={k} className="rounded-xl border border-line bg-surface/60 p-3.5">
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="font-display text-[14px] text-paper">{KIND_LABEL[k]}</span>
                    {maxD ? (
                      <span className="text-[11.5px] text-faint">
                        难度上限 {difficultyLabel(k, maxD)}
                      </span>
                    ) : null}
                  </div>
                  {facets.length ? (
                    <div className="space-y-1.5">
                      {facets.map((f) => (
                        <div key={f.key} className="flex flex-wrap items-baseline gap-1.5">
                          <span className="text-[11px] text-faint">{f.label}</span>
                          {f.tags.map((t) => (
                            <span
                              key={t}
                              className="rounded border border-line px-1.5 py-0.5 text-[11px] text-muted"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11.5px] text-faint">没有填写类型偏好</p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 展柜：有内容才展示 */}
      {showcase.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 font-display text-[16px] text-paper">展柜</h2>
          {!p.showcase ? (
            <EmptyState icon="eyeOff" title="展柜已设为私密" desc="对方未公开这部分内容。" />
          ) : (
            <ShowcaseGrid items={showcase} games={db.games} />
          )}
        </section>
      )}

      {/* 他发的车 */}
      {p.events && hosted.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 font-display text-[16px] text-paper">发起的活动</h2>
          <div className="space-y-2.5">
            {hosted.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
