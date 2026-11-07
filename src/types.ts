/* ───────────────── 玩法类型 ───────────────── */

/**
 * 站内支持六类玩法。
 * 剧本杀 / 桌游 是主体，跑团、海龟汤、社交推理、卡牌对战各有自己的分类维度。
 */
export type GameKind = 'script' | 'board' | 'trpg' | 'soup' | 'social' | 'tcg'

export const GAME_KINDS: GameKind[] = ['script', 'board', 'trpg', 'soup', 'social', 'tcg']

export const KIND_LABEL: Record<GameKind, string> = {
  script: '剧本杀',
  board: '桌游',
  trpg: '跑团',
  soup: '海龟汤',
  social: '社交推理',
  tcg: '卡牌对战',
}

export const KIND_SHORT: Record<GameKind, string> = {
  script: '本',
  board: '桌',
  trpg: '团',
  soup: '汤',
  social: '狼',
  tcg: '牌',
}

/**
 * 「玩什么」的可选项。社交推理拆到具体玩法（狼人杀 / 阿瓦隆 / 血染钟楼），
 * 因为它们其实是三种不同的局，玩家会分开挑。
 */
export interface PlayOption {
  key: string
  label: string
  kind: GameKind
  /** 细分玩法对应 Game.tags 里的标签；为空表示整个 kind */
  tag?: string
}

export const PLAY_OPTIONS: PlayOption[] = [
  { key: 'script', label: '剧本杀', kind: 'script' },
  { key: 'board', label: '桌游', kind: 'board' },
  { key: 'trpg', label: '跑团', kind: 'trpg' },
  { key: 'soup', label: '海龟汤', kind: 'soup' },
  { key: 'werewolf', label: '狼人杀', kind: 'social', tag: '狼人杀' },
  { key: 'avalon', label: '阿瓦隆', kind: 'social', tag: '阿瓦隆' },
  { key: 'botc', label: '血染钟楼', kind: 'social', tag: '血染钟楼' },
  { key: 'tcg', label: '卡牌对战', kind: 'tcg' },
]

export function playOption(key: string) {
  return PLAY_OPTIONS.find((p) => p.key === key) ?? null
}

/** 一个条目是否命中某个「玩什么」选项 */
export function gameMatchesPlay(
  game: { kind: GameKind; tags: string[] },
  key: string,
): boolean {
  const opt = playOption(key)
  if (!opt) return false
  if (game.kind !== opt.kind) return false
  return opt.tag ? game.tags.includes(opt.tag) : true
}

/* ───────────────── 难度 ───────────────── */

/**
 * 难度都用 1–5 的同一把尺子，但文案按玩法分开：
 * 剧本杀讲「新手 → 极限硬核」，桌游沿用 BGG weight 的「超轻 → 重度」。
 */
export const DIFFICULTY_LABEL: Record<GameKind, string[]> = {
  script: ['', '新手', '轻推理', '进阶', '硬核', '极限硬核'],
  board: ['', '超轻', '轻量', '中轻', '中重', '重度'],
  trpg: ['', '轻规则', '叙事向', '标准', '硬核', '老手局'],
  soup: ['', '轻松', '常规', '烧脑', '硬核', '地狱'],
  social: ['', '新手友好', '常规', '进阶', '老手', '高手局'],
  tcg: ['', '入门', '休闲', '竞技', '上位', '比赛级'],
}

export function difficultyLabel(kind: GameKind, d: number) {
  return DIFFICULTY_LABEL[kind]?.[d] ?? ''
}

/* ───────────────── 条目 ───────────────── */

export interface Role {
  name: string
  gender: '男' | '女' | '不限'
  difficulty: 1 | 2 | 3 | 4 | 5
  brief: string
}

/**
 * 心测（剧本杀角色适配问卷）。
 * 由管理员在游戏信息里维护/导入题库，车头发车时可基于默认题库改编。
 */
export interface PsychOption {
  id: string
  label: string
  /** 该选项映射的性格标签，车头可据此分配角色 */
  tag?: string
}

export interface PsychQuestion {
  id: string
  text: string
  options: PsychOption[]
}

export interface PsychTest {
  id: string
  title: string
  questions: PsychQuestion[]
}

export interface Game {
  id: string
  title: string
  kind: GameKind
  subtitle: string
  /** 自定义封面（data URL 或外链）；为空时使用程序生成的封面 */
  cover: string | null
  tags: string[]
  minPlayers: number
  maxPlayers: number
  durationMin: number
  /** 1 最轻 → 5 最重，文案见 DIFFICULTY_LABEL */
  difficulty: 1 | 2 | 3 | 4 | 5
  rating: number
  ratingCount: number
  publisher: string
  year: number
  author: string
  description: string
  roles?: Role[]
  featured?: boolean
  /** 新入库，用于「新本 / 新桌游」展示位 */
  isNew?: boolean
  /** 榜单导入时自动建条目的时间 */
  createdAt?: string
  /** 心测题库（剧本杀由管理员维护 / 导入），车头发车时可基于它改编 */
  psychTests?: PsychTest[]
}

