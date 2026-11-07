import type { Game, GameKind, PsychTest, Role } from '../types.ts'
import { GAME_KINDS } from '../types.ts'

export interface ImportField {
  key: string
  label: string
  required: boolean
  defaultValue: string
  description: string
  example: string
}

export const GAME_IMPORT_FIELDS: ImportField[] = [
  { key: 'id', label: '条目 ID', required: false, defaultValue: '系统自动生成', description: '内部唯一标识，导入时无需填写；即使填写也不会覆盖已有条目。', example: 'g_自动生成' },
  { key: 'title', label: '标题', required: true, defaultValue: '无', description: '剧本、桌游或其他玩法的名称，不能留空。', example: '年轮' },
  { key: 'kind', label: '玩法代码', required: false, defaultValue: 'script', description: '六选一：script 剧本杀、board 桌游、trpg 跑团、soup 海龟汤、social 社交推理、tcg 卡牌对战。', example: 'script' },
  { key: 'subtitle', label: '一句话简介', required: false, defaultValue: '空字符串', description: '列表卡片上的简短介绍。', example: '多重时间线硬核推理本' },
  { key: 'cover', label: '封面地址', required: false, defaultValue: 'null', description: '可填写 HTTPS 图片地址；留空时由程序生成封面。批量 Excel 导入不支持直接嵌入图片文件。', example: 'https://example.com/cover.jpg' },
  { key: 'tags', label: '标签', required: false, defaultValue: '[]', description: '用竖线、逗号、分号或换行分隔；也支持 JSON 数组。建议使用后台已有分类。', example: '硬核推理|还原|民国' },
  { key: 'minPlayers', label: '最少人数', required: false, defaultValue: '2', description: '大于等于 1 的整数，且不能超过最多人数。', example: '6' },
  { key: 'maxPlayers', label: '最多人数', required: false, defaultValue: '6', description: '大于等于最少人数的整数。', example: '6' },
  { key: 'durationMin', label: '时长（分钟）', required: false, defaultValue: '120', description: '预计游戏时长，必须是大于 0 的数字。', example: '300' },
  { key: 'difficulty', label: '难度', required: false, defaultValue: '3', description: '1–5 的整数；不同玩法会显示对应文案。', example: '4' },
  { key: 'rating', label: '评分', required: false, defaultValue: '8', description: '0–10 分，可以带一位小数。', example: '8.5' },
  { key: 'ratingCount', label: '评分人数', required: false, defaultValue: '0', description: '大于等于 0 的整数；新条目通常为 0。', example: '0' },
  { key: 'publisher', label: '发行方', required: false, defaultValue: '未填写', description: '发行、工作室或出版方名称。', example: '某发行工作室' },
  { key: 'year', label: '发行年份', required: false, defaultValue: '当前年份', description: '四位年份数字。', example: '2024' },
  { key: 'author', label: '作者', required: false, defaultValue: '未填写', description: '作者或创作团队。', example: '某作者' },
  { key: 'description', label: '详细介绍', required: false, defaultValue: '空字符串', description: '详情页展示的完整介绍，可以包含换行。', example: '适合喜欢时间线还原的玩家。' },
  { key: 'roles', label: '角色表 JSON', required: false, defaultValue: 'undefined', description: 'JSON 数组；每项含 name、gender（男/女/不限）、difficulty（1–5）、brief。', example: '[{"name":"沈砚","gender":"男","difficulty":4,"brief":"观察时间线"}]' },
  { key: 'featured', label: '是否推荐位', required: false, defaultValue: 'false', description: '布尔值；支持 true/false、1/0、是/否。推荐位会显示在仓库推荐区域。', example: '是' },
  { key: 'isNew', label: '是否新入库', required: false, defaultValue: 'true', description: '布尔值；导入默认按新入库处理，填“否”可关闭新入库展示。', example: '是' },
  { key: 'psychTests', label: '心测题库 JSON', required: false, defaultValue: 'undefined', description: 'JSON 数组；每份问卷含 title、questions，每题含 text 和至少两个 options，选项含 label，可选 tag。id 可省略并自动生成。', example: '见“完整示例”工作表中的完整 JSON' },
  { key: 'createdAt', label: '创建时间', required: false, defaultValue: '导入时的当前时间', description: '系统自动生成，无需填写。', example: '2026-11-05T00:00:00.000Z' },
]

