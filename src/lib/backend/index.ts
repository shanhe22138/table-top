import { createLocalBackend } from './local'
import { createRestBackend, probeServer } from './rest'
import type { Backend, BackendIO } from './types'
import { IS_MINI } from '../platform'

let current: Backend | null = null

/**
 * 适配器选择顺序：
 * 1. 显式指定 VITE_BACKEND=local|rest 时按指定走
 * 2. 否则探测同源 /api/health：有后端就用服务器，没有就退回本地
 *
 * 想换托管方案（Supabase / CloudBase / PocketBase / 自建）时，
 * 新增一个实现 Backend 接口的文件，在下面加一个分支即可，页面代码不用动。
 */
export async function initBackend(io: BackendIO): Promise<Backend> {
  const forced = __BACKEND__ || (IS_MINI ? 'rest' : '')
  if (forced === 'local') current = createLocalBackend(io)
  else if (forced === 'rest') current = createRestBackend(io)
  else current = (await probeServer()) ? createRestBackend(io) : createLocalBackend(io)
  await current.init()
  return current
}

export function getBackend(): Backend {
  if (!current) throw new Error('后端尚未初始化')
  return current
}

export type { Backend, Op } from './types'
