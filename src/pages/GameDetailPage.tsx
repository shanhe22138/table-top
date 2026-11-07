import { useMemo, useRef, useState } from 'react'
import { mutate, uid, useDB } from '../store/db'
import { useAuth } from '../store/auth'
import { href, navigate } from '../lib/router'
import { CoverArt } from '../components/CoverArt'
import { Icon } from '../components/Icons'
import { Avatar, Button, EmptyState, Field, Sheet, Stars, Tag } from '../components/ui'
import { EventCard } from '../components/cards'
import { Slider } from '@tarojs/components'
import { KIND_LABEL, difficultyLabel, type Game } from '../types'
import { dateKeyOf, durationText, formatTime, gameTitle, relativeDay } from '../lib/format'
import { COVER_SIZE, pickImage, readImageAsDataUrl } from '../lib/image'
import { IS_BROWSER, IS_MINI } from '../lib/platform'
import { facetsOf } from '../lib/taxonomy'
import Link from '../components/Link'

export default function GameDetailPage({ id }: { id: string }) {
  const db = useDB()
  const { user, isAdmin } = useAuth()
  const game = db.games.find((g) => g.id === id)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [rating, setRating] = useState(9)
  const [content, setContent] = useState('')
  const [err, setErr] = useState('')
  const [toast, setToast] = useState('')
  const coverRef = useRef<HTMLInputElement>(null)

  const reviews = useMemo(
    () => db.reviews.filter((r) => r.gameId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [db.reviews, id],
  )

  const events = useMemo(
    () =>
      db.events
        .filter((e) => e.gameId === id && e.status !== 'cancelled' && new Date(e.startAt).getTime() > Date.now() - 3600000)
        .sort((a, b) => a.startAt.localeCompare(b.startAt))
        .slice(0, 4),
    [db.events, id],
  )

  if (!game) {
    return (
      <EmptyState
        icon="info"
        title="找不到这个条目"
        desc="它可能被删除了。"
        action={<Button onClick={() => navigate('/library')}>回到仓库</Button>}
      />
    )
  }

  const reviewAvg = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : null

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  async function changeCover() {
    if (!game) return
    try {
      const dataUrl = await pickImage({ width: COVER_SIZE.width, height: COVER_SIZE.height })
      if (!dataUrl) return
      mutate((d) => {
        const target = d.games.find((x) => x.id === game.id)
        if (target) target.cover = dataUrl
      })
      flash('封面已更新')
    } catch {
      flash('图片读取失败')
    }
  }

  function addToShowcase(g: Game) {
    if (!user) {
      navigate('/login')
      return
    }
    mutate((d) => {
      const exists = d.showcase.some((s) => s.userId === user.id && s.type === 'game' && s.gameId === g.id)
      if (exists) return
      d.showcase.push({
        id: uid('sh'),
        userId: user.id,
        type: 'game',
        gameId: g.id,
        title: g.title,
        subtitle: `${g.kind === 'script' ? '剧本杀' : '桌游'} · ${g.rating.toFixed(1)} 分`,
        note: '',
        image: null,
        createdAt: new Date().toISOString(),
      })
    })
    flash('已加入你的展柜')
  }

  function submitReview() {
    if (!user) {
      navigate('/login')
      return
    }
    if (content.trim().length < 5) {
      setErr('评测内容至少 5 个字')
      return
    }
    mutate((d) => {
      d.reviews.push({
        id: uid('r'),
        gameId: game!.id,
        userId: user.id,
        userName: user.nickname,
        rating,
        content: content.trim(),
        createdAt: new Date().toISOString(),
      })
    })
    setContent('')
    setErr('')
    setReviewOpen(false)
    flash('评测已发布')
  }

  return (
    <div className="anim-rise">
      <button
        onClick={() => history.length > 1 ? history.back() : navigate('/library')}
        className="mb-3 inline-flex items-center gap-1 text-[13px] text-faint transition-colors hover:text-paper"
      >
        <Icon name="left" size={15} /> 返回
      </button>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-line">
        <div className="absolute inset-0">
          <div className="absolute inset-0 scale-110 blur-2xl opacity-40">
            <CoverArt game={game} />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/90 to-ink/40" />
        </div>

        <div className="relative flex flex-col gap-4 p-4 sm:flex-row sm:gap-6 sm:p-6">
          <div className="relative mx-auto aspect-[3/4] w-[132px] shrink-0 overflow-hidden rounded-xl border border-line2 shadow-xl sm:mx-0 sm:w-[176px]">
            <CoverArt game={game} />
            {isAdmin && (
              <button
                onClick={() => IS_BROWSER ? coverRef.current?.click() : void changeCover()}
                className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/65 py-1.5 text-[10.5px] text-paper backdrop-blur transition-colors hover:bg-black/80"
              >
                <Icon name="image" size={11} /> 换封面
              </button>
            )}
            {IS_BROWSER && <input
              ref={coverRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                try {
                  const dataUrl = await readImageAsDataUrl(f, {
                    width: COVER_SIZE.width,
                    height: COVER_SIZE.height,
                  })
                  mutate((d) => {
                    const g = d.games.find((x) => x.id === game.id)
                    if (g) g.cover = dataUrl
                  })
                  flash('封面已更新')
                } catch {
                  flash('图片读取失败')
                }
              }}
            />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded bg-surface2 px-1.5 py-0.5 text-[10.5px] text-muted">
                {KIND_LABEL[game.kind]}
              </span>
              {game.tags.slice(0, 4).map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </div>

            <h1 className="mt-2 font-display text-[24px] leading-tight tracking-wide text-paper sm:text-[28px]">
              {gameTitle(game)}
            </h1>
            {game.subtitle && <p className="mt-1 text-[13px] text-muted">{game.subtitle}</p>}

            <div className="mt-3 flex items-end gap-4">
              <div>
                <div className="font-display text-[30px] leading-none text-brass">
                  {game.rating.toFixed(1)}
                </div>
                <div className="mt-1 text-[10.5px] text-faint">{game.ratingCount} 人评分</div>
              </div>
              <div className="pb-1">
                <Stars value={game.rating} size={15} />
                <div className="mt-1 text-[10.5px] text-faint">
                  {game.rating >= 8.5 ? '好评如潮' : game.rating >= 8 ? '特别好评' : '多半好评'}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[12px] sm:grid-cols-4">
              <Meta
                label="人数"
                value={
                  game.minPlayers === game.maxPlayers
                    ? `${game.maxPlayers} 人`
                    : `${game.minPlayers}-${game.maxPlayers} 人`
                }
              />
              <Meta label="时长" value={durationText(game.durationMin)} />
              <Meta label="难度" value={difficultyLabel(game.kind, game.difficulty)} />
              <Meta label="发行" value={game.publisher} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => navigate(`/create?game=${game.id}`)}>
                <Icon name="plus" size={15} /> 用它发车
              </Button>
              <Button variant="outline" onClick={() => addToShowcase(game)}>
                <Icon name="sparkle" size={15} /> 加入展柜
              </Button>
              <Button variant="ghost" onClick={() => setReviewOpen(true)}>
                <Icon name="edit" size={15} /> 写评测
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 简介 */}
      <section className="mt-6">
        <h2 className="mb-2 font-display text-[16px] text-paper">简介</h2>
        <p className="text-[13.5px] leading-[1.9] text-muted">{game.description}</p>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-[11.5px] text-faint">
          <span>作者：{game.author}</span>
          <span>发行年份：{game.year}</span>
          <span>玩法：{KIND_LABEL[game.kind]}</span>
        </div>
      </section>

      {/* 分类 */}
      <section className="mt-6">
        <h2 className="mb-2 font-display text-[16px] text-paper">分类</h2>
        <div className="space-y-2 rounded-xl border border-line bg-surface/50 p-3.5">
          {facetsOf(game.kind)
            .map((f) => ({ ...f, tags: f.tags.filter((t) => game.tags.includes(t)) }))
            .filter((f) => f.tags.length)
            .map((f) => (
              <div key={f.key} className="flex flex-wrap items-center gap-1.5">
                <span className="w-16 shrink-0 text-[11.5px] text-faint">{f.label}</span>
                {f.tags.map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
              </div>
            ))}
          {game.tags.length === 0 && <p className="text-[12px] text-faint">还没有分类</p>}
        </div>
      </section>

      {/* 角色表 */}
      {game.roles && game.roles.length > 0 && (
        <section className="mt-7">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-display text-[16px] text-paper">角色表</h2>
            <span className="text-[11px] text-faint">{game.roles.length} 个角色</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {game.roles.map((r) => (
              <div key={r.name} className="rounded-xl border border-line bg-surface/60 p-3">
                <div className="flex items-center gap-2">
                  <span className="font-display text-[14.5px] text-paper">{r.name}</span>
                  <span className="rounded border border-line px-1.5 py-0.5 text-[10px] text-faint">
                    {r.gender}
                  </span>
                  <span className="ml-auto text-[10.5px] text-brass/80">
                    {'◆'.repeat(r.difficulty)}
                    <span className="text-line2">{'◆'.repeat(5 - r.difficulty)}</span>
                  </span>
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{r.brief}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 相关活动 */}
      {events.length > 0 && (
        <section className="mt-7">
          <h2 className="mb-2 font-display text-[16px] text-paper">正在拼车</h2>
          <div className="space-y-2.5">
            {events.map((e) => (
              <Link
                key={e.id}
                href={href(`/event/${e.id}`)}
                className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 hover:border-line2"
              >
                <div className="w-11 shrink-0 border-r border-line pr-2 text-center">
                  <div className="text-[10px] text-faint">{relativeDay(e.startAt)}</div>
                  <div className="text-[11px] text-brass">{formatTime(e.startAt)}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] text-paper">{e.title}</div>
                  <div className="mt-0.5 text-[11px] text-faint">
                    {e.city} · {e.venue}
                  </div>
                </div>
                <span className="shrink-0 text-[11px] tabular-nums text-muted">
                  {e.seats.filter((s) => s.status === 'filled').length}/{e.capacity}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 评测 */}
      <section className="mt-7">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-display text-[16px] text-paper">
            玩家评测
            <span className="ml-2 text-[12px] font-normal text-faint">{reviews.length} 条</span>
          </h2>
          {reviewAvg && (
            <span className="inline-flex items-center gap-1.5 text-[11.5px] text-faint">
              平均 <span className="text-brass">{reviewAvg.toFixed(1)}</span>
            </span>
          )}
        </div>

        {reviews.length ? (
          <div className="space-y-2.5">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-xl border border-line bg-surface/60 p-3.5">
                <div className="flex items-center gap-2">
                  <Link
                    href={href(`/u/${r.userId}`)}
                    className="group inline-flex items-center gap-2"
                    title={`查看 ${r.userName} 的资料`}
                  >
                    <Avatar name={r.userName} size={24} />
                    <span className="text-[12.5px] text-paper group-hover:text-brass">
                      {r.userName}
                    </span>
                  </Link>
                  <span className="ml-auto flex items-center gap-1.5">
                    <Stars value={r.rating} size={11} />
                    <span className="font-display text-[12px] text-brass">{r.rating.toFixed(0)}</span>
                  </span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">{r.content}</p>
                <div className="mt-1.5 text-[10.5px] text-faint">
                  {dateKeyOf(r.createdAt).replace(/-/g, '/')}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="edit"
            title="还没有人评测"
            desc="玩过的话，写两句给后面的人参考。"
            action={
              <Button size="sm" variant="outline" onClick={() => setReviewOpen(true)}>
                写第一条
              </Button>
            }
          />
        )}
      </section>

      <Sheet
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title={`评测${gameTitle(game)}`}
        subtitle="评分并写下体验，便于其他人参考"
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setReviewOpen(false)}>
              取消
            </Button>
            <Button className="flex-1" onClick={submitReview}>
              发布评测
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="打分" hint={`${rating} / 10`}>
            <div className="flex items-center gap-3">
              {IS_MINI ? <Slider min={1} max={10} step={1} value={rating} activeColor="#e2a85a"
                className="flex-1" onChange={(e) => setRating(Number(e.detail.value))} /> : <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="!border-0 !bg-transparent !p-0 accent-[#e2a85a]"
              />}
              <span className="w-10 shrink-0 text-right font-display text-[18px] text-brass">
                {rating}
              </span>
            </div>
          </Field>
          <Field label="说两句" error={err}>
            <textarea
              rows={5}
              value={content}
              onChange={(e) => {
                setContent(e.target.value)
                setErr('')
              }}
              placeholder="本子怎么样？DM 怎么样？适合什么人玩？"
            />
          </Field>
        </div>
      </Sheet>

      {toast && (
        <div className="anim-fade fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-line bg-surface2 px-4 py-2 text-[12.5px] text-paper shadow-xl">
          {toast}
        </div>
      )}
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10.5px] text-faint">{label}</div>
      <div className="mt-0.5 truncate text-[12.5px] text-paper">{value}</div>
    </div>
  )
}
