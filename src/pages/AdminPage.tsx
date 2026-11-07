import { useMemo, useRef, useState } from 'react'
import { mutate, resetDB, uid, useDB, useSettings } from '../store/db'
import { setUserRole, transferOwner, useAuth } from '../store/auth'
import { SEED_GAMES } from '../data/games'
import { getBackend } from '../lib/backend'
import { navigate } from '../lib/router'
import { buildTestEvents, TEST_NOTE } from '../lib/testdata'
import {
  Button,
  Chip,
  ConfirmDialog,
  EmptyState,
  Field,
  ImagePicker,
  MonthPicker,
  Sheet,
  Tag,
} from '../components/ui'
import { Icon } from '../components/Icons'
import { CoverArt } from '../components/CoverArt'
import { PsychEditor } from '../components/PsychEditor'
import CrossSelect from '../components/CrossSelect'
import {
  GAME_KINDS,
  KIND_LABEL,
  OP_SCOPE_LABEL,
  PLAY_OPTIONS,
  ROLE_LABEL,
  difficultyLabel,
  playOption,
  type Chart,
  type ChartEntry,
  type Game,
  type GameKind,
  type Role,
  type UserRole,
  type PsychTest,
} from '../types'
import { facetsOf } from '../lib/taxonomy'
import { dateKeyOf, durationText, gameTitle, toDateKey } from '../lib/format'
import { COVER_SIZE, readImageAsDataUrl } from '../lib/image'
import { toCSV } from '../store/social'
import { downloadText, pickBinaryFile, saveBinaryFile } from '../lib/platform'
import { convertImportedGames, createSampleWorkbook, parseExcelGames } from '../lib/gameImport'

type Tab = 'new' | 'import' | 'manage' | 'chart' | 'config' | 'perm' | 'logs' | 'tools' | 'data'

const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'new', label: '新增条目' },
  { value: 'import', label: '批量导入' },
  { value: 'manage', label: '条目管理' },
  { value: 'chart', label: '月度榜单' },
  { value: 'config', label: '地点与分类' },
  { value: 'perm', label: '权限' },
  { value: 'logs', label: '操作日志' },
  { value: 'tools', label: '测试工具' },
  { value: 'data', label: '数据导出' },
]

const BATCH_COUNTS = [3, 5, 8, 12, 20, 30]

const SAMPLE_JSON = `[
  {
    "title": "示例新本",
    "kind": "script",
    "tags": ["硬核推理", "还原", "民国"],
    "minPlayers": 6,
    "maxPlayers": 6,
    "durationMin": 300,
    "difficulty": 4,
    "rating": 8.5,
    "publisher": "某发行",
    "year": 2024,
    "author": "某作者",
    "description": "一句话简介。"
  }
]`

export default function AdminPage({ initialTab = null }: { initialTab?: string | null }) {
  const db = useDB()
  const settings = useSettings()
  const { user, isOwner } = useAuth()
  const [tab, setTab] = useState<Tab>(() => (TABS.some((t) => t.value === initialTab) ? (initialTab as Tab) : 'new'))
  const [toast, setToast] = useState('')

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  return (
    <div className="anim-rise">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] leading-tight tracking-wide text-paper">管理后台</h1>
          <p className="mt-1 text-[12.5px] text-faint">
            条目、榜单、分类、权限都在这里改。所有改动都会记进操作日志。
          </p>
        </div>
        <span className="rounded-lg border border-brass/30 bg-brass/10 px-2.5 py-1 text-[11.5px] text-brass">
          {ROLE_LABEL[user?.role ?? 'admin']} · {user?.nickname}
        </span>
      </div>

      <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {TABS.map((t) => (
          <Chip key={t.value} active={tab === t.value} onClick={() => setTab(t.value)}>
            {t.label}
          </Chip>
        ))}
      </div>

      <div className="mt-4">
        {tab === 'new' && <NewGamePanel onDone={flash} />}
        {tab === 'import' && <ImportPanel onDone={flash} />}
        {tab === 'manage' && <ManagePanel onDone={flash} />}
        {tab === 'chart' && <ChartPanel onDone={flash} />}
        {tab === 'config' && <ConfigPanel onDone={flash} />}
        {tab === 'perm' && <PermPanel onDone={flash} isOwner={isOwner} />}
        {tab === 'logs' && <LogPanel />}
        {tab === 'tools' && <ToolsPanel onDone={flash} />}
        {tab === 'data' && <DataPanel onDone={flash} />}
      </div>

      <div className="mt-6 rounded-xl border border-line/60 bg-surface/40 px-4 py-3 text-[11.5px] leading-relaxed text-faint">
        站长：{db.users.find((u) => u.id === settings.ownerId)?.nickname ?? '未设置'}。
        只有站长能授予或收回管理员权限；管理员可以维护条目、榜单、地点和分类。
      </div>

      {toast && (
        <div className="anim-fade fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-line bg-surface2 px-4 py-2 text-[12.5px] text-paper shadow-xl">
          {toast}
        </div>
      )}
    </div>
  )
}

/* ───────────────── 新增条目 ───────────────── */

function NewGamePanel({ onDone }: { onDone: (m: string) => void }) {
  const [formKey, setFormKey] = useState(0)
  return (
    <GameForm
      key={formKey}
      submitText="添加到仓库"
      onSubmit={(game) => {
        mutate((d) => {
          d.games.push({ ...game, isNew: true, createdAt: new Date().toISOString() })
        })
        setFormKey((k) => k + 1)
        onDone('已添加到仓库')
      }}
    />
  )
}

