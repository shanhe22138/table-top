import type { GameKind, Settings } from '../types'

/**
 * 分类依据：
 * - 剧本杀：行业通行的「玩法类型（本格/变格/还原/情感/机制/阵营…）+ 推理流派 + 题材」三层，
 *   参考国内发行与测评平台（谜圈、小黑探、剧游网）的通用口径。
 * - 桌游：沿用 BoardGameGeek 的 Categories / Mechanics 两套官方维度，题材单列一层。
 * - 其余玩法各自有更贴切的维度（跑团看规则体系，社交推理看具体局）。
 *
 * 这里只是「默认值」。管理员可以在录入后台增删，改动写进 settings.taxonomy。
 */
export interface Facet {
  key: string
  label: string
  tags: string[]
}

export const FACETS: Record<GameKind, Facet[]> = {
  script: [
    {
      key: 'genre',
      label: '玩法类型',
      tags: ['硬核推理', '还原', '情感', '恐怖', '欢乐', '机制', '阵营', '沉浸'],
    },
    { key: 'logic', label: '推理流派', tags: ['本格', '变格', '社会派'] },
    {
      key: 'setting',
      label: '题材',
      tags: ['现代', '古风', '民国', '日式', '欧式', '校园', '科幻', '架空'],
    },
  ],
  board: [
    {
      key: 'category',
      label: '类型',
      tags: ['策略', '德式', '美式', '聚会', '卡牌', '骰子', '抽象', '战棋'],
    },
    {
      key: 'mechanic',
      label: '机制',
      tags: [
        '工人放置',
        '区域控制',
        '手牌管理',
        '牌库构筑',
        '卡牌轮抽',
        '骰子驱动',
        '板块放置',
        '成套收集',
        '隐藏身份',
        '社交推理',
        '资源管理',
        '引擎构筑',
        '竞拍',
        '合作',
        '可变玩家能力',
      ],
    },
    {
      key: 'setting',
      label: '题材',
      tags: ['奇幻', '科幻', '历史', '恐怖', '经济', '文明', '探险', '自然'],
    },
  ],
  trpg: [
    {
      key: 'system',
      label: '规则体系',
      tags: ['DND 5e', 'COC 7th', '克苏鲁', '轻规则', '房规', '其他'],
    },
    { key: 'tone', label: '风格', tags: ['调查', '战斗', '叙事', '恐怖', '喜剧', '长团', '短团'] },
  ],
  soup: [{ key: 'genre', label: '类型', tags: ['本格', '变格', '恐怖', '温情', '脑洞', '逻辑'] }],
  social: [
    {
      key: 'game',
      label: '玩法',
      tags: ['狼人杀', '阿瓦隆', '血染钟楼', '一夜狼', '其他'],
    },
    { key: 'tone', label: '风格', tags: ['竞技', '娱乐', '新手局', '高手局'] },
  ],
  tcg: [
    { key: 'game', label: '玩法', tags: ['游戏王', '万智牌', '宝可梦', '数码宝贝', '其他'] },
    { key: 'format', label: '赛制', tags: ['标准', '扩展', '限制', '娱乐'] },
  ],
}

export function facetsOf(kind: GameKind): Facet[] {
  return FACETS[kind] ?? []
}

/** 把分面展开成一串标签，用于「全部标签」的横滑条 */
export function tagsOf(kind: GameKind): string[] {
  return facetsOf(kind).flatMap((f) => f.tags)
}

export const DEFAULT_TAXONOMY: Record<GameKind, string[]> = {
  script: tagsOf('script'),
  board: tagsOf('board'),
  trpg: tagsOf('trpg'),
  soup: tagsOf('soup'),
  social: tagsOf('social'),
  tcg: tagsOf('tcg'),
}

/** 地点：先只留三个，够用且不容易选错；管理员可以再加 */
export const DEFAULT_LOCATIONS = ['浦东', '青浦', '杭州']

export const SETTINGS_ID = 'app'

export function defaultSettings(ownerId: string | null = null): Settings {
  return {
    id: SETTINGS_ID,
    locations: [...DEFAULT_LOCATIONS],
    taxonomy: JSON.parse(JSON.stringify(DEFAULT_TAXONOMY)),
    ownerId,
    feedbackEmail: '',
    smtp: null,
    updatedAt: new Date().toISOString(),
  }
}

/** 按标签反查它属于哪个分面，用于详情页分组展示 */
export function facetOfTag(kind: GameKind, tag: string): Facet | null {
  return facetsOf(kind).find((f) => f.tags.includes(tag)) ?? null
}
