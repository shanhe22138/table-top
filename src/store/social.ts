import { mutate, uid } from './db'
import type { DBShape, Game, Post, PostComment, Seat, User } from '../types'

/* ───────── 关注 ───────── */

export function followUser(myId: string, targetId: string) {
  if (myId === targetId) return
  mutate((db) => {
    const me = db.users.find((u) => u.id === myId)
    const them = db.users.find((u) => u.id === targetId)
    if (!me || !them) return
    if (!me.following.includes(targetId)) me.following = [...me.following, targetId]
    if (!them.followers.includes(myId)) them.followers = [...them.followers, myId]
  })
}

export function unfollowUser(myId: string, targetId: string) {
  mutate((db) => {
    const me = db.users.find((u) => u.id === myId)
    const them = db.users.find((u) => u.id === targetId)
    if (!me || !them) return
    me.following = me.following.filter((x) => x !== targetId)
    them.followers = them.followers.filter((x) => x !== myId)
  })
}

/* ───────── 匿名点赞（除日志外不展示） ───────── */

export function toggleLike(myId: string, targetId: string) {
  if (myId === targetId) return
  mutate((db) => {
    const me = db.users.find((u) => u.id === myId)
    if (!me) return
    if (me.likedUsers.includes(targetId))
      me.likedUsers = me.likedUsers.filter((x) => x !== targetId)
    else me.likedUsers = [...me.likedUsers, targetId]
  })
}

/* ───────── 搜索 ───────── */

export function searchUsers(db: DBShape, q: string, limit = 20): User[] {
  const s = q.trim().toLowerCase()
  if (!s) return []
  return db.users
    .filter(
      (u) =>
        u.nickname.toLowerCase().includes(s) ||
        u.username.toLowerCase().includes(s) ||
        u.uid.toLowerCase().includes(s),
    )
    .slice(0, limit)
}

export function searchGames(db: DBShape, q: string, limit = 20): Game[] {
  const s = q.trim().toLowerCase()
  if (!s) return []
  return db.games
    .filter(
      (g) =>
        g.title.toLowerCase().includes(s) ||
        g.subtitle.toLowerCase().includes(s) ||
        g.publisher.toLowerCase().includes(s) ||
        g.tags.some((t) => t.toLowerCase().includes(s)),
    )
    .slice(0, limit)
}

/* ───────── 导出 ───────── */

export function toCSV(rows: Record<string, unknown>[], columns: string[]): string {
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const head = columns.join(',')
  const body = rows
    .map((r) => columns.map((c) => esc(r[c])).join(','))
    .join('\n')
  return `${head}\n${body}`
}

/* ───────── 心测 / 角色分配 / 候补 ───────── */

/** 玩家上车时提交心测答案（启用心测的场次，玩家不能自选角色） */
export function submitPsych(
  eventId: string,
  seatId: string,
  answers: Record<string, string>,
  info: { name: string; contact?: string | null; note?: string | null },
) {
  mutate((db) => {
    const e = db.events.find((x) => x.id === eventId)
    const seat = e?.seats.find((s) => s.id === seatId)
    if (!e || !seat) return
    seat.psychAnswers = answers
    seat.name = info.name
    seat.contact = info.contact ?? null
    seat.note = info.note ?? null
    seat.status = 'pending' // 等待车头根据心测结果分配角色
  })
}

/** 车头手动分配角色 */
export function assignRole(eventId: string, seatId: string, roleName: string) {
  mutate((db) => {
    const e = db.events.find((x) => x.id === eventId)
    const seat = e?.seats.find((s) => s.id === seatId)
    if (!e || !seat) return
    seat.roleName = roleName || null
    seat.status = roleName ? 'filled' : 'pending'
  })
}

/** 车头添加候补位玩家 */
export function addWaitlist(
  eventId: string,
  info: { name: string; contact?: string | null; note?: string | null; roleName?: string | null },
) {
  mutate((db) => {
    const e = db.events.find((x) => x.id === eventId)
    if (!e) return
    const index = e.seats.length
    const seat: Seat = {
      id: uid('st'),
      index,
      userId: null,
      name: info.name,
      contact: info.contact ?? null,
      note: info.note ?? null,
      status: 'waitlist',
      roleName: info.roleName ?? null,
    }
    e.seats.push(seat)
  })
}

/** 车头把候补转为正式（补上角色与联系方式） */
export function promoteWaitlist(
  eventId: string,
  seatId: string,
  info: { roleName?: string | null; contact?: string | null },
) {
  mutate((db) => {
    const e = db.events.find((x) => x.id === eventId)
    const seat = e?.seats.find((s) => s.id === seatId)
    if (!e || !seat) return
    seat.status = 'filled'
    if (info.roleName !== undefined) seat.roleName = info.roleName
    if (info.contact !== undefined) seat.contact = info.contact
  })
}

export function removeSeat(eventId: string, seatId: string) {
  mutate((db) => {
    const e = db.events.find((x) => x.id === eventId)
    if (!e) return
    e.seats = e.seats.filter((s) => s.id !== seatId)
  })
}

/* ───────── 站台社区 ───────── */

/** 发一条动态；内容与配图都为空时返回 null（不发） */
export function createPost(input: {
  authorId: string
  authorName: string
  authorUid: string
  text: string
  image?: string | null
}): string | null {
  const text = input.text.trim()
  if (!text && !input.image) return null
  let id = ''
  mutate((db) => {
    const post: Post = {
      id: uid('p'),
      authorId: input.authorId,
      authorName: input.authorName,
      authorUid: input.authorUid,
      text,
      image: input.image ?? null,
      likes: [],
      comments: [],
      createdAt: new Date().toISOString(),
    }
    id = post.id
    db.posts.unshift(post)
  })
  return id
}

/** 点赞 / 取消点赞（记录点赞者 userId，不展示给他人） */
export function togglePostLike(postId: string, userId: string) {
  mutate((db) => {
    const p = db.posts.find((x) => x.id === postId)
    if (!p) return
    if (p.likes.includes(userId)) p.likes = p.likes.filter((u) => u !== userId)
    else p.likes = [...p.likes, userId]
  })
}

/** 在帖子下评论 */
export function addPostComment(
  postId: string,
  input: { authorId: string; authorName: string; authorUid: string; text: string },
) {
  const text = input.text.trim()
  if (!text) return
  mutate((db) => {
    const p = db.posts.find((x) => x.id === postId)
    if (!p) return
    const c: PostComment = {
      id: uid('pc'),
      authorId: input.authorId,
      authorName: input.authorName,
      authorUid: input.authorUid,
      text,
      createdAt: new Date().toISOString(),
    }
    p.comments.push(c)
  })
}