const IMPORT_KEYS = GAME_IMPORT_FIELDS.filter((field) => !['id', 'createdAt'].includes(field.key)).map((field) => field.key)
const KIND_VALUES = 'script / board / trpg / soup / social / tcg'

function importId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

function text(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function numberValue(value: unknown, fallback: number, field: string): number {
  if (text(value) === '') return fallback
  const result = Number(value)
  if (!Number.isFinite(result)) throw new Error(`${field} 必须是数字`)
  return result
}

function booleanValue(value: unknown, field: string): boolean | undefined {
  const raw = text(value).toLowerCase()
  if (!raw) return undefined
  if (['true', '1', 'yes', 'y', '是', '推荐'].includes(raw)) return true
  if (['false', '0', 'no', 'n', '否', '不推荐'].includes(raw)) return false
  throw new Error(`${field} 只支持 true/false、1/0 或是/否`)
}

function arrayValue(value: unknown, field: string): string[] {
  if (value == null || text(value) === '') return []
  if (Array.isArray(value)) return value.map(String)
  const raw = text(value)
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) throw new Error()
      return parsed.map(String)
    } catch {
      throw new Error(`${field} 的 JSON 数组格式不正确`)
    }
  }
  return raw.split(/[|｜,，;；\n]/).map((item) => item.trim()).filter(Boolean)
}

function jsonArray(value: unknown, field: string): Array<Record<string, unknown>> {
  if (value == null || text(value) === '') return []
  const parsed = Array.isArray(value) ? value : (() => {
    try { return JSON.parse(text(value)) } catch { throw new Error(`${field} 不是合法 JSON`) }
  })()
  if (!Array.isArray(parsed)) throw new Error(`${field} 必须是 JSON 数组`)
  return parsed.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`${field} 第 ${index + 1} 项必须是对象`)
    return item as Record<string, unknown>
  })
}

function rolesValue(value: unknown): Role[] | undefined {
  const roles = jsonArray(value, 'roles').map((role, index) => {
    const name = text(role.name)
    if (!name) throw new Error(`roles 第 ${index + 1} 个角色缺少 name`)
    const gender = text(role.gender) || '不限'
    if (!['男', '女', '不限'].includes(gender)) throw new Error(`角色 ${name} 的 gender 只能是男/女/不限`)
    const difficulty = numberValue(role.difficulty, 3, `角色 ${name} 的 difficulty`)
    if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) throw new Error(`角色 ${name} 的 difficulty 必须是 1–5 的整数`)
    return { name, gender: gender as Role['gender'], difficulty: difficulty as Role['difficulty'], brief: text(role.brief) }
  })
  return roles.length ? roles : undefined
}

function psychValue(value: unknown): PsychTest[] | undefined {
  const tests = jsonArray(value, 'psychTests').map((test, testIndex) => {
    const title = text(test.title)
    if (!title) throw new Error(`psychTests 第 ${testIndex + 1} 份问卷缺少 title`)
    const questions = jsonArray(test.questions, `问卷 ${title} 的 questions`).map((question, questionIndex) => {
      const questionText = text(question.text)
      if (!questionText) throw new Error(`问卷 ${title} 第 ${questionIndex + 1} 题缺少 text`)
      const options = jsonArray(question.options, `题目 ${questionText} 的 options`).map((option) => ({
        id: text(option.id) || importId('o'),
        label: text(option.label),
        tag: text(option.tag) || undefined,
      }))
      if (options.length < 2 || options.some((option) => !option.label)) throw new Error(`题目 ${questionText} 至少需要两个有 label 的选项`)
      return { id: text(question.id) || importId('q'), text: questionText, options }
    })
    return { id: text(test.id) || importId('psych'), title, questions }
  })
  return tests.length ? tests : undefined
}

