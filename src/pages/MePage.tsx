import { useMemo, useRef, useState } from 'react'
import { mutate, uid, useDB, useSettings } from '../store/db'
import {
  signOut,
  updateHost,
  updatePrefs,
  updatePrivacy,
  updateProfile,
  useAuth,
} from '../store/auth'
import { href, navigate } from '../lib/router'
import Link from '../components/Link'
import {
  Avatar,
  Button,
  Chip,
  ConfirmDialog,
  DurationRangeField,
  EmptyState,
  Field,
  ImagePicker,
  Segmented,
  Sheet,
  Switch,
  Tag,
} from '../components/ui'
import { Icon } from '../components/Icons'
import { EventCard } from '../components/cards'
import { ShowcaseGrid } from '../components/Showcase'
import { CoverArt } from '../components/CoverArt'
import {
  DURATION_MAX,
  DURATION_MIN,
  DURATION_STEP,
  GAME_KINDS,
  HOST_TYPE_OPTIONS,
  KIND_LABEL,
  PLAY_OPTIONS,
  ROLE_LABEL,
  WEREWOLF_BOARDS,
  difficultyLabel,
  type Game,
  type GameKind,
  type Prefs,
  type Privacy,
  type Role,
  type ShowcaseItem,
  type ShowcaseType,
} from '../types'
import { facetsOf } from '../lib/taxonomy'
import { formatDuration, gameTitle } from '../lib/format'
import { AVATAR_SIZE, COVER_SIZE, pickImage, readImageAsDataUrl } from '../lib/image'
import { IS_BROWSER } from '../lib/platform'

type Tab = 'showcase' | 'events' | 'prefs' | 'settings'

interface RoleHit {
  game: Game
  role: Role
}