export interface Review {
  id: string
  gameId: string
  userId: string
  userName: string
  rating: number
  content: string
  createdAt: string
}

/* ───────────────── 活动 ───────────────── */

export type JoinMode = 'open' | 'approval' | 'invite'

export interface Seat {
  id: string
  index: number
  userId: string | null
  name: string | null
  contact: string | null
  note: string | null
  status: 'filled' | 'open' | 'pending' | 'waitlist'
  roleName: string | null
  /** 空位展示用：该座位对应角色性别 */
  gender?: '男' | '女' | '不限'
  /** 心测答案：题目 id → 选项 id（仅启用心测时由玩家填写，车头可见） */
  psychAnswers?: Record<string, string>
}

export type EventStatus = 'open' | 'full' | 'done' | 'cancelled'

export interface GameEvent {
  id: string
  hostId: string
  hostName: string
  title: string
  gameId: string | null
  gameTitle: string
  kind: GameKind
  /** ISO 字符串 */
  startAt: string
  durationMin: number
  /** 地点，如「浦东」「青浦」「杭州」 */
  city: string
  venue: string
  capacity: number
  joinMode: JoinMode
  note: string
  seats: Seat[]
  shareCode: string
  status: EventStatus
  createdAt: string
  /** 心测：是否启用、以及本次采用的心测内容（车头可基于默认题库改编） */
  psych?: { enabled: boolean; test: PsychTest | null }
  /** 候补位数量，0 表示不开放候补 */
  waitlistSize: number
}

/* ───────────────── 用户 ───────────────── */

export type UserRole = 'user' | 'admin' | 'owner'

export const ROLE_LABEL: Record<UserRole, string> = {
  user: '玩家',
  admin: '管理员',
  owner: '站长',
}

/** 舒适时长区间的粒度与上下限：半小时一格，最长 12 小时 */
export const DURATION_STEP = 30
export const DURATION_MIN = 30
export const DURATION_MAX = 720

export interface Prefs {
  /** 玩什么，PLAY_OPTIONS.key */
  plays: string[]
  /** 常去的地点 */
  locations: string[]
  /** 舒适时长区间（分钟），半小时粒度 */
  durationRange: [number, number] | null
  /** 难度上限，按玩法分开存 */
  maxDifficulty: Partial<Record<GameKind, number>>
  /** 喜欢的类型标签，按玩法分开存 */
  tags: Partial<Record<GameKind, string[]>>
  /** 狼人杀板子偏好（预制选项 + 玩家自定义），仅对狼人杀有意义 */
  boards: string[]
}

/** 狼人杀常见板子（预制），玩家也可自行输入 */
export const WEREWOLF_BOARDS: string[] = [
  '预女猎白',
  '预女猎守',
  '预女猎白守',
  '白狼王',
  '狼美人',
  '石像鬼',
  '守卫局',
  '骑士局',
  '混血儿',
  '丘比特',
  '大灰狼',
  '生还者',
]

export interface HostProfile {
  /** 是否对外展示主持人身份 */
  enabled: boolean
  /** 主持类型，见 HOST_TYPE_OPTIONS */
  types: string[]
  intro: string
  venues: string[]
  contact: string
}

/** 主持人的称呼按玩法各不相同：剧本杀叫 DM，狼人杀叫上帝 */
export const HOST_TYPE_OPTIONS = [
  '剧本杀 DM',
  '狼人杀 上帝',
  '跑团 KP',
  '桌游讲解',
  '海龟汤 主持',
]

export interface Privacy {
  bio: boolean
  prefs: boolean
  showcase: boolean
  events: boolean
  favRoles: boolean
  host: boolean
  /** 是否让其他用户看到自己的关注 / 被关注情况 */
  followers: boolean
}

export interface User {
  id: string
  /** 登录名，用户自选，全站唯一，注册后不可修改 */
  username: string
  /** 选填，暂不参与登录与找回 */
  email: string | null
  passwordHash: string
  nickname: string
  avatar: string | null
  bio: string
  role: UserRole
  prefs: Prefs
  favRoles: string[]
  host: HostProfile
  privacy: Privacy
  /** 公开 uid，不可隐藏，用于站内唯一标识 */
  uid: string
  /** 是否对外展示 @登录名（登录名本身永久唯一、不可改） */
  showUsername: boolean
  /** 我关注的用户 id 列表 */
  following: string[]
  /** 关注我的用户 id 列表 */
  followers: string[]
  /** 我匿名点赞过的用户 id（不展示给任何人，仅记日志） */
  likedUsers: string[]
  createdAt: string
}

export const EMPTY_PREFS: Prefs = {
  plays: [],
  locations: [],
  durationRange: null,
  maxDifficulty: {},
  tags: {},
  boards: [],
}

export const EMPTY_HOST: HostProfile = {
  enabled: false,
  types: [],
  intro: '',
  venues: [],
  contact: '',
}