/** 新增和编辑共用同一套表单 */
function GameForm({
  initial,
  submitText,
  onSubmit,
}: {
  initial?: Game
  submitText: string
  onSubmit: (g: Game) => void
}) {
  const settings = useSettings()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [kind, setKind] = useState<GameKind>(initial?.kind ?? 'script')
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? '')
  const [cover, setCover] = useState<string | null>(initial?.cover ?? null)
  const [tags, setTags] = useState<string[]>(initial?.tags ?? [])
  const [minP, setMinP] = useState(initial?.minPlayers ?? 6)
  const [maxP, setMaxP] = useState(initial?.maxPlayers ?? 6)
  const [duration, setDuration] = useState(initial?.durationMin ?? 300)
  const [difficulty, setDifficulty] = useState<number>(initial?.difficulty ?? 3)
  const [rating, setRating] = useState(initial?.rating ?? 8)
  const [publisher, setPublisher] = useState(initial?.publisher ?? '')
  const [year, setYear] = useState(initial?.year ?? new Date().getFullYear())
  const [author, setAuthor] = useState(initial?.author ?? '')
  const [desc, setDesc] = useState(initial?.description ?? '')
  const [roles, setRoles] = useState<Role[]>(initial?.roles ?? [])
  const [psychTests, setPsychTests] = useState<PsychTest[]>(initial?.psychTests ?? [])
  const [err, setErr] = useState('')

  const facets = facetsOf(kind)
    .map((f) => ({ ...f, tags: f.tags.filter((t) => (settings.taxonomy[kind] ?? []).includes(t)) }))
    .filter((f) => f.tags.length)

  function submit() {
    if (!title.trim()) {
      setErr('标题必填')
      return
    }
    if (minP > maxP) {
      setErr('最少人数不能大于最多人数')
      return
    }
    onSubmit({
      id: initial?.id ?? uid('g'),
      title: title.trim(),
      kind,
      subtitle: subtitle.trim(),
      cover,
      tags,
      minPlayers: minP,
      maxPlayers: maxP,
      durationMin: duration,
      difficulty: difficulty as Game['difficulty'],
      rating,
      ratingCount: initial?.ratingCount ?? 0,
      publisher: publisher.trim() || '未填写',
      year,
      author: author.trim() || '未填写',
      description: desc.trim(),
      roles: roles.length ? roles.filter((r) => r.name.trim()) : undefined,
      psychTests: psychTests.length
        ? psychTests.filter((t) => t.title.trim() && t.questions.some((q) => q.text.trim()))
        : undefined,
      featured: initial?.featured,
      isNew: initial?.isNew,
      createdAt: initial?.createdAt,
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="标题" className="sm:col-span-2">
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setErr('')
            }}
            placeholder="剧本或桌游的名字（不用加书名号）"
          />
        </Field>
        <Field label="一句话简介" hint="选填" className="sm:col-span-2">
          <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
        </Field>
      </div>

      <Field label="玩法">
        <div className="flex flex-wrap gap-2">
          {GAME_KINDS.map((k) => (
            <Chip
              key={k}
              active={kind === k}
              onClick={() => {
                setKind(k)
                setTags([])
                setRoles([])
                setDifficulty(3)
                setMinP(k === 'board' ? 2 : 6)
                setMaxP(k === 'board' ? 4 : 6)
                setDuration(k === 'soup' ? 45 : k === 'trpg' ? 240 : 180)
              }}
            >
              {KIND_LABEL[k]}
            </Chip>
          ))}
        </div>
      </Field>

      <ImagePicker
        value={cover}
        onChange={setCover}
        width={COVER_SIZE.width}
        height={COVER_SIZE.height}
        label="封面"
        hint="选填，不传就用程序生成的封面"
        previewClassName="aspect-[3/4] w-[68px]"
      />

      {/* 分类 */}
      <div className="space-y-2.5 rounded-xl border border-line bg-surface/50 p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] text-muted">分类</span>
          <span className="text-[11px] text-faint">在「地点与分类」里可以增删这些标签</span>
        </div>
        {facets.map((f) => (
          <div key={f.key}>
            <div className="mb-1 text-[11.5px] text-faint">{f.label}</div>
            <div className="flex flex-wrap gap-2">
              {f.tags.map((t) => (
                <Chip
                  key={t}
                  active={tags.includes(t)}
                  onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}
                >
                  {t}
                </Chip>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="最少人数">
          <input type="number" value={minP} onChange={(e) => setMinP(Number(e.target.value))} min={1} />
        </Field>
        <Field label="最多人数">
          <input type="number" value={maxP} onChange={(e) => setMaxP(Number(e.target.value))} min={1} />
        </Field>
        <Field label="时长（分钟）">
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            step={15}
            min={15}
          />
        </Field>
        <Field label="评分 0–10">
          <input
            type="number"
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
            step={0.1}
            min={0}
            max={10}
          />
        </Field>
        <Field label="发行">
          <input value={publisher} onChange={(e) => setPublisher(e.target.value)} />
        </Field>
        <Field label="年份">
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </Field>
        <Field label="作者">
          <input value={author} onChange={(e) => setAuthor(e.target.value)} />
        </Field>
      </div>

      <Field label="难度" hint={kind === 'board' ? '沿用 BGG weight' : '按该玩法的通行说法'}>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((d) => (
            <Chip key={d} active={difficulty === d} onClick={() => setDifficulty(d)}>
              {difficultyLabel(kind, d)}
            </Chip>
          ))}
        </div>
      </Field>

      {(kind === 'script' || kind === 'trpg') && (
        <div className="rounded-xl border border-line bg-surface/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] text-muted">角色表</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setRoles([...roles, { name: '', gender: '不限', difficulty: 3, brief: '' }])
              }
            >
              <Icon name="plus" size={13} /> 加一个角色
            </Button>
          </div>
          <p className="mb-2 text-[11px] leading-relaxed text-faint">
            填了角色表，玩家在展柜里就能直接搜到这些角色，不用自己手打。
          </p>
          <div className="space-y-2">
            {roles.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
                <input
                  value={r.name}
                  onChange={(e) =>
                    setRoles(roles.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                  }
                  placeholder="角色名"
                  className="!py-1.5 !text-[12.5px]"
                />
                <CrossSelect
                  value={r.gender}
                  options={['男', '女', '不限'].map((value) => ({ value, label: value }))}
                  onChange={(value) =>
                    setRoles(
                      roles.map((x, j) =>
                        j === i ? { ...x, gender: value as Role['gender'] } : x,
                      ),
                    )
                  }
                  className="!w-auto !py-1.5 !text-[12px]"
                />
                <CrossSelect
                  value={r.difficulty}
                  options={[1, 2, 3, 4, 5].map((value) => ({ value, label: `${value} 档` }))}
                  onChange={(value) =>
                    setRoles(
                      roles.map((x, j) =>
                        j === i
                          ? { ...x, difficulty: Number(value) as Role['difficulty'] }
                          : x,
                      ),
                    )
                  }
                  className="!w-auto !py-1.5 !text-[12px]"
                />
                <button
                  onClick={() => setRoles(roles.filter((_, j) => j !== i))}
                  className="rounded p-1 text-faint hover:text-seal"
                  aria-label="删除角色"
                >
                  <Icon name="close" size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Field label="详细简介">
        <textarea rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} />
      </Field>

      {/* 心测题库（剧本杀适配问卷，可由车头发车时基于它改编） */}
      <div className="space-y-2.5 rounded-xl border border-line bg-surface/50 p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] text-muted">心测题库</span>
          {kind === 'script' ? (
            <span className="text-[11px] text-faint">剧本杀可在发车时启用，让玩家先做适配问卷</span>
          ) : (
            <span className="text-[11px] text-faint">心测一般用于剧本杀</span>
          )}
        </div>
        {psychTests.map((t, i) => (
          <details
            key={i}
            className="rounded-lg border border-line bg-ink/30 p-2.5"
            open={psychTests.length === 1}
          >
            <summary className="flex cursor-pointer items-center gap-2 text-[12.5px] text-paper">
              <Icon name="list" size={13} className="text-brass" />
              <span className="truncate">{t.title || `问卷 ${i + 1}`}</span>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  setPsychTests(psychTests.filter((_, j) => j !== i))
                }}
                className="ml-auto rounded p-1 text-faint hover:text-seal"
                aria-label="删除问卷"
              >
                <Icon name="close" size={13} />
              </button>
            </summary>
            <div className="mt-2.5">
              <PsychEditor
                value={t}
                onChange={(nt) => setPsychTests(psychTests.map((x, j) => (j === i ? nt : x)))}
              />
            </div>
          </details>
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setPsychTests([
              ...psychTests,
              {
                id: `pt_${Date.now().toString(36)}`,
                title: '',
                questions: [
                  {
                    id: `q_${Date.now().toString(36)}`,
                    text: '',
                    options: [
                      { id: `o_${Date.now().toString(36)}a`, label: '', tag: '' },
                      { id: `o_${Date.now().toString(36)}b`, label: '', tag: '' },
                    ],
                  },
                ],
              },
            ])
          }
        >
          <Icon name="plus" size={13} /> 加一份问卷
        </Button>
      </div>

      {err && <p className="text-[12.5px] text-seal">{err}</p>}

      <Button size="lg" className="w-full" onClick={submit}>
        {submitText}
      </Button>
    </div>
  )
}

function emptyGame(kind: GameKind): Game {
  return {
    id: 'preview',
    title: '未命名',
    kind,
    subtitle: '',
    cover: null,
    tags: [],
    minPlayers: 2,
    maxPlayers: 4,
    durationMin: 120,
    difficulty: 3,
    rating: 0,
    ratingCount: 0,
    publisher: '',
    year: new Date().getFullYear(),
    author: '',
    description: '',
  }
}

/* ───────────────── 批量导入 ───────────────── */

function ImportPanel({ onDone }: { onDone: (m: string) => void }) {
  const [raw, setRaw] = useState('')
  const [msg, setMsg] = useState('')
  const [excelBusy, setExcelBusy] = useState(false)

  function commit(games: Game[], errors: string[]) {
    if (!games.length) {
      setMsg(errors.join('\n') || '没有可导入的条目。')
      return
    }
    mutate((d) => { d.games.push(...games) })
    setRaw('')
    setMsg(`导入成功 ${games.length} 条${errors.length ? `，另有 ${errors.length} 条未导入` : ''}。${errors.length ? `\n${errors.join('\n')}` : ''}`)
    onDone('导入完成')
  }

  function runJson() {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      setMsg('JSON 格式不对，检查一下引号和逗号。')
      return
    }
    const result = convertImportedGames(parsed)
    commit(result.games, result.errors)
  }

  async function runExcel() {
    setExcelBusy(true)
    setMsg('')
    try {
      const data = await pickBinaryFile('xlsx')
      if (!data) return
      const result = await parseExcelGames(data)
      commit(result.games, result.errors)
    } catch (error) {
      setMsg(`Excel 读取失败：${(error as Error).message}`)
    } finally {
      setExcelBusy(false)
    }
  }

  async function downloadSample() {
    setExcelBusy(true)
    setMsg('')
    try {
      const data = await createSampleWorkbook()
      await saveBinaryFile('table-top-import-sample.xlsx', data,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      setMsg('样例已生成，包含字段说明、六类示例、完整角色/心测案例和常见错误说明。')
    } catch (error) {
      setMsg(`样例生成失败：${(error as Error).message}`)
    } finally {
      setExcelBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line/70 bg-surface/50 px-4 py-3 text-[11.5px] leading-relaxed text-faint">
        推荐先下载 Excel 样例。样例有 4 个工作表：字段说明、六类玩法示例、包含角色与心测的完整示例、合法取值与常见错误。
        上传时只读取“示例数据”工作表；如果改名或删除，则读取第一个工作表。第一行必须保留 <code className="text-brass/90">title</code> 列。
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="flex-1" disabled={excelBusy} onClick={() => void downloadSample()}>
          下载 Excel 样例
        </Button>
        <Button className="flex-1" disabled={excelBusy} onClick={() => void runExcel()}>
          {excelBusy ? '处理中…' : '上传 Excel 并导入'}
        </Button>
      </div>
      <div className="rounded-xl border border-line/60 bg-surface/30 p-3">
        <p className="mb-2 text-[12px] text-muted">也可以使用 JSON 数组</p>
        <textarea
          rows={12}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={SAMPLE_JSON}
          className="font-mono !text-[12px] leading-relaxed"
        />
        <div className="mt-2 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setRaw(SAMPLE_JSON)}>
            填入 JSON 示例
          </Button>
          <Button variant="soft" className="flex-1" onClick={runJson} disabled={!raw.trim()}>
            导入 JSON
          </Button>
        </div>
      </div>
      {msg && (
        <div className={`whitespace-pre-wrap rounded-lg border px-3 py-2 text-[12px] leading-relaxed ${msg.startsWith('导入成功') || msg.startsWith('样例已生成') ? 'border-jade/30 bg-jade/10 text-jade' : 'border-seal/30 bg-seal/10 text-seal'}`}>
          {msg}
        </div>
      )}
    </div>
  )
}

/* ───────────────── 条目管理 ───────────────── */

function ManagePanel({ onDone }: { onDone: (m: string) => void }) {
  const db = useDB()
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<'all' | GameKind>('all')
  const [delId, setDelId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return db.games.filter(
      (g) => (kind === 'all' || g.kind === kind) && (!s || g.title.toLowerCase().includes(s)),
    )
  }, [db.games, q, kind])

  const delGame = db.games.find((g) => g.id === delId) ?? null
  const editGame = db.games.find((g) => g.id === editId) ?? null

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="搜条目"
        className="!py-2 !text-[13px]"
      />
      <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
        <Chip active={kind === 'all'} onClick={() => setKind('all')}>
          全部
        </Chip>
        {GAME_KINDS.map((k) => (
          <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
            {KIND_LABEL[k]}
          </Chip>
        ))}
      </div>

      <div className="mt-3 space-y-1.5">
        {list.map((g) => (
          <div key={g.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface/60 p-2">
            <div className="relative h-12 w-9 shrink-0 overflow-hidden rounded-md border border-line">
              <CoverArt game={g} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[12.5px] text-paper">{gameTitle(g)}</span>
                {g.isNew && (
                  <span className="shrink-0 rounded bg-brass/15 px-1 text-[9.5px] text-brass">新</span>
                )}
                {g.featured && (
                  <span className="shrink-0 rounded bg-jade/15 px-1 text-[9.5px] text-jade">精选</span>
                )}
              </div>
              <div className="text-[10.5px] text-faint">
                {KIND_LABEL[g.kind]} ·{' '}
                {g.minPlayers === g.maxPlayers ? `${g.minPlayers} 人` : `${g.minPlayers}-${g.maxPlayers} 人`} ·{' '}
                {durationText(g.durationMin)} · {difficultyLabel(g.kind, g.difficulty)}
              </div>
            </div>
            <button
              onClick={() => setEditId(g.id)}
              className="rounded-lg p-1.5 text-faint hover:text-brass"
              aria-label={`编辑${gameTitle(g)}`}
            >
              <Icon name="edit" size={15} />
            </button>
            <button
              onClick={() =>
                mutate((d) => {
                  const t = d.games.find((x) => x.id === g.id)
                  if (t) t.featured = !t.featured
                })
              }
              className={`rounded-lg p-1.5 ${g.featured ? 'text-jade' : 'text-faint hover:text-jade'}`}
              aria-label="切换精选"
            >
              <Icon name="star" size={15} />
            </button>
            <button
              onClick={() => setDelId(g.id)}
              className="rounded-lg p-1.5 text-faint hover:text-seal"
              aria-label="删除"
            >
              <Icon name="trash" size={15} />
            </button>
          </div>
        ))}
      </div>

      {list.length === 0 && <EmptyState icon="search" title="没有匹配的条目" />}

      <Sheet
        open={!!editGame}
        onClose={() => setEditId(null)}
        title={`编辑${editGame ? gameTitle(editGame) : ''}`}
        subtitle="改完点底部的保存"
        wide
      >
        {editGame && (
          <GameForm
            key={editGame.id}
            initial={editGame}
            submitText="保存修改"
            onSubmit={(next) => {
              mutate((d) => {
                const i = d.games.findIndex((x) => x.id === next.id)
                if (i >= 0) d.games[i] = next
              })
              setEditId(null)
              onDone('已保存修改')
            }}
          />
        )}
      </Sheet>

      <ConfirmDialog
        open={!!delId}
        title={`删除${delGame ? gameTitle(delGame) : ''}？`}
        desc="引用了它的活动不会一起删掉，但详情页会显示成「条目已删除」。"
        confirmText="删除"
        onCancel={() => setDelId(null)}
        onConfirm={() => {
          mutate((d) => {
            d.games = d.games.filter((x) => x.id !== delId)
          })
          setDelId(null)
          onDone('已删除')
        }}
      />

      <div className="mt-6 rounded-xl border border-line bg-surface/50 p-4">
        <h3 className="text-[13px] text-paper">示例条目</h3>
        <p className="mt-1 text-[11.5px] leading-relaxed text-faint">
          一键导入 {SEED_GAMES.length} 条示例数据，用来把仓库和时刻填满。重复导入不会产生重复条目。
        </p>
        <Button
          size="sm"
          variant="outline"
          className="mt-2.5"
          onClick={() => {
            mutate((d) => {
              const have = new Set(d.games.map((g) => g.id))
              d.games.push(...SEED_GAMES.filter((g) => !have.has(g.id)))
            })
            onDone('已导入示例条目')
          }}
        >
          导入示例条目
        </Button>
      </div>
    </div>
  )
}

/* ───────────────── 月度榜单 ───────────────── */

type MonthSection = 'board' | 'script' | 'social'

interface ParsedLine {
  title: string
  heat: number | null
  note: string
}

/** 整月数据：分区 + 每行「名字 | 热度 | 备注」，分隔符支持 | ｜ 空格 */
function parseMonth(text: string) {
  const out: Record<MonthSection, ParsedLine[]> = { board: [], script: [], social: [] }
  let section: MonthSection = 'board'
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const head = line.replace(/^[#[\s]+/, '').replace(/[\]\s]+$/, '')
    if (/^桌游/.test(head) && head.length <= 6) {
      section = 'board'
      continue
    }
    if (/^剧本/.test(head) && head.length <= 8) {
      section = 'script'
      continue
    }
    if (/^(社交|狼人杀|阿瓦隆|血染)/.test(head) && head.length <= 6 && !/[|｜]/.test(line)) {
      section = 'social'
    }
    const parts = line.split(/[|｜]/).map((x) => x.trim())
    const title = parts[0] ?? ''
    if (!title) continue
    let heat: number | null = null
    let note = ''
    for (const p of parts.slice(1)) {
      if (!p) continue
      if (heat === null && /^\d+$/.test(p)) heat = Math.max(0, Math.min(100, Number(p)))
      else note = note ? `${note} · ${p}` : p
    }
    // 社交推理允许「狼人杀 82」这种写法
    if (section === 'social' && heat === null) {
      const m = title.match(/^(.*?)\s+(\d{1,3})$/)
      if (m) {
        out.social.push({ title: m[1], heat: Math.min(100, Number(m[2])), note })
        continue
      }
    }
    out[section].push({ title, heat, note })
  }
  return out
}

const SOCIAL_KEYS = ['werewolf', 'botc', 'avalon']

function ChartPanel({ onDone }: { onDone: (m: string) => void }) {
  const db = useDB()
  const latest = db.charts[0] ?? null
  const [period, setPeriod] = useState(() => latest?.period ?? new Date().toISOString().slice(0, 7))
  const [text, setText] = useState('')
  const [social, setSocial] = useState<Record<string, number>>(() => {
    const base: Record<string, number> = { werewolf: 60, botc: 60, avalon: 60 }
    for (const s of latest?.social ?? []) base[s.key] = s.heat
    return base
  })
  const [msg, setMsg] = useState('')

  const parsed = useMemo(() => parseMonth(text), [text])

  function loadCurrent() {
    if (!latest) return
    const lines: string[] = ['# 桌游']
    for (const e of latest.board) {
      lines.push([e.title, e.heat ?? '', e.note].filter((x) => x !== '').join(' | '))
    }
    lines.push('', '# 剧本杀')
    for (const e of latest.script) {
      lines.push([e.title, e.heat ?? '', e.note].filter((x) => x !== '').join(' | '))
    }
    lines.push('', '# 社交推理')
    for (const s of latest.social) {
      lines.push(`${playOption(s.key)?.label ?? s.key} ${s.heat}`)
    }
    setText(lines.join('\n'))
    const next: Record<string, number> = { ...social }
    for (const s of latest.social) next[s.key] = s.heat
    setSocial(next)
    setMsg(`已载入 ${latest.period} 的数据，改完再点下面的按钮。`)
  }

  function buildEntries(
    lines: ParsedLine[],
    kind: GameKind,
    created: Game[],
    used: Set<string>,
  ): ChartEntry[] {
    return lines.map((l, i) => {
      const found = db.games.find((g) => g.title === l.title && !used.has(g.id))
      const base = { rank: i + 1, note: l.note, ...(l.heat === null ? {} : { heat: l.heat }) }
      if (found) {
        used.add(found.id)
        return { ...base, gameId: found.id, title: found.title }
      }
      const g: Game = {
        ...emptyGame(kind),
        id: uid('g'),
        title: l.title,
        subtitle: '榜单导入时自动建条目',
        isNew: true,
        createdAt: new Date().toISOString(),
      }
      created.push(g)
      used.add(g.id)
      return { ...base, gameId: g.id, title: l.title }
    })
  }

  function run() {
    const { board, script, social: socialLines } = parsed
    if (!board.length && !script.length && !socialLines.length && !text.trim()) {
      setMsg('先把整月数据粘进来。')
      return
    }
    const created: Game[] = []
    const used = new Set<string>()
    const boardEntries = buildEntries(board, 'board', created, used)
    const scriptEntries = buildEntries(script, 'script', created, used)

    // 社交推理：优先用文本里的，其次用手填的数字
    const heatMap: Record<string, number> = { ...social }
    for (const l of socialLines) {
      const opt = PLAY_OPTIONS.find((p) => p.label === l.title && p.kind === 'social')
      if (opt && l.heat !== null) heatMap[opt.key] = l.heat
    }

    const chart: Chart = {
      id: period,
      period,
      board: boardEntries,
      script: scriptEntries,
      social: SOCIAL_KEYS.filter((k) => typeof heatMap[k] === 'number').map((k) => ({
        key: k,
        heat: Math.max(0, Math.min(100, Number(heatMap[k]))),
      })),
      updatedAt: new Date().toISOString(),
    }
    mutate((d) => {
      d.games.push(...created)
      d.charts = [chart, ...d.charts.filter((c) => c.id !== chart.id)]
    })
    setMsg(
      `已更新 ${period}：桌游 ${boardEntries.length} 条、剧本杀 ${scriptEntries.length} 条、社交推理 ${chart.social.length} 项${
        created.length ? `，自动新建 ${created.length} 个条目` : ''
      }。`,
    )
    onDone('榜单已更新')
  }

  const total = parsed.board.length + parsed.script.length + parsed.social.length

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line/70 bg-surface/50 px-4 py-3 text-[11.5px] leading-relaxed text-faint">
        一次贴完整个月的数据。用
        <code className="mx-1 text-brass/90"># 桌游</code>
        <code className="mx-1 text-brass/90"># 剧本杀</code>
        <code className="mx-1 text-brass/90"># 社交推理</code>
        分区，每行写成
        <code className="mx-1 text-brass/90">名字 | 热度 | 备注</code>
        （热度与备注都可以省）。仓库里没有的名字会自动建成新条目。
      </div>

      <div>
        <div className="mb-1.5 text-[13px] text-muted">期号</div>
        <MonthPicker value={period} onChange={setPeriod} />
      </div>

      {latest && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface/50 px-3.5 py-2.5">
          <span className="text-[12px] text-faint">
            当前生效：<span className="text-muted">{latest.period}</span>
          </span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={loadCurrent}>
            载入这期
          </Button>
        </div>
      )}

      <Field label="整月数据" hint="支持一次粘贴全部">
        <textarea
          rows={12}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'# 桌游\n方舟动物园 | 92 | 连续三个月在榜\n盖亚计划 | 78\n\n# 剧本杀\n死者在幻夜中醒来 | 88\n年轮 | 76 | 老本回榜\n\n# 社交推理\n狼人杀 82\n阿瓦隆 54\n血染钟楼 68'}
        />
      </Field>

      {total > 0 && (
        <div className="rounded-xl border border-line/70 bg-surface2/30 px-3.5 py-2.5 text-[11.5px] text-faint">
          解析到 桌游 {parsed.board.length} 条 · 剧本杀 {parsed.script.length} 条 · 社交推理{' '}
          {parsed.social.length} 项
        </div>
      )}

      <Field label="社交推理热度" hint="0–100，文本里没写就用这里的数">
        <div className="grid grid-cols-3 gap-2">
          {PLAY_OPTIONS.filter((p) => SOCIAL_KEYS.includes(p.key)).map((p) => (
            <label key={p.key} className="block">
              <span className="mb-1 block text-[11.5px] text-faint">{p.label}</span>
              <input
                type="number"
                min={0}
                max={100}
                value={social[p.key] ?? 0}
                onChange={(e) => setSocial({ ...social, [p.key]: Number(e.target.value) })}
                className="!py-1.5 !text-center !text-[13px] tabular-nums"
              />
            </label>
          ))}
        </div>
      </Field>

      {msg && <p className="text-[12.5px] text-jade">{msg}</p>}

      <Button className="w-full" onClick={run}>
        导入并更新推荐位
      </Button>

      {latest && (
        <div className="rounded-xl border border-line bg-surface/50 p-3.5">
          <div className="mb-2 text-[12px] text-muted">当前生效明细 · {latest.period}</div>
          <div className="space-y-1.5 text-[11.5px] text-faint">
            <div>桌游：{latest.board.map((e) => `${e.rank}.${e.title}`).join('  ')}</div>
            <div>剧本杀：{latest.script.map((e) => `${e.rank}.${e.title}`).join('  ')}</div>
            <div>
              社交推理：
              {latest.social
                .map((s) => `${playOption(s.key)?.label ?? s.key} ${s.heat}`)
                .join('  ')}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ───────────────── 地点与分类 ───────────────── */

function ConfigPanel({ onDone }: { onDone: (m: string) => void }) {
  const settings = useSettings()
  const [loc, setLoc] = useState('')
  const [kind, setKind] = useState<GameKind>('script')
  const [tag, setTag] = useState('')

  function addLocation() {
    const v = loc.trim()
    if (!v) return
    if (settings.locations.includes(v)) {
      onDone('这个地点已经有了')
      return
    }
    mutate((d) => {
      if (!d.settings.length) return
      d.settings[0].locations.push(v)
      d.settings[0].updatedAt = new Date().toISOString()
    })
    setLoc('')
    onDone('已添加地点')
  }

  function removeLocation(v: string) {
    mutate((d) => {
      if (!d.settings.length) return
      d.settings[0].locations = d.settings[0].locations.filter((x) => x !== v)
      d.settings[0].updatedAt = new Date().toISOString()
    })
  }

  function addTag() {
    const v = tag.trim()
    if (!v) return
    if ((settings.taxonomy[kind] ?? []).includes(v)) {
      onDone('这个标签已经有了')
      return
    }
    mutate((d) => {
      if (!d.settings.length) return
      d.settings[0].taxonomy[kind] = [...(d.settings[0].taxonomy[kind] ?? []), v]
      d.settings[0].updatedAt = new Date().toISOString()
    })
    setTag('')
    onDone('已添加分类')
  }

  function removeTag(v: string) {
    mutate((d) => {
      if (!d.settings.length) return
      d.settings[0].taxonomy[kind] = (d.settings[0].taxonomy[kind] ?? []).filter((x) => x !== v)
      d.settings[0].updatedAt = new Date().toISOString()
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-1 text-[13px] text-paper">地点</h3>
        <p className="mb-2 text-[11.5px] text-faint">
          发车和偏好里能直接点的地点。玩家也可以自己填别的地点。
        </p>
        <div className="flex flex-wrap gap-2">
          {settings.locations.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface2/60 px-3 py-1.5 text-[13px] text-muted"
            >
              {v}
              <button onClick={() => removeLocation(v)} className="text-faint hover:text-seal" aria-label={`删除 ${v}`}>
                <Icon name="close" size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={loc}
            onChange={(e) => setLoc(e.target.value)}
            placeholder="加一个地点，比如：徐汇"
            className="!py-2 !text-[13px]"
            onKeyDown={(e) => {
              if (e.key === 'Enter') addLocation()
            }}
          />
          <Button size="sm" onClick={addLocation}>
            添加
          </Button>
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-[13px] text-paper">分类标签</h3>
        <p className="mb-2 text-[11.5px] leading-relaxed text-faint">
          默认按剧本杀（玩法 / 流派 / 题材）和桌游（BGG 的类型 / 机制 / 题材）分好，可以按自己的口径增删。
          删掉的标签不会从已有条目上消失，只是不再出现在筛选和录入里。
        </p>
        <div className="no-scrollbar mb-2 flex gap-2 overflow-x-auto pb-1">
          {GAME_KINDS.map((k) => (
            <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
              {KIND_LABEL[k]}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(settings.taxonomy[kind] ?? []).map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface2/60 px-3 py-1.5 text-[13px] text-muted"
            >
              {v}
              <button onClick={() => removeTag(v)} className="text-faint hover:text-seal" aria-label={`删除 ${v}`}>
                <Icon name="close" size={12} />
              </button>
            </span>
          ))}
          {(settings.taxonomy[kind] ?? []).length === 0 && (
            <span className="text-[12px] text-faint">这一类还没有标签</span>
          )}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="加一个标签"
            className="!py-2 !text-[13px]"
            onKeyDown={(e) => {
              if (e.key === 'Enter') addTag()
            }}
          />
          <Button size="sm" onClick={addTag}>
            添加
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-line/70 bg-surface/50 px-4 py-3 text-[11.5px] leading-relaxed text-faint">
        分类是「先维度后标签」的两层结构：维度决定详情页和筛选器怎么分组，标签决定一个条目属于哪一档。
        新增的标签会直接出现在「新增条目」和玩家的偏好设置里。
      </div>
    </div>
  )
}

/* ───────────────── 权限 ───────────────── */

function PermPanel({ onDone, isOwner }: { onDone: (m: string) => void; isOwner: boolean }) {
  const db = useDB()
  const settings = useSettings()
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null)
  const target = db.users.find((u) => u.id === confirmTarget) ?? null

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line/70 bg-surface/50 px-4 py-3 text-[11.5px] leading-relaxed text-faint">
        管理员可以维护条目、榜单、地点和分类，也能看到操作日志。
        站长身份只有一个，{isOwner ? '你可以把它转给别人。' : '只有站长能改这些。'}
      </div>

      {db.users.map((u) => {
        const isOwnerRow = u.id === settings.ownerId || u.role === 'owner'
        return (
          <div key={u.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface/60 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[13px] text-paper">{u.nickname}</span>
                <span className="text-[11px] text-faint">@{u.username}</span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
                    isOwnerRow
                      ? 'bg-brass/15 text-brass'
                      : u.role === 'admin'
                        ? 'bg-jade/15 text-jade'
                        : 'bg-surface3 text-faint'
                  }`}
                >
                  {ROLE_LABEL[u.role]}
                </span>
              </div>
              <div className="mt-0.5 text-[10.5px] text-faint">
                {u.prefs.plays.map((p) => PLAY_OPTIONS.find((o) => o.key === p)?.label ?? p).join(' / ') || '还没填偏好'}
              </div>
            </div>
            {isOwner && !isOwnerRow && (
              <div className="flex shrink-0 gap-1.5">
                <Button
                  size="sm"
                  variant={u.role === 'admin' ? 'ghost' : 'outline'}
                  onClick={() => {
                    setUserRole(u.id, (u.role === 'admin' ? 'user' : 'admin') as UserRole)
                    onDone(u.role === 'admin' ? '已收回管理员' : '已设为管理员')
                  }}
                >
                  {u.role === 'admin' ? '收回权限' : '设为管理员'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmTarget(u.id)}>
                  转让站长
                </Button>
              </div>
            )}
          </div>
        )
      })}

      <ConfirmDialog
        open={!!confirmTarget}
        title={`把站长转给「${target?.nickname ?? ''}」？`}
        desc="转过去之后你就不再是站长，只能保留管理员权限，而且不能再改回来。"
        confirmText="确认转让"
        onCancel={() => setConfirmTarget(null)}
        onConfirm={() => {
          if (confirmTarget) transferOwner(confirmTarget)
          setConfirmTarget(null)
          onDone('站长已转让')
        }}
      />
    </div>
  )
}

/* ───────────────── 操作日志 ───────────────── */

function LogPanel() {
  const db = useDB()
  const { isOwner } = useAuth()
  const [q, setQ] = useState('')
  const [scope, setScope] = useState<'all' | 'user' | 'admin'>('all')
  const [clearOpen, setClearOpen] = useState(false)

  const list = useMemo(() => {
    const s = q.trim()
    return db.logs.filter((l) => {
      if (scope !== 'all' && l.scope !== scope) return false
      if (!s) return true
      return (
        l.userName.includes(s) ||
        l.action.includes(s) ||
        l.target.includes(s) ||
        l.detail.includes(s)
      )
    })
  }, [db.logs, q, scope])

  const counts = useMemo(
    () => ({
      all: db.logs.length,
      user: db.logs.filter((l) => l.scope === 'user').length,
      admin: db.logs.filter((l) => l.scope === 'admin').length,
    }),
    [db.logs],
  )

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜人、动作或对象"
          className="!py-2 !text-[13px]"
        />
        {isOwner && (
          <Button size="sm" variant="danger" onClick={() => setClearOpen(true)}>
            清空
          </Button>
        )}
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        {(
          [
            ['all', `全部 ${counts.all}`],
            ['user', `普通操作 ${counts.user}`],
            ['admin', `需要权限 ${counts.admin}`],
          ] as Array<['all' | 'user' | 'admin', string]>
        ).map(([v, label]) => (
          <Chip key={v} active={scope === v} onClick={() => setScope(v)}>
            {label}
          </Chip>
        ))}
        <span className="ml-auto text-[11px] text-faint">最多保留 400 条</span>
      </div>

      <div className="space-y-1">
        {list.map((l) => (
          <div key={l.id} className="flex items-start gap-2 rounded-lg border border-line/70 bg-surface/50 px-2.5 py-2">
            <span className="w-[74px] shrink-0 text-[10.5px] tabular-nums text-faint">
              {new Date(l.at).toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <span className="w-[52px] shrink-0 truncate text-[11px] text-muted">{l.userName}</span>
            <span className="w-[70px] shrink-0 text-[11px] text-brass/90">{l.action}</span>
            <span
              className={`w-[54px] shrink-0 rounded px-1 py-0.5 text-center text-[10px] ${
                l.scope === 'admin' ? 'bg-brass/15 text-brass' : 'bg-surface3 text-faint'
              }`}
            >
              {OP_SCOPE_LABEL[l.scope] ?? '普通操作'}
            </span>
            <span className="min-w-0 flex-1 text-[11.5px] text-paper">
              <span className="line-clamp-1">{l.target}</span>
              {l.detail && <span className="ml-1 text-[10.5px] text-faint">（{l.detail}）</span>}
            </span>
          </div>
        ))}
      </div>

      {list.length === 0 && <EmptyState icon="list" title="还没有日志" desc="有人操作之后这里会出现记录。" />}

      <ConfirmDialog
        open={clearOpen}
        title="清空操作日志？"
        desc="只删日志，不影响任何条目、活动和账号。"
        confirmText="清空"
        onCancel={() => setClearOpen(false)}
        onConfirm={() => {
          mutate((d) => {
            d.logs = []
          })
          setClearOpen(false)
        }}
      />
    </div>
  )
}

/* ───────────────── 测试工具 ───────────────── */

function ToolsPanel({ onDone }: { onDone: (m: string) => void }) {
  const db = useDB()
  const settings = useSettings()
  const { user } = useAuth()
  const [batchDate, setBatchDate] = useState(() => toDateKey(new Date()))
  const [batchCount, setBatchCount] = useState(8)
  const [batchCity, setBatchCity] = useState(settings.locations[0] ?? '浦东')
  const [batchMsg, setBatchMsg] = useState('')
  const [resetOpen, setResetOpen] = useState(false)

  function generateBatch() {
    if (!user) return
    if (!db.games.length) {
      setBatchMsg('仓库还是空的，先导入示例条目')
      return
    }
    const events = buildTestEvents({
      dateKey: batchDate,
      count: batchCount,
      city: batchCity,
      host: { id: user.id, nickname: user.nickname },
      games: db.games,
    })
    mutate((d) => {
      d.events.push(...events)
    })
    setBatchMsg(`已在 ${batchDate} 造了 ${events.length} 车`)
    onDone('已批量造车')
  }

  function clearBatch() {
    const mine = db.events.filter((e) => dateKeyOf(e.startAt) === batchDate && e.note === TEST_NOTE)
    if (!mine.length) {
      setBatchMsg('这天没有批量生成的车')
      return
    }
    mutate((d) => {
      d.events = d.events.filter((e) => !(dateKeyOf(e.startAt) === batchDate && e.note === TEST_NOTE))
    })
    setBatchMsg(`已删掉 ${mine.length} 车`)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-brass/25 bg-brass/5 px-4 py-3 text-[11.5px] leading-relaxed text-faint">
        给同一天一次造多车，用来试「时刻一天放不下」时的表现：桌面端格子里超过 3 车会显示
        <span className="mx-1 text-brass/90">+N 全部</span>，手机上点这天会弹出当天全部列表。
        造出来的车都带「{TEST_NOTE}」的留言，随时能一键清掉。
      </div>

      <Field label="哪天" hint="默认今天">
        <input
          type="date"
          value={batchDate}
          onChange={(e) => {
            setBatchDate(e.target.value)
            setBatchMsg('')
          }}
        />
      </Field>

      <Field label="造几车" hint="最多 30">
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {BATCH_COUNTS.map((c) => (
            <Chip key={c} active={batchCount === c} onClick={() => setBatchCount(c)}>
              {c} 车
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="地点">
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {settings.locations.map((c) => (
            <Chip key={c} active={batchCity === c} onClick={() => setBatchCity(c)}>
              {c}
            </Chip>
          ))}
        </div>
      </Field>

      <div className="rounded-xl border border-line bg-surface/50 px-4 py-3 text-[11.5px] leading-relaxed text-faint">
        这天现在共有
        <span className="mx-1 font-display text-[13px] text-paper">
          {db.events.filter((e) => dateKeyOf(e.startAt) === batchDate && e.status !== 'cancelled').length}
        </span>
        车，车头记作「{user?.nickname ?? '—'}」。条目从仓库里轮流取，时间铺在 9:00–23:00。
      </div>

      {batchMsg && <p className="text-[12.5px] text-jade">{batchMsg}</p>}

      <div className="flex flex-wrap gap-2">
        <Button className="flex-1" onClick={generateBatch}>
          <Icon name="plus" size={14} /> 造 {batchCount} 车
        </Button>
        <Button variant="outline" onClick={() => navigate(`/calendar?d=${batchDate}`)}>
          <Icon name="calendar" size={14} /> 去时刻看这天
        </Button>
      </div>

      <Button variant="danger" size="sm" onClick={clearBatch}>
        清空这天的测试车
      </Button>

      <div className="mt-6 rounded-xl border border-seal/25 bg-seal/5 p-4">
        <h3 className="text-[13px] text-seal">危险操作</h3>
        <p className="mt-1 text-[11.5px] leading-relaxed text-faint">
          {getBackend().kind === 'local'
            ? '恢复示例数据会清空当前所有账号、活动、展柜、日志和条目，重新写入初始示例。不可撤销。'
            : '服务器模式下没有「一键重置」，数据在服务端，避免误删所有人的内容。'}
        </p>
        <Button
          variant="danger"
          size="sm"
          className="mt-2.5"
          disabled={getBackend().kind !== 'local'}
          onClick={() => setResetOpen(true)}
        >
          清空并恢复示例数据
        </Button>
      </div>

      <ConfirmDialog
        open={resetOpen}
        title="清空全部数据？"
        desc="所有账号、活动、条目、日志都会被删掉，恢复成初始示例。这个操作不可撤销。"
        confirmText="清空"
        onCancel={() => setResetOpen(false)}
        onConfirm={async () => {
          setResetOpen(false)
          await resetDB()
          onDone('已恢复示例数据')
        }}
      />
    </div>
  )
}


/* ───────────────── 数据查看 / 导出 ───────────────── */

function DataPanel({ onDone }: { onDone: (m: string) => void }) {
  const db = useDB()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const userCount = db.users.length
  const gameCount = db.games.length
  const eventCount = db.events.length
  const reviewCount = db.reviews.length
  const feedbackCount = db.feedbacks.length
  const logCount = db.logs.length

  const byStatus = (() => {
    const m: Record<string, number> = {}
    for (const e of db.events) m[e.status] = (m[e.status] ?? 0) + 1
    return m
  })()

  function doExport(kind: 'users' | 'events' | 'feedbacks' | 'games') {
    const stamp = new Date().toISOString().slice(0, 10)
    if (kind === 'users') {
      const cols = ['uid', 'nickname', 'username', 'role', 'createdAt', 'followers', 'following', 'liked']
      const rows = db.users.map((u) => ({
        uid: u.uid,
        nickname: u.nickname,
        username: u.username,
        role: u.role,
        createdAt: u.createdAt,
        followers: u.followers.length,
        following: u.following.length,
        liked: u.likedUsers.length,
      }))
      downloadText(`table-top-users-${stamp}.csv`, toCSV(rows, cols), 'text/csv')
    } else if (kind === 'events') {
      const cols = [
        'id',
        'title',
        'hostName',
        'kind',
        'startAt',
        'city',
        'venue',
        'capacity',
        'status',
        'joinMode',
        'waitlistSize',
        'joined',
      ]
      const rows = db.events.map((e) => ({
        id: e.id,
        title: e.title,
        hostName: e.hostName,
        kind: e.kind,
        startAt: e.startAt,
        city: e.city,
        venue: e.venue,
        capacity: e.capacity,
        status: e.status,
        joinMode: e.joinMode,
        waitlistSize: e.waitlistSize,
        joined: e.seats.filter((s) => s.status === 'filled').length,
      }))
      downloadText(`table-top-events-${stamp}.csv`, toCSV(rows, cols), 'text/csv')
    } else if (kind === 'feedbacks') {
      if (!db.feedbacks.length) {
        onDone('暂时还没有反馈数据可导出')
        return
      }
      const cols = ['id', 'fromName', 'email', 'subject', 'content', 'createdAt']
      const rows = db.feedbacks.map((f) => ({
        id: f.id,
        fromName: f.fromName,
        email: f.email ?? '',
        subject: f.subject,
        content: f.content,
        createdAt: f.createdAt,
      }))
      downloadText(`table-top-feedbacks-${stamp}.csv`, toCSV(rows, cols), 'text/csv')
    } else {
      const cols = ['id', 'title', 'kind', 'publisher', 'rating', 'ratingCount', 'tags']
      const rows = db.games.map((g) => ({
        id: g.id,
        title: g.title,
        kind: g.kind,
        publisher: g.publisher,
        rating: g.rating,
        ratingCount: g.ratingCount,
        tags: g.tags.join('|'),
      }))
      downloadText(`table-top-games-${stamp}.csv`, toCSV(rows, cols), 'text/csv')
    }
    onDone('已导出 CSV 文件')
  }

  const stats = [
    { label: '用户', value: userCount },
    { label: '条目', value: gameCount },
    { label: '活动', value: eventCount },
    { label: '评价', value: reviewCount },
    { label: '反馈', value: feedbackCount },
    { label: '日志', value: logCount },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 text-[13px] text-paper">总览</h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-line bg-surface/60 p-3 text-center">
              <div className="font-display text-[20px] tabular-nums text-paper">{s.value}</div>
              <div className="mt-0.5 text-[11px] text-faint">{s.label}</div>
            </div>
          ))}
        </div>
        {eventCount > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(byStatus).map(([k, n]) => (
              <Chip key={k} active={false}>
                {k} {n}
              </Chip>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-[13px] text-paper">导出为 CSV</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button variant="soft" onClick={() => doExport('users')}>
            用户
          </Button>
          <Button variant="soft" onClick={() => doExport('events')}>
            活动
          </Button>
          <Button variant="soft" onClick={() => doExport('feedbacks')}>
            反馈
          </Button>
          <Button variant="soft" onClick={() => doExport('games')}>
            条目
          </Button>
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed text-faint">
          导出的 CSV 用逗号分隔、含表头，可直接用表格软件打开。反馈数据本地模式也会保存，但只有部署到服务器并配置邮箱后才会邮件通知站长。
        </p>
      </div>

      <div className="rounded-xl border border-line/60 bg-surface/40 p-3 text-[11.5px] leading-relaxed text-faint">
        想看更细的操作流水，可以到「操作日志」里查看；想批量改数据，可以用「测试工具」里的脚本。
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="导出说明"
        desc="CSV 文件会直接下载到你的设备，不会上传到任何服务器。"
        confirmText="知道了"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => setConfirmOpen(false)}
      />
    </div>
  )
}