export function normalizeImportedGame(item: Record<string, unknown>): Game {
  const title = text(item.title)
  if (!title) throw new Error('title 标题不能为空')
  const kind = (text(item.kind) || 'script') as GameKind
  if (!GAME_KINDS.includes(kind)) throw new Error(`kind 无效：${kind}；只能是 ${KIND_VALUES}`)
  const minPlayers = numberValue(item.minPlayers, 2, 'minPlayers')
  const maxPlayers = numberValue(item.maxPlayers, 6, 'maxPlayers')
  if (!Number.isInteger(minPlayers) || !Number.isInteger(maxPlayers) || minPlayers < 1 || maxPlayers < 1) throw new Error('人数必须是大于等于 1 的整数')
  if (minPlayers > maxPlayers) throw new Error('minPlayers 不能大于 maxPlayers')
  const durationMin = numberValue(item.durationMin, 120, 'durationMin')
  if (durationMin <= 0) throw new Error('durationMin 必须大于 0')
  const difficulty = numberValue(item.difficulty, 3, 'difficulty')
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) throw new Error('difficulty 必须是 1–5 的整数')
  const rating = numberValue(item.rating, 8, 'rating')
  if (rating < 0 || rating > 10) throw new Error('rating 必须在 0–10 之间')
  const ratingCount = numberValue(item.ratingCount, 0, 'ratingCount')
  if (!Number.isInteger(ratingCount) || ratingCount < 0) throw new Error('ratingCount 必须是大于等于 0 的整数')
  const year = numberValue(item.year, new Date().getFullYear(), 'year')
  if (!Number.isInteger(year) || year < 1000 || year > 9999) throw new Error('year 必须是四位年份')
  return {
    id: importId('g'),
    title,
    kind,
    subtitle: text(item.subtitle),
    cover: text(item.cover) || null,
    tags: arrayValue(item.tags, 'tags'),
    minPlayers,
    maxPlayers,
    durationMin,
    difficulty: difficulty as Game['difficulty'],
    rating,
    ratingCount,
    publisher: text(item.publisher) || '未填写',
    year,
    author: text(item.author) || '未填写',
    description: text(item.description),
    roles: rolesValue(item.roles),
    featured: booleanValue(item.featured, 'featured'),
    isNew: booleanValue(item.isNew, 'isNew') ?? true,
    createdAt: new Date().toISOString(),
    psychTests: psychValue(item.psychTests),
  }
}

export function convertImportedGames(items: unknown): { games: Game[]; errors: string[] } {
  if (!Array.isArray(items)) return { games: [], errors: ['JSON 最外层必须是数组 [ ]'] }
  const games: Game[] = []
  const errors: string[] = []
  items.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`第 ${index + 1} 条必须是对象`)
      return
    }
    try {
      games.push(normalizeImportedGame(item as Record<string, unknown>))
    } catch (error) {
      errors.push(`第 ${index + 1} 条：${(error as Error).message}`)
    }
  })
  return { games, errors }
}

async function newWorkbook() {
  const excel = await import('exceljs')
  const WorkbookClass = excel.Workbook ?? (excel as any).default.Workbook
  return new WorkbookClass()
}

export async function parseExcelGames(data: ArrayBuffer | Uint8Array): Promise<{ games: Game[]; errors: string[] }> {
  const workbook = await newWorkbook()
  await workbook.xlsx.load(data as unknown as ArrayBuffer)
  const worksheet = workbook.getWorksheet('示例数据') ?? workbook.worksheets[0]
  if (!worksheet) throw new Error('Excel 中没有可读取的工作表')
  const headers = new Map<string, number>()
  worksheet.getRow(1).eachCell((cell, column) => {
    const key = cell.text.trim()
    if (IMPORT_KEYS.includes(key)) headers.set(key, column)
  })
  if (!headers.has('title')) throw new Error('第一行必须包含 title 列；请使用下载的样例格式')

  const games: Game[] = []
  const errors: string[] = []
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber)
    const item: Record<string, unknown> = {}
    let hasContent = false
    for (const [key, column] of headers) {
      const value = row.getCell(column).text
      item[key] = value
      if (value.trim()) hasContent = true
    }
    if (!hasContent) continue
    try {
      games.push(normalizeImportedGame(item))
    } catch (error) {
      errors.push(`Excel 第 ${rowNumber} 行：${(error as Error).message}`)
    }
  }
  return { games, errors }
}

const COMPLETE_ROLES = JSON.stringify([
  { name: '沈砚', gender: '男', difficulty: 4, brief: '冷静观察，适合喜欢时间线的玩家' },
  { name: '白露', gender: '女', difficulty: 3, brief: '情感视角较多，适合愿意分享的玩家' },
  { name: '顾遥', gender: '不限', difficulty: 5, brief: '信息整合难度较高' },
])