export const DEFAULT_PRIVACY: Privacy = {
  bio: true,
  prefs: true,
  showcase: true,
  events: true,
  favRoles: true,
  host: true,
  followers: true,
}

/* ───────────────── 展柜 ───────────────── */

export type ShowcaseType = 'game' | 'role' | 'quote'

export interface ShowcaseItem {
  id: string
  userId: string
  type: ShowcaseType
  gameId: string | null
  title: string
  subtitle: string
  note: string
  image: string | null
  /** 玩家自己填的（不提供图片上传） */
  custom?: boolean
  createdAt: string
}

/* ───────────────── 站台社区（玩家交流） ───────────────── */

/** 帖子里的单条评论 */
export interface PostComment {
  id: string
  authorId: string
  authorName: string
  authorUid: string
  text: string
  createdAt: string
}

/** 站台（社区）里的一则动态。likes 存点赞者 userId；评论单独成列 */
export interface Post {
  id: string
  authorId: string
  authorName: string
  /** 作者 uid，列表里展示用 */
  authorUid: string
  text: string
  /** 配图（data URL），可选 */
  image: string | null
  /** 点赞者的 userId 列表 */
  likes: string[]
  comments: PostComment[]
  createdAt: string
}

/* ───────────────── 站点配置 / 榜单 / 日志 ───────────────── */

export interface Settings {
  id: string
  /** 地点（城市 / 区域），管理员可增删 */
  locations: string[]
  /** 分类标签，按玩法分开 */
  taxonomy: Record<GameKind, string[]>
  /** 站长，唯一有权授予管理员的人 */
  ownerId: string | null
  /** 站长接收反馈的邮箱（仅站长自己可见） */
  feedbackEmail: string
  /** SMTP 配置（仅站长自己可见，部署到服务器后才真正发信） */
  smtp: { host: string; port: number; user: string; pass: string; from: string } | null
  updatedAt: string
}

export interface ChartEntry {
  rank: number
  /** 匹配到仓库里的条目；没匹配上是 null */
  gameId: string | null
  title: string
  note: string
  /** 热度 0–100，导入时可以留空 */
  heat?: number
}

export interface Chart {
  /** 期号，如 2026-11 */
  id: string
  period: string
  board: ChartEntry[]
  script: ChartEntry[]
  /** 社交推理热度：key 对应 PLAY_OPTIONS 的 werewolf / avalon / botc */
  social: Array<{ key: string; heat: number }>
  updatedAt: string
}

/** 日志分级：普通玩家的日常操作，和需要管理员权限的操作 */
export type OpScope = 'user' | 'admin'

export const OP_SCOPE_LABEL: Record<OpScope, string> = {
  user: '普通操作',
  admin: '需要权限',
}

export interface OpLog {
  id: string
  at: string
  userId: string | null
  userName: string
  scope: OpScope
  /** 如「发车」「修改条目」 */
  action: string
  /** 操作对象描述 */
  target: string
  /** 细节，如改了哪些字段 */
  detail: string
}

export interface Feedback {
  id: string
  fromUserId: string | null
  fromName: string
  email: string | null
  subject: string
  content: string
  createdAt: string
}

export interface DBShape {
  version: number
  users: User[]
  games: Game[]
  reviews: Review[]
  events: GameEvent[]
  showcase: ShowcaseItem[]
  /** 站台（社区）动态流 */
  posts: Post[]
  logs: OpLog[]
  charts: Chart[]
  /** 单条配置，id 固定为 'app' */
  settings: Settings[]
  /** 用户提交的反馈 / issue（站长可见，本地模式下仅存本地） */
  feedbacks: Feedback[]
  sessionUserId: string | null
}

export const JOIN_MODE_LABEL: Record<JoinMode, string> = {
  open: '自由上车',
  approval: '需车头确认',
  invite: '仅限邀请',
}

/** 未登录 / 老数据兜底 */
export function normalizeUser(u: Partial<User> & { id: string }): User {
  return {
    id: u.id,
    username: u.username ?? u.id,
    email: u.email ?? null,
    passwordHash: u.passwordHash ?? '',
    nickname: u.nickname ?? u.username ?? '玩家',
    avatar: u.avatar ?? null,
    bio: u.bio ?? '',
    role: u.role ?? 'user',
    prefs: { ...EMPTY_PREFS, ...(u.prefs ?? {}) },
    favRoles: u.favRoles ?? [],
    host: { ...EMPTY_HOST, ...(u.host ?? {}) },
    privacy: { ...DEFAULT_PRIVACY, ...(u.privacy ?? {}) },
    uid: u.uid ?? `U${(u.id ?? Math.random().toString(36)).replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase()}`,
    showUsername: u.showUsername ?? true,
    following: u.following ?? [],
    followers: u.followers ?? [],
    likedUsers: u.likedUsers ?? [],
    createdAt: u.createdAt ?? new Date().toISOString(),
  }
}
