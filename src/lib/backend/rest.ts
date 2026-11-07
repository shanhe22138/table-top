import Taro from '@tarojs/taro'
import type { DBShape } from '../../types'
import { IS_BROWSER, storageGet, storageRemove, storageSet } from '../platform'
import type { AuthResult, Backend, BackendIO, Op, Session } from './types'

const API_BASE = __API_BASE__
const TOKEN_KEY = 'table-top.token'
const LEGACY_TOKEN_KEY = 'kaiju.token'

function readToken(): string | null {
  try {
    return storageGet(TOKEN_KEY) ?? storageGet(LEGACY_TOKEN_KEY)
  } catch {
    return null
  }
}

function writeToken(token: string | null) {
  try {
    if (token) storageSet(TOKEN_KEY, token)
    else storageRemove(TOKEN_KEY)
    storageRemove(LEGACY_TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

async function request<T>(
  path: string,
  init: { method?: string; body?: unknown; timeout?: number } = {},
): Promise<T> {
  const token = readToken()
  const method = init.method ?? 'GET'
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  if (!IS_BROWSER) {
    const res = await Taro.request({
      url: `${API_BASE}${path}`,
      method: method as 'GET' | 'POST',
      header: headers,
      data: init.body,
      timeout: init.timeout ?? 15000,
    })
    const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new Error(data?.error ?? `请求失败（${res.statusCode}）`)
    }
    return data as T
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), init.timeout ?? 15000)
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: ctrl.signal,
    })
    const text = await res.text()
    const data = text ? JSON.parse(text) : null
    if (!res.ok) throw new Error(data?.error ?? `请求失败（${res.status}）`)
    return data as T
  } finally {
    clearTimeout(timer)
  }
}

/** 探测同源是否部署了后端，用于自动选择适配器 */
export async function probeServer(): Promise<boolean> {
  try {
    const data = await request<{ ok?: boolean }>('/health', { timeout: 1500 })
    return data?.ok === true
  } catch {
    return false
  }
}

export function createRestBackend(io: BackendIO): Backend {
  return {
    kind: 'rest',
    label: '服务器',

    async init() {
      /* 无需预热 */
    },

    async load(): Promise<DBShape> {
      return request<DBShape>('/state')
    },

    async apply(ops: Op[]) {
      if (!ops.length) return
      await request('/sync', { method: 'POST', body: { ops } })
    },

    auth: {
      async signUp(input): Promise<AuthResult> {
        try {
          const res = await request<{ token: string; session: Session }>('/auth/register', {
            method: 'POST',
            body: input,
          })
          writeToken(res.token)
          return { ok: true, session: res.session }
        } catch (err) {
          return { ok: false, error: (err as Error).message }
        }
      },

      async signIn(input): Promise<AuthResult> {
        try {
          const res = await request<{ token: string; session: Session }>('/auth/login', {
            method: 'POST',
            body: input,
          })
          writeToken(res.token)
          return { ok: true, session: res.session }
        } catch (err) {
          return { ok: false, error: (err as Error).message }
        }
      },

      async signOut() {
        writeToken(null)
        const db = io.getState()
        if (db) io.setState({ ...db, sessionUserId: null })
        io.notify()
      },

      async restore() {
        if (!readToken()) return null
        try {
          const res = await request<{ session: Session | null }>('/auth/session')
          return res.session
        } catch {
          writeToken(null)
          return null
        }
      },
    },

    async feedback(input) {
      try {
        const data = await request<{ ok: boolean; stored: boolean; emailed?: boolean }>('/feedback', {
          method: 'POST',
          body: input,
        })
        return { ok: true, stored: true, emailed: !!data.emailed }
      } catch (err) {
        return { ok: false, error: (err as Error).message, stored: false }
      }
    },
  }
}
