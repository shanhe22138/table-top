import type { Game, GameEvent, JoinMode, Seat } from '../types'

/** 批量生成的活动都带这个留言，方便一键清理 */
export const TEST_NOTE = '批量生成的测试车，随时可以删掉'

const NAMES = [
  '阿柚',
  '老K',
  '团子',
  '白桃',
  '小满',
  '三土',
  '大鹏',
  '阿柑',
  '木木',
  '星野',
  '江月',
  '子昂',
  '铁蛋',
  '西瓜',
]

const VENUES: Record<string, string[]> = {
  上海: ['叁号推理馆 · 静安店', '谜屋 · 徐汇店', '未名空间 · 人民广场', '桌游星球 · 中山公园'],
  北京: ['拾光推理 · 三里屯', '第七档案室 · 国贸', '木马桌游 · 五道口'],
  杭州: ['湖滨谜社 · 西湖店', '九号桌游 · 滨江', '南山书房 · 武林门'],
  成都: ['蜀山谜案 · 春熙路', '熊猫桌游 · 太古里', '宽窄推理 · 青羊宫'],
  深圳: ['南山剧本社 · 科技园', '湾区桌游 · 后海', '雾鸦馆 · 福田'],
  广州: ['荔湾推理 · 上下九', '珠江桌游 · 天河', '五羊谜社 · 越秀'],
  南京: ['金陵谜案 · 新街口', '夫子庙桌游 · 秦淮'],
  武汉: ['江汉推理 · 江汉路', '昙华林桌游 · 武昌'],
  西安: ['长安谜社 · 钟楼', '曲江桌游 · 大雁塔'],
  其他: ['本地推理馆', '本地桌游吧'],
}

const MODES: JoinMode[] = ['open', 'open', 'open', 'approval', 'open', 'invite']

function rand(n: number) {
  return Math.floor(Math.random() * n)
}

function pick<T>(arr: T[]): T {
  return arr[rand(arr.length)]
}

/** 'YYYY-MM-DD' → 当天 00:00 的本地时间戳 */
function dayStart(dateKey: string) {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime()
}

export interface BatchOptions {
  /** 目标日期，YYYY-MM-DD */
  dateKey: string
  /** 造几车 */
  count: number
  city: string
  /** 车头（当前登录用户） */
  host: { id: string; nickname: string }
  /** 从仓库里挑条目，为空则造「自定义」车 */
  games: Game[]
  /** 最早一车的开始时刻，默认 9 点 */
  startHour?: number
}

/**
 * 给同一天批量造车。时间在 9:00 到 23:00 之间均匀铺开，
 * 条目、场地、上车方式、已坐人数都随机，用来压测时刻一天放不下时的展示。
 */
export function buildTestEvents(opts: BatchOptions): GameEvent[] {
  const { dateKey, count, city, host, games } = opts
  const startHour = opts.startHour ?? 9
  const base = dayStart(dateKey)
  const n = Math.max(1, Math.min(30, Math.floor(count)))

  // 时间均匀铺在 9:00–23:00，至少间隔 20 分钟
  const spanMin = (23 - startHour) * 60
  const step = Math.max(20, Math.min(180, Math.floor(spanMin / Math.max(1, n))))
  const venuePool = VENUES[city] ?? VENUES.其他

  const scripts = games.filter((g) => g.kind === 'script')
  const boards = games.filter((g) => g.kind === 'board')
  const usedTitles = new Map<string, number>()

  const out: GameEvent[] = []
  for (let i = 0; i < n; i++) {
    // 剧本杀 / 桌游 交替取，两边都空就造自定义车
    const preferScript = i % 2 === 0
    const pool = preferScript ? (scripts.length ? scripts : boards) : boards.length ? boards : scripts
    const game = pool.length ? pool[Math.floor(i / 2) % pool.length] : null

    const rawTitle = game ? `${game.title} 拼车` : `临时车 ${i + 1}`
    const seen = usedTitles.get(rawTitle) ?? 0
    usedTitles.set(rawTitle, seen + 1)
    const title = seen ? `${rawTitle} ${seen + 1}` : rawTitle

    const capacity = Math.max(2, Math.min(12, game?.maxPlayers ?? 6))
    const filledExtra = capacity > 1 ? rand(Math.min(4, capacity)) : 0
    const seats: Seat[] = Array.from({ length: capacity }, (_, idx) => {
      if (idx === 0) {
        return {
          id: `st_${dateKey}_${i}_0`,
          index: 0,
          userId: host.id,
          name: host.nickname,
          contact: null,
          note: '车头',
          status: 'filled' as const,
          roleName: null,
        }
      }
      if (idx <= filledExtra) {
        return {
          id: `st_${dateKey}_${i}_${idx}`,
          index: idx,
          userId: null,
          name: NAMES[(i * 3 + idx) % NAMES.length],
          contact: null,
          note: null,
          status: 'filled' as const,
          roleName: null,
        }
      }
      return {
        id: `st_${dateKey}_${i}_${idx}`,
        index: idx,
        userId: null,
        name: null,
        contact: null,
        note: null,
        status: 'open' as const,
        roleName: null,
      }
    })

    out.push({
      id: `e_t${dateKey.replace(/-/g, '')}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      hostId: host.id,
      hostName: host.nickname,
      title,
      gameId: game?.id ?? null,
      gameTitle: game?.title ?? '自定义',
      kind: game?.kind ?? 'board',
      startAt: new Date(base + (startHour * 60 + i * step) * 60000).toISOString(),
      durationMin: game?.durationMin ?? 120,
      city,
      venue: venuePool[i % venuePool.length],
      capacity,
      joinMode: MODES[i % MODES.length],
      note: TEST_NOTE,
      seats,
      shareCode: Math.random().toString(36).slice(2, 10),
      status: 'open',
      waitlistSize: 0,
      psych: { enabled: false, test: null },
      createdAt: new Date().toISOString(),
    })
  }
  return out
}
