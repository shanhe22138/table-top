import { useSyncExternalStore } from 'react'
import type { DBShape, OpLog, Settings } from '../types'
import { getBackend, initBackend } from '../lib/backend'
import { diffState, type BackendIO, type Op } from '../lib/backend/types'
import { defaultSettings } from '../lib/taxonomy'

let state: DBShape | null = null
let syncError: string | null = null
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((l) => l())
}

const io: BackendIO = {
  getState: () => state,
  setState: (db) => {
    state = db
  },
  notify,
}

export async function initDB(): Promise<DBShape> {
  if (state) return state
  await initBackend(io)
  state = await getBackend().load()
  notify()
  return state
}

export function getDB(): DBShape {
  if (!state) throw new Error('数据尚未初始化')
  return state
}

export function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function setSyncError(msg: string | null) {
  syncError = msg
  notify()
}

/** 登录/登出后从服务端重新拉一份完整状态 */
export async function reloadDB(): Promise<void> {
  state = await getBackend().load()
  syncError = null
  notify()
}

/* ───────────────── 操作日志 ───────────────── */

const TABLE_ACTION: Record<string, Record<'insert' | 'update' | 'delete', string>> = {
  games: { insert: '新增条目', update: '修改条目', delete: '删除条目' },
  events: { insert: '发车', update: '修改活动', delete: '删除活动' },
  reviews: { insert: '发布评测', update: '修改评测', delete: '删除评测' },
  showcase: { insert: '添加展柜', update: '修改展柜', delete: '移除展柜' },
  users: { insert: '注册账号', update: '修改资料', delete: '删除账号' },
  charts: { insert: '导入榜单', update: '更新榜单', delete: '删除榜单' },
  settings: { insert: '初始化配置', update: '修改站点配置', delete: '删除配置' },
  feedbacks: { insert: '提交反馈', update: '修改反馈', delete: '删除反馈' },
}

const FIELD_LABEL: Record<string, string> = {
  title: '标题',
  subtitle: '简介',
  tags: '标签',
  cover: '封面',
  kind: '玩法',
  difficulty: '难度',
  durationMin: '时长',
  minPlayers: '最少人数',
  maxPlayers: '最多人数',
  rating: '评分',
  publisher: '发行',
  author: '作者',
  description: '简介',
  roles: '角色表',
  seats: '座位',
  startAt: '开始时间',
  venue: '场地',
  city: '地点',
  joinMode: '上车方式',
  note: '留言',
  capacity: '人数上限',
  status: '状态',
  nickname: '昵称',
  bio: '签名',
  avatar: '头像',
  email: '邮箱',
  prefs: '偏好',
  privacy: '隐私设置',
  host: '主持人资料',
  role: '权限',
  favRoles: '喜欢的角色',
  taxonomy: '分类',
  locations: '地点',
  ownerId: '站长',
  image: '图片',
  gameId: '条目',
}

function rowLabel(row: Record<string, unknown> | undefined): string {
  if (!row) return '（未知）'
  return String(row.title ?? row.nickname ?? row.username ?? row.id ?? '（未知）')
}

const MAX_LOGS = 400

/** 从一次写入的差异里生成日志；服务端会再补一遍操作者，防止前端伪造 */
/** 只有管理员能做的事，日志归到「需要权限」 */
const ADMIN_TABLES = new Set(['games', 'charts', 'settings'])

function buildLogs(prev: DBShape, next: DBShape, ops: Op[]): OpLog[] {
  const actor = next.users.find((u) => u.id === next.sessionUserId) ?? null
  const at = new Date().toISOString()
  const out: OpLog[] = []
  for (const op of ops) {
    if (op.table === 'logs') continue
    if (op.table === 'feedbacks') continue
    const meta = TABLE_ACTION[op.table]
    if (!meta) continue
    const before = (prev[op.table] as unknown as Array<Record<string, unknown>>).find(
      (r) => String(r.id) === String(op.t === 'insert' ? op.row.id : op.id),
    )
    const after = (next[op.table] as unknown as Array<Record<string, unknown>>).find(
      (r) => String(r.id) === String(op.t === 'insert' ? op.row.id : op.id),
    )
    let detail = ''
    if (op.t === 'update' && before && after) {
      const keys = new Set([...Object.keys(before), ...Object.keys(after)])
      detail = [...keys]
        .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
        .map((k) => FIELD_LABEL[k] ?? k)
        .slice(0, 6)
        .join('、')
    }
    out.push({
      id: `log_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
      at,
      userId: actor?.id ?? null,
      userName: actor?.nickname ?? '访客',
      scope: ADMIN_TABLES.has(op.table) ? 'admin' : 'user',
      action: meta[op.t],
      target: rowLabel(op.t === 'delete' ? before : after),
      detail,
    })
  }
  return out
}

/**
 * 唯一的写入入口。
 * 本地适配器：整份状态落盘。
 * 服务器适配器：乐观更新本地快照，再把差异（insert/update/delete）批量推给服务端。
 */
export function mutate(fn: (draft: DBShape) => void) {
  if (!state) return
  const prev = state
  const next: DBShape = JSON.parse(JSON.stringify(prev))
  fn(next)

  const ops = diffState(prev, next)
  if (!ops.length) return

  const logs = buildLogs(prev, next, ops)
  if (logs.length) next.logs = [...logs, ...next.logs].slice(0, MAX_LOGS)

  state = next
  notify()

  const allOps = diffState(prev, next)
  getBackend()
    .apply(allOps)
    .then(() => {
      if (syncError) setSyncError(null)
    })
    .catch((err: Error) => {
      console.error('[table-top] 同步失败', err)
      setSyncError(err.message || '保存失败，请检查网络')
    })
}

export async function resetDB() {
  const backend = getBackend()
  if (backend.reset) {
    await backend.reset()
    return
  }
  throw new Error('服务器模式下不支持一键重置')
}

export function useDB(): DBShape {
  return useSyncExternalStore(subscribe, getDB, getDB)
}

export function useSyncError(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => syncError,
    () => syncError,
  )
}

export function useBackendKind(): string {
  return useSyncExternalStore(
    subscribe,
    () => getBackend().label,
    () => getBackend().label,
  )
}

/** 站点配置：地点、分类、站长。没有就返回一份默认值，避免页面崩 */
export function getSettings(db: DBShape): Settings {
  return db.settings?.[0] ?? defaultSettings(null)
}

export function useSettings(): Settings {
  const db = useDB()
  return getSettings(db)
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}
