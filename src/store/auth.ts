import { getBackend } from '../lib/backend'
import type { AuthResult } from '../lib/backend/types'
import { mutate, reloadDB, useDB } from './db'
import { EMPTY_PREFS } from '../types'
import type { HostProfile, Prefs, Privacy, User, UserRole } from '../types'

/** 登录名规则：2–16 位，中英文、数字、下划线都可以 */
export const USERNAME_RE = /^[\w\u4e00-\u9fa5]{2,16}$/u

export { EMPTY_PREFS }

function validate(input: { username: string; password: string; nickname: string }): string | null {
  if (!USERNAME_RE.test(input.username.trim()))
    return '登录名需要 2–16 位，可以用中英文、数字、下划线'
  if (input.password.length < 6) return '密码至少 6 位'
  const n = input.nickname.trim()
  if (n.length < 2 || n.length > 12) return '昵称需要 2–12 个字符'
  return null
}

export async function signUp(input: {
  username: string
  password: string
  nickname: string
  email?: string | null
}): Promise<AuthResult> {
  const bad = validate(input)
  if (bad) return { ok: false, error: bad }
  const res = await getBackend().auth.signUp({
    username: input.username.trim(),
    password: input.password,
    nickname: input.nickname.trim(),
    email: input.email?.trim() || null,
  })
  if (res.ok && getBackend().kind === 'rest') await reloadDB()
  return res
}

export async function signIn(input: {
  username: string
  password: string
}): Promise<AuthResult> {
  if (!input.username.trim() || !input.password) return { ok: false, error: '登录名和密码都要填' }
  const res = await getBackend().auth.signIn({
    username: input.username.trim(),
    password: input.password,
  })
  if (res.ok && getBackend().kind === 'rest') await reloadDB()
  return res
}

export async function signOut() {
  await getBackend().auth.signOut()
  if (getBackend().kind === 'rest') await reloadDB()
}

export function useAuth() {
  const db = useDB()
  const user = db.users.find((u) => u.id === db.sessionUserId) ?? null
  const ownerId = db.settings?.[0]?.ownerId ?? null
  const isOwner = !!user && (user.role === 'owner' || user.id === ownerId)
  const isAdmin = isOwner || user?.role === 'admin'
  return { user, isLoggedIn: !!user, isAdmin, isOwner }
}

export function updateProfile(userId: string, patch: Partial<User>) {
  mutate((db) => {
    const u = db.users.find((x) => x.id === userId)
    if (!u) return
    // 登录名 / uid / 角色 / 密码等身份字段不可经此接口修改，保证登录名永久唯一不可变
    const {
      username: _u,
      id: _id,
      uid: _uid,
      role: _role,
      passwordHash: _ph,
      createdAt: _ca,
      following: _f1,
      followers: _f2,
      likedUsers: _lu,
      ...safe
    } = patch
    void _u
    void _id
    void _uid
    void _role
    void _ph
    void _ca
    void _f1
    void _f2
    void _lu
    Object.assign(u, safe)
  })
}

export function updatePrefs(userId: string, patch: Partial<Prefs>) {
  mutate((db) => {
    const u = db.users.find((x) => x.id === userId)
    if (!u) return
    u.prefs = { ...u.prefs, ...patch }
  })
}

export function updateHost(userId: string, patch: Partial<HostProfile>) {
  mutate((db) => {
    const u = db.users.find((x) => x.id === userId)
    if (!u) return
    u.host = { ...u.host, ...patch }
  })
}

export function updatePrivacy(userId: string, patch: Partial<Privacy>) {
  mutate((db) => {
    const u = db.users.find((x) => x.id === userId)
    if (!u) return
    u.privacy = { ...u.privacy, ...patch }
  })
}

/** 站长授予 / 收回管理员 */
export function setUserRole(userId: string, role: UserRole) {
  mutate((db) => {
    const u = db.users.find((x) => x.id === userId)
    if (!u) return
    if (u.role === 'owner') return
    u.role = role
  })
}

/** 站长身份转移（原站长降为管理员） */
export function transferOwner(userId: string) {
  mutate((db) => {
    for (const u of db.users) {
      if (u.role === 'owner') u.role = 'admin'
    }
    const next = db.users.find((x) => x.id === userId)
    if (next) next.role = 'owner'
    if (!db.settings.length) return
    db.settings[0].ownerId = userId
  })
}
