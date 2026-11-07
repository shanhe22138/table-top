const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`
}

export function toDateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function dateKeyOf(iso: string) {
  return toDateKey(new Date(iso))
}

export function parseDateKey(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatTime(iso: string) {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export function formatDateFull(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 周${WEEKDAYS[d.getDay()]}`
}

export function formatDuration(min: number) {
  if (min < 60) return `${min} 分钟`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} 小时 ${m} 分` : `${h} 小时`
}

export function weekdayLabel(d: Date) {
  return `周${WEEKDAYS[d.getDay()]}`
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  )
}

export function relativeDay(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const n0 = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diff = Math.round((d0.getTime() - n0.getTime()) / 86400000)
  if (diff === 0) return '今天'
  if (diff === 1) return '明天'
  if (diff === 2) return '后天'
  if (diff === -1) return '昨天'
  if (diff > 0 && diff < 7) return `${diff} 天后`
  if (diff < 0) return `${-diff} 天前`
  return formatDate(iso)
}

/** 生成月视图 6 行 × 7 列 的日期网格（周一起始） */
export function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7 // 周一 = 0
  const start = new Date(year, month, 1 - offset)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

export function monthLabel(year: number, month: number) {
  return `${year} 年 ${month + 1} 月`
}

export const WEEK_HEADERS = ['一', '二', '三', '四', '五', '六', '日']

export function pluralSeats(taken: number, total: number) {
  return `${taken}/${total}`
}

export function ratingTone(rating: number) {
  if (rating >= 8.8) return 'text-brass'
  if (rating >= 8) return 'text-jade'
  return 'text-muted'
}

/** 周一为一周的第一天 */
export function startOfWeek(d: Date) {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const offset = (out.getDay() + 6) % 7
  out.setDate(out.getDate() - offset)
  return out
}

export function weekDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

export function weekLabel(start: Date) {
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const a = `${start.getMonth() + 1}.${start.getDate()}`
  const b = `${end.getMonth() + 1}.${end.getDate()}`
  const sameYear = start.getFullYear() === end.getFullYear()
  return sameYear ? `${a} – ${b}` : `${start.getFullYear()}.${a} – ${end.getFullYear()}.${b}`
}

/** 半小时粒度 */
export function formatHalfHour(min: number) {
  if (min < 60) return `${min} 分`
  const h = min / 60
  return Number.isInteger(h) ? `${h} 小时` : `${h.toFixed(1)} 小时`
}

/** 剧本杀名字统一带书名号，桌游不加 */
export function gameTitle(g: { title: string; kind: string }) {
  return g.kind === 'script' ? `《${g.title}》` : g.title
}

/** 榜单里只有名字、不知道玩法时的兜底 */
export function bookTitle(title: string) {
  return /^《.*》$/.test(title) ? title : `《${title}》`
}

/** 分钟 → 「3 小时」「90 分钟」，按 30 分钟粒度取整 */
export function durationText(min: number) {
  if (min < 60) return `${min} 分钟`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} 小时 ${m} 分` : `${h} 小时`
}

/** 分钟 → 小时数（保留一位小数），用于输入框 */
export function toHours(min: number) {
  return Math.round((min / 60) * 100) / 100
}