const COMPLETE_PSYCH = JSON.stringify([{
  title: '角色适配问卷',
  questions: [{
    text: '复盘时你更愿意做哪件事？',
    options: [
      { label: '整理所有时间线并指出矛盾', tag: '逻辑主导' },
      { label: '先听别人讲完，再补关键细节', tag: '观察协作' },
      { label: '代入角色情绪，还原人物选择', tag: '情感代入' },
    ],
  }, {
    text: '遇到大量新信息时，你会？',
    options: [
      { label: '主动记录并建立关联', tag: '逻辑主导' },
      { label: '等待他人总结后再参与', tag: '观察协作' },
    ],
  }],
}])

const SAMPLE_ROWS: Array<Record<string, unknown>> = [
  { title: '年轮（示例）', kind: 'script', subtitle: '时间线还原与硬核推理', tags: '硬核推理|还原|现代', minPlayers: 6, maxPlayers: 6, durationMin: 300, difficulty: 4, rating: 8.8, ratingCount: 12, publisher: '示例发行', year: 2024, author: '示例作者', description: '适合喜欢逻辑还原的玩家。', featured: '是', isNew: '是' },
  { title: '卡坦岛（示例）', kind: 'board', subtitle: '资源经营与交易', tags: '策略|德式|家庭', minPlayers: 3, maxPlayers: 4, durationMin: 90, difficulty: 2, rating: 9.0, ratingCount: 20, publisher: '示例出版', year: 1995, author: '示例设计师', description: '桌游入门示例。', featured: '否', isNew: '否' },
  { title: '迷雾调查团（示例）', kind: 'trpg', subtitle: '轻规则调查团', tags: 'COC 7th|调查|短团', minPlayers: 3, maxPlayers: 5, durationMin: 240, difficulty: 2, rating: 8.2, ratingCount: 0, publisher: '', year: 2025, author: '', description: '展示发行和作者留空时显示“未填写”。' },
  { title: '午夜一碗汤（示例）', kind: 'soup', subtitle: '短篇情境推理', tags: '本格|脑洞|逻辑', minPlayers: 2, maxPlayers: 8, durationMin: 45, difficulty: 1, rating: 0, ratingCount: 0, description: '展示最低难度和 0 分。' },
  { title: '狼人杀标准局（示例）', kind: 'social', subtitle: '预女猎白新手局', tags: '狼人杀|新手局|娱乐', minPlayers: 9, maxPlayers: 12, durationMin: 120, difficulty: 1, rating: 8, ratingCount: 5, description: '社交推理玩法示例。' },
  { title: '卡牌周末赛（示例）', kind: 'tcg', subtitle: '标准构筑交流', tags: '万智牌|标准|娱乐', minPlayers: 2, maxPlayers: 2, durationMin: 60, difficulty: 3, rating: 10, ratingCount: 1, cover: 'https://example.com/cover.jpg', description: '展示封面外链和最高评分。' },
]

function addTableHeader(worksheet: import('exceljs').Worksheet, columns: string[]) {
  worksheet.addRow(columns)
  const header = worksheet.getRow(1)
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF423931' } }
  header.height = 28
  header.alignment = { vertical: 'middle', wrapText: true }
  header.eachCell((cell) => { cell.border = { bottom: { style: 'thin', color: { argb: 'FF8A6A3E' } } } })
  worksheet.views = [{ state: 'frozen', ySplit: 1 }]
  worksheet.autoFilter = { from: 'A1', to: { row: 1, column: columns.length } }
}

function styleDataRows(worksheet: import('exceljs').Worksheet) {
  worksheet.eachRow((row) => { row.alignment = { vertical: 'top', wrapText: true } })
}