export default function MePage({ initialTab = null }: { initialTab?: string | null }) {
  const db = useDB()
  const settings = useSettings()
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>(() =>
    initialTab === 'prefs' || initialTab === 'settings' || initialTab === 'events'
      ? (initialTab as Tab)
      : 'showcase',
  )
  const [editOpen, setEditOpen] = useState(false)
  const [nick, setNick] = useState(user?.nickname ?? '')
  const [bio, setBio] = useState(user?.bio ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [addOpen, setAddOpen] = useState(false)
  const [addType, setAddType] = useState<ShowcaseType>('game')
  const [pickGame, setPickGame] = useState<Game | null>(null)
  const [pickRole, setPickRole] = useState<RoleHit | null>(null)
  const [shTitle, setShTitle] = useState('')
  const [shSub, setShSub] = useState('')
  const [shNote, setShNote] = useState('')
  const [shImage, setShImage] = useState<string | null>(null)
  const [gq, setGq] = useState('')
  const [gk, setGk] = useState<'all' | GameKind>('all')
  const [editing, setEditing] = useState(false)
  const [favRoleDraft, setFavRoleDraft] = useState('')
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)
  const [editItemId, setEditItemId] = useState<string | null>(null)
  const [eiTitle, setEiTitle] = useState('')
  const [eiSub, setEiSub] = useState('')
  const [eiNote, setEiNote] = useState('')
  const [eiImage, setEiImage] = useState<string | null>(null)
  const eiImageRef = useRef<HTMLInputElement>(null)
  const [toast, setToast] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const shImageRef = useRef<HTMLInputElement>(null)

  const roleHits = useMemo<RoleHit[]>(() => {
    const s = gq.trim().toLowerCase()
    const out: RoleHit[] = []
    for (const g of db.games) {
      for (const r of g.roles ?? []) {
        if (!s || r.name.toLowerCase().includes(s) || g.title.toLowerCase().includes(s))
          out.push({ game: g, role: r })
      }
    }
    return out.slice(0, 40)
  }, [db.games, gq])

  if (!user) return null

  const myShowcase = db.showcase
    .filter((s) => s.userId === user.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const hosted = db.events
    .filter((e) => e.hostId === user.id)
    .sort((a, b) => b.startAt.localeCompare(a.startAt))
  const joined = db.events
    .filter((e) => e.hostId !== user.id && e.seats.some((s) => s.userId === user.id))
    .sort((a, b) => b.startAt.localeCompare(a.startAt))

  const gameList = useMemo(() => {
    const s = gq.trim().toLowerCase()
    return db.games
      .filter((g) => (gk === 'all' || g.kind === gk) && (!s || g.title.toLowerCase().includes(s)))
      .slice(0, 30)
  }, [db.games, gq, gk])

  /** 玩过 = 发过或上过的车按条目去重；主持过按场次算 */
  const playedStat = (() => {
    const board = new Set<string>()
    const script = new Set<string>()
    const other = new Set<string>()
    for (const e of [...hosted, ...joined]) {
      if (!e.gameId) continue
      if (e.kind === 'board') board.add(e.gameId)
      else if (e.kind === 'script') script.add(e.gameId)
      else other.add(e.gameId)
    }
    return {
      board: board.size,
      script: script.size,
      other: other.size,
      hostedScript: hosted.filter((e) => e.kind === 'script').length,
      hostedOther: hosted.filter((e) => e.kind !== 'script').length,
    }
  })()

  const editItem: ShowcaseItem | null = editItemId
    ? db.showcase.find((s) => s.id === editItemId) ?? null
    : null

  function openItemEdit(id: string) {
    const it = db.showcase.find((x) => x.id === id)
    if (!it) return
    setEditItemId(id)
    setEiTitle(it.title)
    setEiSub(it.subtitle)
    setEiNote(it.note)
    setEiImage(it.image)
  }

  function saveItemEdit() {
    if (!editItemId) return
    mutate((d) => {
      const it = d.showcase.find((x) => x.id === editItemId)
      if (!it) return
      it.title = eiTitle.trim() || it.title
      it.subtitle = eiSub.trim()
      it.note = eiNote.trim()
      it.image = it.custom ? null : eiImage
    })
    setEditItemId(null)
    flash('已保存')
  }

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  function openEdit() {
    setNick(user!.nickname)
    setBio(user!.bio)
    setEmail(user!.email ?? '')
    setEditOpen(true)
  }

  async function onAvatar(file: File) {
    try {
      const dataUrl = await readImageAsDataUrl(file, {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
      })
      updateProfile(user!.id, { avatar: dataUrl })
      flash('头像已更新')
    } catch {
      flash('图片读取失败，换一张试试')
    }
  }

  async function chooseAvatar() {
    if (IS_BROWSER) {
      fileRef.current?.click()
      return
    }
    try {
      const dataUrl = await pickImage({ width: AVATAR_SIZE, height: AVATAR_SIZE })
      if (dataUrl) {
        updateProfile(user!.id, { avatar: dataUrl })
        flash('头像已更新')
      }
    } catch {
      flash('图片读取失败，换一张试试')
    }
  }

  function saveProfile() {
    const n = nick.trim()
    if (n.length < 2 || n.length > 12) {
      flash('昵称需要 2–12 个字符')
      return
    }
    if (db.users.some((u) => u.id !== user!.id && u.nickname === n)) {
      flash('这个昵称被占用了')
      return
    }
    updateProfile(user!.id, { nickname: n, bio: bio.trim(), email: email.trim() || null })
    setEditOpen(false)
    flash('资料已保存')
  }

  function resetAddForm() {
    setPickGame(null)
    setPickRole(null)
    setShTitle('')
    setShSub('')
    setShNote('')
    setShImage(null)
    setGq('')
  }

  function addShowcase() {
    const pickedFromDb = addType === 'game' ? !!pickGame : !!pickRole
    const title =
      addType === 'game'
        ? pickGame
          ? gameTitle(pickGame)
          : ''
        : addType === 'role'
          ? pickRole?.role.name ?? shTitle.trim()
          : shTitle.trim()
    if (!title) {
      flash(addType === 'game' ? '先选一个条目' : '填个标题')
      return
    }
    mutate((d) => {
      d.showcase.push({
        id: uid('sh'),
        userId: user!.id,
        type: addType,
        gameId: addType === 'game' ? pickGame?.id ?? null : pickRole?.game.id ?? null,
        title,
        subtitle:
          shSub.trim() ||
          (addType === 'game' && pickGame
            ? `${KIND_LABEL[pickGame.kind]} · ${pickGame.rating.toFixed(1)} 分`
            : pickRole
              ? gameTitle(pickRole.game)
              : ''),
        note: shNote.trim(),
        image: pickedFromDb ? shImage : null,
        custom: !pickedFromDb,
        createdAt: new Date().toISOString(),
      })
    })
    setAddOpen(false)
    resetAddForm()
    flash('已加到展柜')
  }

  function toggleArr<T>(arr: T[], v: T): T[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]
  }

  function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    updatePrefs(user!.id, { [key]: value } as Partial<Prefs>)
  }

  return (
    <div className="anim-rise">
      {/* 资料头 */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="absolute inset-0 bg-gradient-to-br from-brass/[0.07] via-transparent to-jade/[0.05]" />
        <div className="relative flex items-start gap-4 p-4 sm:p-5">
          <div className="relative">
            <Avatar name={user.nickname} src={user.avatar} size={64} className="text-[26px]" />
            <button
              onClick={() => void chooseAvatar()}
              className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-surface2 text-faint transition-colors hover:text-brass"
              aria-label="更换头像"
            >
              <Icon name="upload" size={11} />
            </button>
            {IS_BROWSER && <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onAvatar(f)
                e.target.value = ''
              }}
            />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-display text-[21px] tracking-wide text-paper">
                {user.nickname}
              </h1>
              <span className="shrink-0 text-[11px] text-faint">@{user.username}</span>
              {user.role !== 'user' && (
                <span className="shrink-0 rounded bg-brass/15 px-1.5 py-0.5 text-[10px] text-brass">
                  {ROLE_LABEL[user.role]}
                </span>
              )}
              <button
                onClick={openEdit}
                className="rounded p-1 text-faint hover:text-brass"
                aria-label="编辑资料"
              >
                <Icon name="edit" size={14} />
              </button>
              <Link
                href={href(`/u/${user.id}`)}
                className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[10.5px] text-faint transition-colors hover:border-line2 hover:text-paper"
              >
                他人视角
              </Link>
            </div>
            <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-muted">
              {user.bio || '还没有填写签名'}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {user.prefs.plays.map((k) => {
                const opt = PLAY_OPTIONS.find((p) => p.key === k)
                return opt ? <Tag key={k}>{opt.label}</Tag> : null
              })}
              {user.prefs.locations.map((c) => (
                <Tag key={c}>{c}</Tag>
              ))}
              {user.favRoles.slice(0, 3).map((r) => (
                <Tag key={r}>喜欢 {r}</Tag>
              ))}
              {user.host.enabled && (
                <Tag>
                  主持人 · {user.host.types.join(' / ') || '未填类型'}
                </Tag>
              )}
            </div>
          </div>
        </div>

        <div className="relative grid grid-cols-3 divide-x divide-line border-t border-line">
          {[
            { label: '玩过的桌游', value: playedStat.board },
            { label: '玩过的剧本', value: playedStat.script },
            { label: '玩过的其他', value: playedStat.other },
          ].map((s) => (
            <div key={s.label} className="py-2.5 text-center">
              <div className="font-display text-[17px] text-paper tabular-nums">{s.value}</div>
              <div className="text-[10.5px] text-faint">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="relative border-t border-line px-4 py-2 text-center text-[11px] text-faint">
          主持过 {hosted.length} 场
        </div>
      </div>

      <div className="mt-4">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'showcase', label: '展柜' },
            { value: 'events', label: '我的车' },
            { value: 'prefs', label: '偏好' },
            { value: 'settings', label: '设置' },
          ]}
          className="w-full"
        />
      </div>

      {/* 展柜 */}
      {tab === 'showcase' && (
        <section className="mt-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-[12px] text-faint">
              {editing
                ? '编辑模式：点卡片可修改内容，点右上角 × 可移除（会再确认一次）'
                : '展示你喜欢的剧本、角色和台词'}
            </p>
            <div className="flex shrink-0 gap-2">
              {myShowcase.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>
                  <Icon name={editing ? 'check' : 'edit'} size={13} />
                  {editing ? '完成' : '编辑'}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                <Icon name="plus" size={13} /> 添加
              </Button>
            </div>
          </div>
          {myShowcase.length ? (
            <ShowcaseGrid
              items={myShowcase}
              games={db.games}
              editing={editing}
              onRemove={(id) => setRemoveTarget(id)}
              onEdit={openItemEdit}
            />
          ) : (
            <EmptyState
              icon="sparkle"
              title="展柜还空着"
              desc="加几部喜欢的剧本、演过的角色，或者一句忘不掉的台词。"
              action={
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  添加第一件
                </Button>
              }
            />
          )}
        </section>
      )}

      {/* 我的车 */}
      {tab === 'events' && (
        <section className="mt-4 space-y-6">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-[16px] text-paper">我发的车</h2>
              <Button size="sm" variant="ghost" onClick={() => navigate('/create')}>
                <Icon name="plus" size={13} /> 发车
              </Button>
            </div>
            {hosted.length ? (
              <div className="space-y-2.5">
                {hosted.map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon="calendar"
                title="还没发过车"
                desc="第一次发车大概三分钟，填完就有上车链接。"
                action={
                  <Button size="sm" onClick={() => navigate('/create')}>
                    发一车
                  </Button>
                }
              />
            )}
          </div>

          <div>
            <h2 className="mb-2 font-display text-[16px] text-paper">我上过的车</h2>
            {joined.length ? (
              <div className="space-y-2.5">
                {joined.map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </div>
            ) : (
              <EmptyState icon="users" title="还没上过车" desc="去时刻看看最近有什么车。" />
            )}
          </div>
        </section>
      )}

      {/* 偏好 */}
      {tab === 'prefs' && (
        <section className="mt-4 space-y-7">
          <div>
            <h3 className="mb-1 text-[13px] text-paper">我玩什么</h3>
            <p className="mb-2 text-[11.5px] text-faint">
              选中的玩法会在下方分别展开难度与类型
            </p>
            <div className="flex flex-wrap gap-2">
              {PLAY_OPTIONS.map((p) => (
                <Chip
                  key={p.key}
                  active={user.prefs.plays.includes(p.key)}
                  onClick={() => setPref('plays', toggleArr(user.prefs.plays, p.key))}
                >
                  {p.label}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-[13px] text-paper">常去的地点</h3>
            <div className="flex flex-wrap gap-2">
              {settings.locations.map((c) => (
                <Chip
                  key={c}
                  active={user.prefs.locations.includes(c)}
                  onClick={() => setPref('locations', toggleArr(user.prefs.locations, c))}
                >
                  {c}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <h3 className="text-[13px] text-paper">喜欢的角色</h3>
              <span className="text-[11px] text-faint">会显示在你的公开主页</span>
            </div>
            <p className="mb-2 text-[11.5px] text-faint">
              填你演过或者想演的角色名，回车即可添加。
            </p>
            {user.favRoles.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {user.favRoles.map((r) => (
                  <button
                    key={r}
                    onClick={() =>
                      updateProfile(user.id, { favRoles: user.favRoles.filter((x) => x !== r) })
                    }
                    className="inline-flex items-center gap-1 rounded-full border border-brass/40 bg-brass/10 px-2.5 py-1 text-[12px] text-brass"
                  >
                    {r}
                    <Icon name="close" size={11} />
                  </button>
                ))}
              </div>
            )}
            <input
              value={favRoleDraft}
              onChange={(e) => setFavRoleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                const v = favRoleDraft.trim()
                if (!v) return
                if (!user.favRoles.includes(v))
                  updateProfile(user.id, { favRoles: [...user.favRoles, v] })
                setFavRoleDraft('')
              }}
              placeholder="比如：沈砚"
              className="!py-2 !text-[13px]"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <h3 className="text-[13px] text-paper">舒适时长</h3>
              <button
                onClick={() => setPref('durationRange', null)}
                className={`rounded-full border px-2.5 py-1 text-[11.5px] transition-colors ${
                  user.prefs.durationRange
                    ? 'border-line2 text-muted hover:border-brass/50 hover:text-paper'
                    : 'border-brass/60 bg-brass/15 font-medium text-brass'
                }`}
              >
                {user.prefs.durationRange ? '设为不限' : '当前不限'}
              </button>
            </div>
            <p className="mb-2 text-[11.5px] text-faint">
              半小时一格，最长 12 小时。只用于「按我的偏好」筛选，不影响你浏览长本。
            </p>
            <DurationRangeField
              min={DURATION_MIN}
              max={DURATION_MAX}
              step={DURATION_STEP}
              value={user.prefs.durationRange ?? [60, 360]}
              onChange={(v) => setPref('durationRange', v)}
            />
            {!user.prefs.durationRange && (
              <p className="mt-1.5 text-[11px] text-faint">拖动滑块或填入数字后生效。</p>
            )}
          </div>

          {user.prefs.plays.length === 0 && (
            <div className="rounded-xl border border-line/70 bg-surface/50 px-4 py-3 text-[11.5px] leading-relaxed text-faint">
              先选择玩法，下方会展开该玩法自己的难度与类型设置。
            </div>
          )}

          {GAME_KINDS.filter((k) => user.prefs.plays.some((p) => PLAY_OPTIONS.find((o) => o.key === p)?.kind === k)).map(
            (k) => (
              <KindPrefs
                key={k}
                kind={k}
                prefs={user.prefs}
                taxonomy={settings.taxonomy[k] ?? []}
                onChange={setPref}
              />
            ),
          )}

          <div className="rounded-xl border border-line/70 bg-surface/50 px-4 py-3 text-[11.5px] leading-relaxed text-faint">
            这些偏好会在时刻的「按我的偏好」里生效，之后发车选条目时也会优先推荐。
          </div>
        </section>
      )}

      {/* 设置：主持人 + 隐私 + 账号 */}
      {tab === 'settings' && (
        <section className="mt-4 space-y-7">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-[13px] text-paper">主持人身份</h3>
              <Switch
                checked={user.host.enabled}
                onChange={(v) => updateHost(user.id, { enabled: v })}
                label=""
              />
            </div>
            <p className="mb-3 text-[11.5px] leading-relaxed text-faint">
              开启后，你的公开主页会显示主持人资料。带本场次由系统按你发过的车自动统计。
            </p>

            {user.host.enabled && (
              <div className="space-y-3.5 rounded-xl border border-line bg-surface/60 p-3.5">
                <Field label="主持类型" hint="可多选">
                  <div className="flex flex-wrap gap-2">
                    {HOST_TYPE_OPTIONS.map((t) => (
                      <Chip
                        key={t}
                        active={user.host.types.includes(t)}
                        onClick={() => updateHost(user.id, { types: toggleArr(user.host.types, t) })}
                      >
                        {t}
                      </Chip>
                    ))}
                  </div>
                </Field>
                <Field label="常驻场地" hint="选填">
                  <div className="flex flex-wrap gap-2">
                    {settings.locations.map((c) => (
                      <Chip
                        key={c}
                        active={user.host.venues.includes(c)}
                        onClick={() => updateHost(user.id, { venues: toggleArr(user.host.venues, c) })}
                      >
                        {c}
                      </Chip>
                    ))}
                  </div>
                </Field>
                <Field label="自我介绍" hint="选填">
                  <textarea
                    rows={3}
                    value={user.host.intro}
                    onChange={(e) => updateHost(user.id, { intro: e.target.value })}
                    placeholder="带什么类型、节奏怎么样、新人能不能上车。"
                  />
                </Field>
                <Field label="联系方式" hint="选填，会公开显示">
                  <input
                    value={user.host.contact}
                    onChange={(e) => updateHost(user.id, { contact: e.target.value })}
                    placeholder="比如：群内 @阿盐"
                  />
                </Field>
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-1 text-[13px] text-paper">别人能看到我哪些信息</h3>
            <p className="mb-3 text-[11.5px] leading-relaxed text-faint">
              关闭的项不会出现在你的公开主页里，你自己始终能看到。
            </p>
            <div className="space-y-3 rounded-xl border border-line bg-surface/60 p-3.5">
              {(
                [
                  ['bio', '个人签名'],
                  ['prefs', '偏好（玩法、地点、类型）'],
                  ['favRoles', '喜欢的角色'],
                  ['showcase', '展柜'],
                  ['events', '我发的车 / 上过的车'],
                  ['host', '主持人资料'],
                  ['followers', '关注 / 被关注情况'],
                ] as Array<[keyof Privacy, string]>
              ).map(([key, label]) => (
                <Switch
                  key={key}
                  checked={user.privacy[key]}
                  onChange={(v) => updatePrivacy(user.id, { [key]: v } as Partial<Privacy>)}
                  label={label}
                />
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-line/70 bg-surface/50 px-4 py-3">
            <div className="text-[11.5px] leading-relaxed text-faint">
              登录名：@{user.username}（创建后不可修改）
              {user.email && <span className="ml-2">邮箱：{user.email}</span>}
            </div>
            <div className="mt-2.5 border-t border-line/60 pt-2.5">
              <Switch
                checked={user.showUsername}
                onChange={(v) => updateProfile(user.id, { showUsername: v })}
                label="对外展示登录名（@后面的内容）"
                hint="关闭后他人主页与搜索结果里只显示昵称，uid 始终可见"
              />
            </div>
          </div>

          <Button
            variant="danger"
            className="w-full"
            onClick={() => {
              void signOut()
              navigate('/calendar')
            }}
          >
            <Icon name="logout" size={15} /> 退出登录
          </Button>
        </section>
      )}

      {/* 编辑资料 */}
      <Sheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="编辑资料"
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setEditOpen(false)}>
              取消
            </Button>
            <Button className="flex-1" onClick={saveProfile}>
              保存
            </Button>
          </div>
        }
      >
        <div className="space-y-3.5">
          <Field label="昵称" hint="2–12 个字符">
            <input value={nick} onChange={(e) => setNick(e.target.value)} />
          </Field>
          <Field label="签名" hint="选填">
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="比如：硬核本收集癖，周末固定发车。"
            />
          </Field>
          <Field label="邮箱" hint="选填，暂不参与登录与找回">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>
        </div>
      </Sheet>

      {/* 添加展柜 */}
      <Sheet
        open={addOpen}
        onClose={() => {
          setAddOpen(false)
          resetAddForm()
        }}
        title="往展柜里放点东西"
        subtitle="游戏、演过的角色、一句台词都可以"
        wide
        footer={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => {
                setAddOpen(false)
                resetAddForm()
              }}
            >
              取消
            </Button>
            <Button className="flex-1" onClick={addShowcase}>
              放上去
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Segmented
            value={addType}
            onChange={(v) => {
              setAddType(v)
              setGq('')
            }}
            options={[
              { value: 'game', label: '游戏' },
              { value: 'role', label: '角色' },
              { value: 'quote', label: '台词' },
            ]}
            className="w-full"
          />

          {addType === 'game' && (
            <div>
              <div className="no-scrollbar mb-2 flex gap-2 overflow-x-auto">
                <Chip active={gk === 'all'} onClick={() => setGk('all')}>
                  全部
                </Chip>
                {GAME_KINDS.map((k) => (
                  <Chip key={k} active={gk === k} onClick={() => setGk(k)}>
                    {KIND_LABEL[k]}
                  </Chip>
                ))}
              </div>
              <input
                value={gq}
                onChange={(e) => setGq(e.target.value)}
                placeholder="搜条目"
                className="!py-2 !text-[13px]"
              />
              <div className="mt-2 grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
                {gameList.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => {
                      setPickGame(g)
                      setShImage(null)
                    }}
                    className="text-left"
                  >
                    <div
                      className={`relative aspect-[3/4] overflow-hidden rounded-lg border ${
                        pickGame?.id === g.id ? 'border-brass' : 'border-line'
                      }`}
                    >
                      <CoverArt game={g} showSeal={false} />
                    </div>
                    <div className="mt-1 line-clamp-1 text-[11px] text-muted">{g.title}</div>
                  </button>
                ))}
              </div>
              {gameList.length === 0 && (
                <p className="mt-3 text-[12px] text-faint">没搜到，换个关键词。</p>
              )}
            </div>
          )}

          {addType === 'role' && (
            <div>
              <Field label="从仓库里搜角色" hint="角色名或本名都能搜">
                <input
                  value={gq}
                  onChange={(e) => setGq(e.target.value)}
                  placeholder="比如：沈砚 / 年轮"
                  className="!py-2 !text-[13px]"
                />
              </Field>
              <div className="mt-2 max-h-52 space-y-1 overflow-y-auto">
                {roleHits.map((hit) => (
                  <button
                    key={`${hit.game.id}-${hit.role.name}`}
                    onClick={() => {
                      setPickRole(hit)
                      setShImage(null)
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left ${
                      pickRole?.game.id === hit.game.id && pickRole?.role.name === hit.role.name
                        ? 'border-brass/60 bg-brass/10'
                        : 'border-line bg-surface2/40 hover:border-line2'
                    }`}
                  >
                    <span className="font-display text-[13px] text-paper">{hit.role.name}</span>
                    <span className="rounded border border-line px-1 py-0.5 text-[10px] text-faint">
                      {hit.role.gender}
                    </span>
                    <span className="ml-auto truncate text-[11px] text-faint">{gameTitle(hit.game)}</span>
                  </button>
                ))}
                {roleHits.length === 0 && (
                  <p className="py-2 text-[12px] text-faint">仓库里没有匹配的角色，下面自己填一个。</p>
                )}
              </div>

              <div className="mt-3 rounded-xl border border-dashed border-line p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[12px] text-muted">或者自己填</span>
                  {pickRole && (
                    <button
                      onClick={() => setPickRole(null)}
                      className="text-[11px] text-brass/80 hover:text-brass"
                    >
                      取消选择
                    </button>
                  )}
                </div>
                <div className="space-y-2.5">
                  <Field label="角色名">
                    <input
                      value={pickRole ? '' : shTitle}
                      disabled={!!pickRole}
                      onChange={(e) => setShTitle(e.target.value)}
                      placeholder="比如：沈砚"
                    />
                  </Field>
                  <Field label="来自哪个本" hint="选填">
                    <input
                      value={pickRole ? '' : shSub}
                      disabled={!!pickRole}
                      onChange={(e) => setShSub(e.target.value)}
                      placeholder="比如：《年轮》"
                    />
                  </Field>
                </div>
                <p className="mt-2 text-[10.5px] leading-relaxed text-faint">
                  自己填的条目只保存文字，不提供配图上传。
                </p>
              </div>
            </div>
          )}

          {addType === 'quote' && (
            <>
              <Field label="那句台词" hint="不用加引号">
                <input
                  value={shTitle}
                  onChange={(e) => setShTitle(e.target.value)}
                  placeholder="比如：时间不会说谎"
                />
              </Field>
              <Field label="出处" hint="选填">
                <input
                  value={shSub}
                  onChange={(e) => setShSub(e.target.value)}
                  placeholder="比如：《年轮》"
                />
              </Field>
            </>
          )}

          <Field label="想说的话" hint="选填">
            <textarea
              rows={3}
              value={shNote}
              onChange={(e) => setShNote(e.target.value)}
              placeholder="写点推荐理由"
            />
          </Field>

          {/* 从库里选的才给配图 */}
          {(addType === 'game' ? !!pickGame : addType === 'role' ? !!pickRole : false) && (
            <ImagePicker
              value={shImage}
              onChange={setShImage}
              width={COVER_SIZE.width}
              height={COVER_SIZE.height}
              label="配图"
              hint="选填，仅从仓库选择的条目可换图"
            />
          )}
        </div>
      </Sheet>

      {/* 编辑展柜卡片 */}
      <Sheet
        open={!!editItem}
        onClose={() => setEditItemId(null)}
        title="修改展柜内容"
        subtitle={editItem?.custom ? '自行填写的条目仅保存文字' : '从仓库选取的条目可更换配图'}
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setEditItemId(null)}>
              取消
            </Button>
            <Button className="flex-1" onClick={saveItemEdit}>
              保存
            </Button>
          </div>
        }
      >
        <div className="space-y-3.5">
          <Field label={editItem?.type === 'quote' ? '台词' : '名称'}>
            <input value={eiTitle} onChange={(e) => setEiTitle(e.target.value)} />
          </Field>
          <Field label={editItem?.type === 'quote' ? '出处' : '来自哪个本'} hint="选填">
            <input
              value={eiSub}
              onChange={(e) => setEiSub(e.target.value)}
              placeholder={editItem?.type === 'quote' ? '比如：《年轮》' : '比如：年轮'}
            />
          </Field>
          <Field label="想说的话" hint="选填">
            <textarea
              rows={3}
              value={eiNote}
              onChange={(e) => setEiNote(e.target.value)}
              placeholder="写点推荐理由"
            />
          </Field>
          {editItem && !editItem.custom && (
            <ImagePicker
              value={eiImage}
              onChange={setEiImage}
              width={COVER_SIZE.width}
              height={COVER_SIZE.height}
              label="配图"
              hint="选填"
            />
          )}
        </div>
      </Sheet>

      <ConfirmDialog
        open={!!removeTarget}
        title="从展柜移除？"
        desc={`「${myShowcase.find((s) => s.id === removeTarget)?.title ?? ''}」会从你的展柜里拿掉，之后还能重新加。`}
        confirmText="移除"
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => {
          mutate((d) => {
            d.showcase = d.showcase.filter((s) => s.id !== removeTarget)
          })
          setRemoveTarget(null)
          flash('已移除')
        }}
      />

      {toast && (
        <div className="anim-fade fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-line bg-surface2 px-4 py-2 text-[12.5px] text-paper shadow-xl">
          {toast}
        </div>
      )}
    </div>
  )
}

/* ───────── 单个玩法的偏好块 ───────── */

function KindPrefs({
  kind,
  prefs,
  taxonomy,
  onChange,
}: {
  kind: GameKind
  prefs: Prefs
  taxonomy: string[]
  onChange: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void
}) {
  const facets = facetsOf(kind)
    .map((f) => ({ ...f, tags: f.tags.filter((t) => taxonomy.includes(t)) }))
    .filter((f) => f.tags.length)
  const selectedTags = prefs.tags[kind] ?? []
  const maxD = prefs.maxDifficulty[kind] ?? null
  const [boardDraft, setBoardDraft] = useState('')

  return (
    <div className="rounded-xl border border-line bg-surface/60 p-3.5">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="font-display text-[15px] text-paper">{KIND_LABEL[kind]}</h3>
        <span className="text-[11px] text-faint">难度、类型、人数都单独算</span>
      </div>

      <div className="space-y-3.5">
        <div>
          <div className="mb-1.5 text-[12px] text-muted">难度上限</div>
          <div className="flex flex-wrap gap-2">
            <Chip
              active={maxD === null}
              onClick={() =>
                onChange('maxDifficulty', { ...prefs.maxDifficulty, [kind]: undefined })
              }
            >
              不限
            </Chip>
            {[1, 2, 3, 4, 5].map((d) => (
              <Chip
                key={d}
                active={maxD === d}
                onClick={() =>
                  onChange('maxDifficulty', {
                    ...prefs.maxDifficulty,
                    [kind]: maxD === d ? undefined : d,
                  })
                }
              >
                {difficultyLabel(kind, d)}
              </Chip>
            ))}
          </div>
          <p className="mt-1 text-[10.5px] text-faint">
            {kind === 'script'
              ? '剧本杀按推理强度分：新手 → 轻推理 → 进阶 → 硬核 → 极限硬核'
              : kind === 'board'
                ? '桌游沿用 BGG 的 weight：超轻 → 轻量 → 中轻 → 中重 → 重度'
                : '按该玩法的常见叫法分五档'}
          </p>
        </div>

        {facets.map((f) => (
          <div key={f.key}>
            <div className="mb-1.5 text-[12px] text-muted">{f.label}</div>
            <div className="flex flex-wrap gap-2">
              {f.tags.map((t) => (
                <Chip
                  key={t}
                  active={selectedTags.includes(t)}
                  onClick={() =>
                    onChange('tags', {
                      ...prefs.tags,
                      [kind]: selectedTags.includes(t)
                        ? selectedTags.filter((x) => x !== t)
                        : [...selectedTags, t],
                    })
                  }
                >
                  {t}
                </Chip>
              ))}
            </div>
          </div>
        ))}

        {kind === 'social' && (
          <div>
            <div className="mb-1.5 text-[12px] text-muted">板子（狼人杀）</div>
            <p className="mb-2 text-[11px] text-faint">选常打的板子，没有就自己填一个。</p>
            <div className="flex flex-wrap gap-2">
              {WEREWOLF_BOARDS.map((b) => (
                <Chip
                  key={b}
                  active={prefs.boards.includes(b)}
                  onClick={() =>
                    onChange(
                      'boards',
                      prefs.boards.includes(b)
                        ? prefs.boards.filter((x) => x !== b)
                        : [...prefs.boards, b],
                    )
                  }
                >
                  {b}
                </Chip>
              ))}
            </div>
            {prefs.boards.some((b) => !WEREWOLF_BOARDS.includes(b)) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {prefs.boards
                  .filter((b) => !WEREWOLF_BOARDS.includes(b))
                  .map((b) => (
                    <button
                      key={b}
                      onClick={() => onChange('boards', prefs.boards.filter((x) => x !== b))}
                      className="inline-flex items-center gap-1 rounded-full border border-brass/40 bg-brass/10 px-2.5 py-1 text-[12px] text-brass"
                    >
                      {b}
                      <Icon name="close" size={11} />
                    </button>
                  ))}
              </div>
            )}
            <input
              value={boardDraft}
              onChange={(e) => setBoardDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                const v = boardDraft.trim()
                if (!v) return
                if (!prefs.boards.includes(v)) onChange('boards', [...prefs.boards, v])
                setBoardDraft('')
              }}
              placeholder="自定义板子，回车添加"
              className="mt-2 !py-2 !text-[13px]"
            />
          </div>
        )}

      </div>
    </div>
  )
}
