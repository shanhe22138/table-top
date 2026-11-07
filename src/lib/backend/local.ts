import type { DBShape, Game, GameEvent, User } from '../../types'
import { EMPTY_HOST, EMPTY_PREFS, DEFAULT_PRIVACY, normalizeUser } from '../../types'
import { SEED_CHART, SEED_LOGS, buildSeed, hashPassword } from '../../data/seed'
import { DEFAULT_TAXONOMY, defaultSettings } from '../taxonomy'
import { emptyState, type AuthResult, type Backend, type BackendIO, type Op, type Session } from './types'
import { IS_BROWSER, storageGet, storageRemove, storageSet } from '../platform'

const STORAGE_KEY = 'table-top.db.v3'
const PREVIOUS_STORAGE_KEY = 'kaiju.db.v3'
const LEGACY_KEY = 'kaiju.db.v2'

/**
 * localStorage 在沙箱 iframe / 隐私模式下会直接抛异常，
 * 这里统一包一层：拿不到就退化到内存，页面至少能跑起来。
 */
const storage = (() => {
  let available = true
  let memory: string | null = null
  if (IS_BROWSER) {
    try {
      const probe = '__table_top_probe__'
      storageSet(probe, '1')
      storageRemove(probe)
    } catch {
      available = false
    }
  }
  return {
    get available() {
      return available
    },
    get(key: string): string | null {
      if (!available) return memory
      try {
        return storageGet(key)
      } catch {
        return memory
      }
    },
    set(key: string, value: string) {
      if (available) {
        try {
          storageSet(key, value)
          return
        } catch {
          available = false
        }
      }
      memory = value
    },
    remove(key: string) {
      if (available) {
        try {
          storageRemove(key)
        } catch {
          /* ignore */
        }
      }
      memory = null
    },
  }
})()

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

/* ───────── v2 → v3 迁移 ───────── */

const OLD_TAG_MAP: Record<string, string> = {
  苗疆: '古风',
  轻策: '策略',
  中策: '策略',
  重策: '策略',
  派对: '聚会',
  推理: '隐藏身份',
  引擎: '引擎构筑',
  交易: '经济',
  太空: '科幻',
}

const CITY_MAP: Record<string, string> = {
  上海: '浦东',
  北京: '青浦',
  成都: '浦东',
  深圳: '青浦',
}

function migrateGame(raw: Record<string, unknown>): Game {
  const kind = (raw.kind === 'board' ? 'board' : 'script') as Game['kind']
  const pool = new Set(DEFAULT_TAXONOMY[kind] ?? [])
  const tags = Array.from(
    new Set(
      ((raw.tags as string[]) ?? [])
        .map((t) => OLD_TAG_MAP[t] ?? t)
        .filter((t) => pool.has(t)),
    ),
  )
  return { ...(raw as unknown as Game), kind, tags }
}

function migrateUser(raw: Record<string, unknown>, idx: number): User {
  const old = (raw.prefs ?? {}) as Record<string, unknown>
  const kinds = (old.kinds as string[]) ?? []
  const plays: string[] = []
  if (kinds.includes('script')) plays.push('script')
  if (kinds.includes('board')) plays.push('board')
  const maxD = (old.maxDifficulty as number | null) ?? null
  const gs = (old.groupSize as number | null) ?? null
  const oldTags = (old.tags as string[]) ?? []
  const scriptSet = new Set(DEFAULT_TAXONOMY.script)
  const boardSet = new Set(DEFAULT_TAXONOMY.board)

  return normalizeUser({
    ...(raw as unknown as User),
    role: (raw.role as User['role']) ?? (idx === 0 ? 'owner' : 'user'),
    prefs: {
      plays,
      locations: ((old.cities as string[]) ?? []).map((c) => CITY_MAP[c] ?? c),
      durationRange: old.maxDuration ? [60, old.maxDuration as number] : null,
      maxDifficulty: maxD ? { script: maxD, board: maxD } : {},
      tags: {
        script: oldTags.filter((t) => scriptSet.has(t)),
        board: oldTags.filter((t) => boardSet.has(t)),
      },
      boards: [],
    },
  })
}

function migrateEvent(raw: Record<string, unknown>): GameEvent {
  const e = raw as unknown as GameEvent
  return { ...e, city: CITY_MAP[e.city] ?? e.city }
}

function migrateV2(old: Record<string, unknown>): DBShape {
  const users = ((old.users as Record<string, unknown>[]) ?? []).map(migrateUser)
  const owner = users.find((u) => u.role === 'owner') ?? users[0]
  return {
    version: 3,
    users,
    games: ((old.games as Record<string, unknown>[]) ?? []).map(migrateGame),
    reviews: (old.reviews as DBShape['reviews']) ?? [],
    events: ((old.events as Record<string, unknown>[]) ?? []).map(migrateEvent),
    showcase: (old.showcase as DBShape['showcase']) ?? [],
    posts: [],
    logs: [],
    charts: [clone(SEED_CHART)],
    settings: [defaultSettings(owner?.id ?? null)],
    feedbacks: [],
    sessionUserId: (old.sessionUserId as string | null) ?? null,
  }
}