export async function createSampleWorkbook(): Promise<Uint8Array> {
  const workbook = await newWorkbook()
  workbook.creator = 'table-top'
  workbook.created = new Date()

  const guide = workbook.addWorksheet('字段说明')
  addTableHeader(guide, ['属性 key', '中文含义', '必填', '留空默认值', '详细说明', '示例'])
  GAME_IMPORT_FIELDS.forEach((field) => guide.addRow([
    field.key, field.label, field.required ? '是' : '否', field.defaultValue, field.description, field.example,
  ]))
  guide.columns.forEach((column, index) => { column.width = [20, 20, 10, 22, 72, 52][index] })
  styleDataRows(guide)

  const samples = workbook.addWorksheet('示例数据')
  addTableHeader(samples, IMPORT_KEYS)
  SAMPLE_ROWS.forEach((item) => samples.addRow(IMPORT_KEYS.map((key) => item[key] ?? '')))
  samples.columns.forEach((column) => { column.width = 22 })
  samples.getColumn(IMPORT_KEYS.indexOf('title') + 1).width = 30
  samples.getColumn(IMPORT_KEYS.indexOf('description') + 1).width = 48
  samples.getColumn(IMPORT_KEYS.indexOf('cover') + 1).width = 38
  styleDataRows(samples)

  const complete = workbook.addWorksheet('完整示例')
  addTableHeader(complete, IMPORT_KEYS)
  complete.addRow(IMPORT_KEYS.map((key) => ({
    title: '完整属性剧本杀示例', kind: 'script', subtitle: '展示所有可导入属性', cover: 'https://example.com/full-cover.jpg',
    tags: '["硬核推理","还原","民国"]', minPlayers: 6, maxPlayers: 6, durationMin: 300, difficulty: 5,
    rating: 9.2, ratingCount: 18, publisher: '完整示例发行', year: 2026, author: '完整示例作者',
    description: '此条包含角色、心测、推荐位、新入库和全部常用字段。', roles: COMPLETE_ROLES,
    featured: '是', isNew: '是', psychTests: COMPLETE_PSYCH,
  } as Record<string, unknown>)[key] ?? ''))
  complete.addRow(IMPORT_KEYS.map((key) => ({ title: '仅常用字段桌游示例', kind: 'board' } as Record<string, unknown>)[key] ?? ''))
  complete.columns.forEach((column) => { column.width = 24 })
  complete.getColumn(IMPORT_KEYS.indexOf('roles') + 1).width = 85
  complete.getColumn(IMPORT_KEYS.indexOf('psychTests') + 1).width = 95
  complete.getColumn(IMPORT_KEYS.indexOf('description') + 1).width = 55
  styleDataRows(complete)

  const rules = workbook.addWorksheet('取值与错误')
  addTableHeader(rules, ['主题', '合法取值或具体情况', '导入时的处理'])
  const rulesRows = [
    ['玩法 kind', KIND_VALUES, '留空默认 script；其他值报错并指出行号'],
    ['人数', '大于等于 1 的整数，minPlayers <= maxPlayers', '人数颠倒、非数字或小于 1 都会报错'],
    ['时长', '大于 0 的分钟数，例如 45 / 90 / 300', '留空默认 120 分钟'],
    ['难度', '1 / 2 / 3 / 4 / 5 的整数', '留空默认 3；越界或小数会报错'],
    ['评分', '0–10，可以是 8.5 这样的数字', '留空默认 8；越界会报错'],
    ['评分人数', '大于等于 0 的整数', '留空默认 0'],
    ['标签', '硬核推理|还原|民国，或 ["硬核推理","还原"]', '竖线、逗号、分号、换行和 JSON 数组均可'],
    ['布尔值', 'true/false、1/0、是/否', 'featured 留空不推荐；isNew 留空默认新入库'],
    ['封面', 'HTTPS 图片 URL 或留空', '留空使用程序封面；Excel 单元格不是图片上传入口'],
    ['角色 roles', 'JSON 数组，字段为 name/gender/difficulty/brief', 'JSON 引号必须使用英文双引号；非法 JSON 会报行号'],
    ['心测 psychTests', '问卷数组；每题至少两个选项，tag 可选', 'id 可以省略并自动生成；完整写法见“完整示例”'],
    ['空行', '整行所有字段均为空', '自动忽略，不会生成空条目'],
    ['标题重复', 'title 与现有条目相同', '当前会创建新 ID，不覆盖旧条目；请自行检查是否重复'],
    ['id / createdAt', '由系统生成', '无需填写，也不会覆盖现有条目'],
    ['第三方心测', '其他网站/App 的链接或题库', '链接只能作为来源参考；自动导入需要对方授权 API 或导出格式，不能默认抓取'],
  ]
  rulesRows.forEach((row) => rules.addRow(row))
  rules.columns.forEach((column, index) => { column.width = [26, 76, 76][index] })
  styleDataRows(rules)

  return new Uint8Array(await workbook.xlsx.writeBuffer())
}
