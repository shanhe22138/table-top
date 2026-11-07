import { useMemo, useState } from 'react'
import { useDB } from '../store/db'
import { useAuth } from '../store/auth'
import { createPost, togglePostLike, addPostComment } from '../store/social'
import { Avatar, Button, EmptyState, ImagePicker } from '../components/ui'
import { Icon } from '../components/Icons'
import { href, navigate } from '../lib/router'
import { formatDate } from '../lib/format'
import { COVER_SIZE, pickImage } from '../lib/image'
import type { Post } from '../types'
import Link from '../components/Link'
import { IS_BROWSER } from '../lib/platform'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} 天前`
  return formatDate(iso)
}

const MAX_LEN = 500

export default function PlatformPage() {
  const db = useDB()
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({})
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [toast, setToast] = useState('')

  const posts = useMemo(
    () => [...db.posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [db.posts],
  )

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  async function onImage() {
    try {
      setImage(await pickImage({ width: COVER_SIZE.width, height: COVER_SIZE.height }))
    } catch {
      flash('图片读取失败，换一张试试')
    }
  }

  function publish() {
    if (!user) return
    const t = text.trim()
    if (!t && !image) {
      flash('写点什么或者配张图')
      return
    }
    setBusy(true)
    const id = createPost({
      authorId: user.id,
      authorName: user.nickname,
      authorUid: user.uid,
      text: t,
      image,
    })
    setBusy(false)
    if (id) {
      setText('')
      setImage(null)
      flash('已发到站台')
    }
  }

  return (
    <div className="anim-rise">
      <div className="mb-4">
        <h1 className="font-display text-[26px] leading-tight tracking-wide text-paper">站台</h1>
        <p className="mt-1 text-[12.5px] text-faint">
          车友们在这聊天、约车、分享刚打完的战报。
        </p>
      </div>

      {/* 发帖 */}
      {user ? (
        <div className="mb-5 rounded-2xl border border-line bg-surface p-3.5">
          <div className="flex items-start gap-3">
            <Avatar name={user.nickname} src={user.avatar} size={36} />
            <textarea
              id="platform-composer"
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
              rows={3}
              placeholder="说点什么？找车友、约一场、吐槽一下刚翻的车……"
              className="!py-2 !text-[14px] min-h-[64px] resize-none"
            />
          </div>
          {image && (
            <div className="relative mt-2 ml-[52px] w-fit">
              <img src={image} alt="" className="max-h-40 rounded-lg border border-line" />
              <button
                onClick={() => setImage(null)}
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-surface2 text-faint hover:text-paper"
                aria-label="移除图片"
              >
                <Icon name="close" size={12} />
              </button>
            </div>
          )}
          <div className="mt-2.5 flex items-center gap-2">
            <label onClick={() => void onImage()} className="flex cursor-pointer items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[12px] text-faint transition-colors hover:border-line2 hover:text-paper">
              <Icon name="upload" size={14} />
              配图
            </label>
            <span className="text-[11px] text-faint tabular-nums">
              {text.length}/{MAX_LEN}
            </span>
            <Button
              className="ml-auto"
              size="sm"
              disabled={busy || (!text.trim() && !image)}
              onClick={publish}
            >
              发布
            </Button>
          </div>
        </div>
      ) : (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-dashed border-line bg-surface/40 px-4 py-3">
          <p className="text-[12.5px] text-faint">登录后才能在站台发帖、点赞、评论。</p>
          <Link
            href={href('/login')}
            className="shrink-0 rounded-lg bg-brass px-3 py-1.5 text-[12px] font-semibold text-[#1a1206]"
          >
            登录
          </Link>
        </div>
      )}

      {/* 信息流 */}
      {posts.length === 0 ? (
        <EmptyState
          icon="users"
          title="站台还空着"
          desc="还没人发过动态，来当第一个吧。"
          action={
            user ? (
              <Button size="sm" onClick={() => {
                if (IS_BROWSER) document.getElementById('platform-composer')?.focus()
              }}>
                去发一条
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              user={user}
              commentsOpen={!!openComments[p.id]}
              draft={draft[p.id] ?? ''}
              onToggleComments={() =>
                setOpenComments((s) => ({ ...s, [p.id]: !s[p.id] }))
              }
              onDraft={(v) => setDraft((s) => ({ ...s, [p.id]: v }))}
              onComment={() => {
                if (!user) {
                  navigate('/login')
                  return
                }
                addPostComment(p.id, {
                  authorId: user.id,
                  authorName: user.nickname,
                  authorUid: user.uid,
                  text: draft[p.id] ?? '',
                })
                setDraft((s) => ({ ...s, [p.id]: '' }))
              }}
              onLike={() => {
                if (!user) {
                  navigate('/login')
                  return
                }
                togglePostLike(p.id, user.id)
              }}
            />
          ))}
        </div>
      )}

      {toast && (
        <div className="anim-fade fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-line bg-surface2 px-4 py-2 text-[12.5px] text-paper shadow-xl">
          {toast}
        </div>
      )}
    </div>
  )
}

function PostCard({
  post,
  user,
  commentsOpen,
  draft,
  onToggleComments,
  onDraft,
  onComment,
  onLike,
}: {
  post: Post
  user: ReturnType<typeof useAuth>['user']
  commentsOpen: boolean
  draft: string
  onToggleComments: () => void
  onDraft: (v: string) => void
  onComment: () => void
  onLike: () => void
}) {
  const liked = !!user && post.likes.includes(user.id)
  return (
    <article className="rounded-2xl border border-line bg-surface p-3.5">
      <div className="flex items-center gap-2.5">
        <Avatar name={post.authorName} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link
              href={href(`/u/${post.authorId}`)}
              className="truncate text-[14px] text-paper hover:text-brass"
            >
              {post.authorName}
            </Link>
            <span className="shrink-0 font-mono text-[10px] text-faint">{post.authorUid}</span>
          </div>
          <div className="text-[11px] text-faint">{timeAgo(post.createdAt)}</div>
        </div>
      </div>

      {post.text && (
        <p className="mt-2.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-muted">
          {post.text}
        </p>
      )}
      {post.image && (
        <img
          src={post.image}
          alt=""
          className="mt-2.5 max-h-80 w-full rounded-xl border border-line object-cover"
        />
      )}

      <div className="mt-3 flex items-center gap-4 border-t border-line/60 pt-2.5 text-[12px]">
        <button
          onClick={onLike}
          className={`flex items-center gap-1 transition-colors ${
            liked ? 'text-seal' : 'text-faint hover:text-muted'
          }`}
        >
          <Icon name="heart" size={15} fill={liked ? 'currentColor' : 'none'} />
          {post.likes.length > 0 ? post.likes.length : '赞'}
        </button>
        <button
          onClick={onToggleComments}
          className={`flex items-center gap-1 transition-colors ${
            commentsOpen ? 'text-brass' : 'text-faint hover:text-muted'
          }`}
        >
          <Icon name="comment" size={15} />
          {post.comments.length > 0 ? post.comments.length : '评论'}
        </button>
      </div>

      {commentsOpen && (
        <div className="mt-3 space-y-2 rounded-xl border border-line/60 bg-surface2/30 p-3">
          {post.comments.length === 0 && (
            <p className="text-[11.5px] text-faint">还没有评论，来说两句。</p>
          )}
          {post.comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2 text-[12.5px]">
              <Link
                href={href(`/u/${c.authorId}`)}
                className="shrink-0 text-paper hover:text-brass"
              >
                {c.authorName}
              </Link>
              <span className="min-w-0 flex-1 break-words text-muted">{c.text}</span>
              <span className="shrink-0 text-[10.5px] text-faint">{timeAgo(c.createdAt)}</span>
            </div>
          ))}
          {user && (
            <div className="flex items-center gap-2 pt-1">
              <input
                value={draft}
                onChange={(e) => onDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    onComment()
                  }
                }}
                placeholder="写条评论，回车发送"
                className="!py-1.5 !text-[12.5px] flex-1"
              />
              <Button size="sm" variant="ghost" onClick={onComment}>
                发送
              </Button>
            </div>
          )}
        </div>
      )}
    </article>
  )
}