export function createLocalBackend(io: BackendIO): Backend {
  let persisted = false

  function persist(db: DBShape) {
    storage.set(STORAGE_KEY, JSON.stringify(db))
  }

  function readSession(db: DBShape): Session | null {
    if (!db.sessionUserId) return null
    const u = db.users.find((x) => x.id === db.sessionUserId)
    if (!u) return null
    return { userId: u.id, username: u.username, nickname: u.nickname }
  }

  async function freshDB(): Promise<DBShape> {
    const seed = await buildSeed()
    return {
      version: 3,
      users: seed.users.map(normalizeUser),
      games: seed.games,
      reviews: seed.reviews,
      events: seed.events,
      showcase: seed.showcase,
      posts: [],
      logs: SEED_LOGS.map((l) => ({ ...l })),
      charts: [clone(SEED_CHART)],
      settings: [defaultSettings(seed.users.find((u) => u.role === 'owner')?.id ?? null)],
      feedbacks: [],
      sessionUserId: null,
    }
  }

  return {
    kind: 'local',
    label: storage.available ? '本地存储' : '临时内存',

    async init() {
      persisted = storage.available
    },

    async load(): Promise<DBShape> {
      const current = storage.get(STORAGE_KEY)
      const raw = current ?? storage.get(PREVIOUS_STORAGE_KEY)
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as DBShape
          if (parsed && parsed.version === 3 && Array.isArray(parsed.games)) {
            // 老数据可能缺新集合，补齐
            parsed.logs ??= []
            parsed.charts ??= []
            parsed.posts ??= []
            parsed.feedbacks ??= []
            parsed.settings ??= [defaultSettings(null)]
            parsed.users = parsed.users.map((u) => normalizeUser(u))
            if (!current) {
              persist(parsed)
              storage.remove(PREVIOUS_STORAGE_KEY)
            }
            return parsed
          }
        } catch {
          /* 坏数据直接重建 */
        }
      }

      // 从 v2 迁移
      const legacy = storage.get(LEGACY_KEY)
      if (legacy) {
        try {
          const old = JSON.parse(legacy) as Record<string, unknown>
          if (old && Array.isArray(old.games)) {
            const migrated = migrateV2(old)
            persist(migrated)
            storage.remove(LEGACY_KEY)
            return migrated
          }
        } catch {
          /* ignore */
        }
      }

      const db = await freshDB()
      persist(db)
      return db
    },

    async apply(_ops: Op[]) {
      const db = io.getState()
      if (!db) return
      persist(db)
    },

    auth: {
      async signUp(input): Promise<AuthResult> {
        const db = io.getState()
        if (!db) return { ok: false, error: '数据还没准备好，稍后再试' }
        const username = input.username.trim().toLowerCase()
        const nickname = input.nickname.trim()
        if (!/^[\w一-龥]{2,16}$/u.test(username))
          return { ok: false, error: '登录名需要 2–16 位，可以用中英文、数字、下划线' }
        if (input.password.length < 6) return { ok: false, error: '密码至少 6 位' }
        if (nickname.length < 2 || nickname.length > 12)
          return { ok: false, error: '昵称需要 2–12 个字符' }
        if (db.users.some((u) => u.username.toLowerCase() === username))
          return { ok: false, error: '这个登录名已经被用了' }
        if (db.users.some((u) => u.nickname === nickname))
          return { ok: false, error: '这个昵称被占用了，换一个吧' }

        const passwordHash = await hashPassword(input.password)
        const isFirst = db.users.length === 0
        const user: User = {
          id: `u_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
          username,
          email: input.email?.trim() || null,
          passwordHash,
          nickname,
          avatar: null,
          bio: '',
          role: isFirst ? 'owner' : 'user',
          prefs: clone(EMPTY_PREFS),
          favRoles: [],
          host: clone(EMPTY_HOST),
          privacy: clone(DEFAULT_PRIVACY),
          uid: `U${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
          showUsername: true,
          following: [],
          followers: [],
          likedUsers: [],
          createdAt: new Date().toISOString(),
        }
        const next = clone(db)
        next.users.push(user)
        next.sessionUserId = user.id
        if (isFirst) {
          if (!next.settings.length) next.settings.push(defaultSettings(user.id))
          else next.settings[0].ownerId = user.id
        }
        io.setState(next)
        persist(next)
        io.notify()
        return { ok: true, session: { userId: user.id, username: user.username, nickname: user.nickname } }
      },

      async signIn(input): Promise<AuthResult> {
        const db = io.getState()
        if (!db) return { ok: false, error: '数据还没准备好，稍后再试' }
        const username = input.username.trim().toLowerCase()
        const passwordHash = await hashPassword(input.password)
        const user = db.users.find(
          (u) => u.username.toLowerCase() === username && u.passwordHash === passwordHash,
        )
        if (!user) return { ok: false, error: '登录名或密码不对' }
        const next = clone(db)
        next.sessionUserId = user.id
        io.setState(next)
        persist(next)
        io.notify()
        return { ok: true, session: { userId: user.id, username: user.username, nickname: user.nickname } }
      },

      async signOut() {
        const db = io.getState()
        if (!db) return
        const next = clone(db)
        next.sessionUserId = null
        io.setState(next)
        persist(next)
        io.notify()
      },

      async restore() {
        const db = io.getState()
        return db ? readSession(db) : null
      },
    },

    async reset() {
      storage.remove(STORAGE_KEY)
      storage.remove(PREVIOUS_STORAGE_KEY)
      storage.remove(LEGACY_KEY)
      const db = await freshDB()
      io.setState(db)
      persist(db)
      io.notify()
    },

    async feedback(input) {
      const db = io.getState()
      if (!db) return { ok: false, error: '数据还没准备好，稍后再试', stored: false }
      const next = clone(db)
      const me = next.users.find((u) => u.id === next.sessionUserId) ?? null
      next.feedbacks.push({
        id: `fb_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
        fromUserId: me?.id ?? null,
        fromName: input.fromName || me?.nickname || '匿名',
        email: input.email,
        subject: input.subject,
        content: input.content,
        createdAt: new Date().toISOString(),
      })
      io.setState(next)
      persist(next)
      io.notify()
      return { ok: true, stored: true, emailed: false }
    },
  }
}

export const storageAvailable = storage.available
export { emptyState }
