import type { DBShape } from '../../types'

/** 应用里所有需要持久化的集合。新增集合时只改这里 + types.ts */
export const TABLES = [
  'users',
  'games',
  'reviews',
  'events',
  'showcase',
  'posts',
  'logs',
  'charts',
  'settings',
  'feedbacks',
] as const
export type TableName = (typeof TABLES)[number]

/** 最小写入指令集：任何后端都能表达这三种操作 */
export type Op =
  | { t: 'insert'; table: TableName; row: Record<string, unknown> }
  | { t: 'update'; table: TableName; id: string; patch: Record<string, unknown> }
  | { t: 'delete'; table: TableName; id: string }

export interface Session {
  userId: string
  username: string
  nickname: string
}

export interface AuthResult {
  ok: boolean
  error?: string
  session?: Session
}

export interface SignUpInput {
  username: string
  password: string
  nickname: string
  email?: string | null
}

export interface Backend {
  /** 适配器类型，UI 上用来提示数据存在哪 */
  readonly kind: 'local' | 'rest'
  readonly label: string
  init(): Promise<void>
  load(): Promise<DBShape>
  apply(ops: Op[]): Promise<void>
  auth: {
    signUp(input: SignUpInput): Promise<AuthResult>
    signIn(input: { username: string; password: string }): Promise<AuthResult>
    signOut(): Promise<void>
    restore(): Promise<Session | null>
  }
  /** 仅本地适配器支持：清空并重建示例数据 */
  reset?(): Promise<void>
  /** 提交反馈 / issue（本地模式仅存本地，服务器模式尝试发邮件到站长邮箱） */
  feedback?(input: {
    subject: string
    content: string
    email: string | null
    fromName: string
  }): Promise<{ ok: boolean; error?: string; stored: boolean; emailed?: boolean }>
}

export interface BackendIO {
  getState(): DBShape | null
  setState(db: DBShape): void
  notify(): void
}

/** 计算两份状态之间的差异，转成写入指令 */
export function diffState(prev: DBShape, next: DBShape): Op[] {
  const ops: Op[] = []
  for (const table of TABLES) {
    const prevRows = (prev[table] ?? []) as unknown as Array<Record<string, unknown>>
    const nextRows = (next[table] ?? []) as unknown as Array<Record<string, unknown>>
    const prevMap = new Map(prevRows.map((r) => [String(r.id), r]))
    const nextMap = new Map(nextRows.map((r) => [String(r.id), r]))

    for (const [id, row] of nextMap) {
      const old = prevMap.get(id)
      if (!old) ops.push({ t: 'insert', table, row })
      else if (JSON.stringify(old) !== JSON.stringify(row))
        ops.push({ t: 'update', table, id, patch: row })
    }
    for (const id of prevMap.keys()) {
      if (!nextMap.has(id)) ops.push({ t: 'delete', table, id })
    }
  }
  return ops
}

export function emptyState(): DBShape {
  return {
    version: 3,
    users: [],
    games: [],
    reviews: [],
    events: [],
    showcase: [],
    posts: [],
    logs: [],
    charts: [],
    settings: [],
    feedbacks: [],
    sessionUserId: null,
  }
}
