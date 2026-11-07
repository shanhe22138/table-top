import { useEffect, useState } from 'react'
import { useRoute, navigate, href } from './lib/router'
import { signOut, useAuth } from './store/auth'
import { useDB, useSyncError } from './store/db'
import { Avatar, Dropdown } from './components/ui'
import { Icon } from './components/Icons'
import CalendarPage from './pages/CalendarPage'
import StorePage from './pages/StorePage'
import GameDetailPage from './pages/GameDetailPage'
import EventDetailPage from './pages/EventDetailPage'
import CreateEventPage from './pages/CreateEventPage'
import MePage from './pages/MePage'
import UserPage from './pages/UserPage'
import LoginPage from './pages/LoginPage'
import AdminPage from './pages/AdminPage'
import JoinPage from './pages/JoinPage'
import SearchPage from './pages/SearchPage'
import PlatformPage from './pages/PlatformPage'
import { FeedbackModal } from './components/FeedbackModal'
import { ROLE_LABEL } from './types'
import Link from './components/Link'
import { IS_MINI, setPageTitle } from './lib/platform'
import { Image, Input } from '@tarojs/components'
import { renderToStaticMarkup } from 'react-dom/server'

function Logo() {
  const svg = (
    <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="1.2" y="1.2" width="29.6" height="29.6" rx="8" stroke="#E2A85A" strokeOpacity="0.55" />
      <path d="M10 21.5L16 9l6 12.5" stroke="#E2A85A" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16" cy="17.5" r="2.1" fill="#E2A85A" />
    </svg>
  )
  if (IS_MINI) {
    const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderToStaticMarkup(svg))}`
    return <Image src={source} style={{ width: 26, height: 26 }} />
  }
  return svg
}

function NavLink({ to, label, active }: { to: string; label: string; active: boolean }) {
  return (
    <Link
      href={href(to)}
      className={`relative rounded-lg px-3 py-1.5 text-[13.5px] transition-colors ${
        active ? 'text-paper' : 'text-faint hover:text-muted'
      }`}
    >
      {label}
      {active && (
        <span className="absolute inset-x-3 -bottom-[9px] h-[2px] rounded-full bg-brass/70" />
      )}
    </Link>
  )
}

function TabItem({
  to,
  label,
  icon,
  active,
}: {
  to: string
  label: string
  icon: string
  active: boolean
}) {
  return (
    <Link
      href={href(to)}
      className={`flex flex-1 flex-col items-center justify-center gap-0.5 ${
        active ? 'text-brass' : 'text-faint'
      }`}
    >
      <Icon name={icon} size={19} strokeWidth={active ? 2 : 1.6} />
      <span className="text-[10px] leading-none">{label}</span>
    </Link>
  )
}

export default function App() {
  const route = useRoute()
  const db = useDB()
  const { user, isAdmin, isOwner } = useAuth()
  const syncError = useSyncError()
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => {
    const titles: Record<string, string> = {
      calendar: '时刻 · 候车室',
      library: '仓库 · 候车室',
      game: '条目详情 · 候车室',
      event: '活动详情 · 候车室',
      create: '发车 · 候车室',
      me: '我的 · 候车室',
      user: '玩家主页 · 候车室',
      login: '登录 · 候车室',
      admin: '管理后台 · 候车室',
      join: '上车 · 候车室',
      search: '搜索 · 候车室',
      platform: '站台 · 候车室',
    }
    setPageTitle(titles[route.name] ?? '候车室')
  }, [route.name])

  let page: React.ReactNode
  switch (route.name) {
    case 'library':
      page = <StorePage kind={route.kind} />
      break
    case 'game':
      page = <GameDetailPage id={route.id} />
      break
    case 'event':
      page = <EventDetailPage id={route.id} />
      break
    case 'create':
      page = user ? (
        <CreateEventPage gameId={route.gameId} />
      ) : (
        <LoginPage redirect="/create" reason="登录后才能发车" />
      )
      break
    case 'me':
      page = user ? (
        <MePage key={route.tab ?? 'me'} initialTab={route.tab} />
      ) : (
        <LoginPage redirect="/me" reason="登录后查看你的展柜" />
      )
      break
    case 'user':
      page = <UserPage id={route.id} />
      break
    case 'login':
      page = <LoginPage redirect={route.next} />
      break
    case 'search':
      page = <SearchPage q={route.q ?? ''} />
      break
    case 'platform':
      page = <PlatformPage />
      break
    case 'admin':
      page = !user ? (
        <LoginPage redirect="/admin" reason="登录后可以进入管理后台" />
      ) : isAdmin ? (
        <AdminPage key={route.tab ?? 'admin'} initialTab={route.tab} />
      ) : (
        <NoAccess />
      )
      break
    case 'join':
      page = <JoinPage code={route.code} />
      break
    default:
      page = <CalendarPage initialDate={route.name === 'calendar' ? route.date : null} />
  }

  const activeTab =
    route.name === 'library' || route.name === 'game'
      ? 'library'
      : route.name === 'me' || route.name === 'user'
        ? 'me'
        : route.name === 'platform'
          ? 'platform'
          : route.name === 'calendar'
            ? 'calendar'
            : null

  const menuItems = user
    ? [
        { label: '我的主页', icon: 'user', onClick: () => navigate('/me') },
        { label: '偏好与隐私', icon: 'sparkle', onClick: () => navigate('/me?tab=prefs') },
        { label: '搜索', icon: 'search', onClick: () => navigate('/search') },
        ...(isAdmin
          ? [
              { label: '管理后台', icon: 'grid', onClick: () => navigate('/admin') },
              { label: '操作日志', icon: 'list', onClick: () => navigate('/admin?tab=logs') },
            ]
          : []),
        {
          label: '提反馈 / issue',
          icon: 'info',
          onClick: () => setFeedbackOpen(true),
        },
        {
          label: '退出登录',
          icon: 'logout',
          danger: true,
          onClick: () => {
            void signOut()
            navigate('/calendar')
          },
        },
      ]
    : []

  return (
    <div className="min-h-dvh bg-ink">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-ink/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
          <Link href={href('/calendar')} className="flex shrink-0 items-center gap-2">
            <Logo />
            <span className="hidden font-display text-[16px] tracking-[0.22em] text-paper sm:inline">
              候车室
            </span>
          </Link>

          <nav className="ml-4 hidden items-center gap-1 md:flex">
            <NavLink to="/calendar" label="时刻" active={activeTab === 'calendar'} />
            <NavLink to="/library" label="仓库" active={activeTab === 'library'} />
            <NavLink to="/platform" label="站台" active={activeTab === 'platform'} />
            {isAdmin && (
              <NavLink
                to="/admin"
                label="后台"
                active={route.name === 'admin'}
              />
            )}
          </nav>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              const v = q.trim()
              if (!v) return
              navigate(`/search?q=${encodeURIComponent(v)}`)
              setQ('')
            }}
            className="relative ml-2 flex min-w-0 max-w-[15rem] flex-1 items-center"
          >
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint">
              <Icon name="search" size={14} />
            </span>
            {IS_MINI ? <Input
              value={q}
              onInput={(e) => setQ(e.detail.value)}
              onConfirm={(e) => {
                const v = e.detail.value.trim()
                if (v) navigate(`/search?q=${encodeURIComponent(v)}`)
                if (v) setQ('')
              }}
              placeholder="搜玩家 / 本子"
              aria-label="搜索"
              className="!py-1.5 !pl-8 !text-[13px]"
            /> : <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜玩家 / 本子"
              aria-label="搜索"
              className="!py-1.5 !pl-8 !text-[13px]"
            />}
          </form>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => navigate(user ? '/create' : '/login')}
              className="hidden h-8 items-center gap-1.5 rounded-lg bg-brass px-3 text-[13px] font-semibold text-[#1a1206] transition-colors hover:bg-[#eeb96f] sm:inline-flex"
            >
              <Icon name="plus" size={14} strokeWidth={2.4} />
              发车
            </button>
            {user ? (
              <Dropdown
                trigger={
                  <button
                    className="flex items-center gap-1.5 rounded-full p-0.5 transition-opacity hover:opacity-85"
                    aria-label="账号菜单"
                  >
                    <Avatar name={user.nickname} src={user.avatar} size={30} />
                    <Icon name="down" size={13} className="hidden text-faint sm:block" />
                  </button>
                }
                header={
                  <div className="flex items-center gap-2.5">
                    <Avatar name={user.nickname} src={user.avatar} size={34} />
                    <div className="min-w-0">
                      <div className="truncate text-[13px] text-paper">{user.nickname}</div>
                      <div className="truncate text-[11px] text-faint">
                        @{user.username}
                        {user.role !== 'user' && (
                          <span className="ml-1.5 rounded bg-brass/15 px-1 py-[1px] text-[10px] text-brass">
                            {ROLE_LABEL[user.role]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                }
                items={menuItems}
              />
            ) : route.name === 'login' ? null : (
              <Link
                href={href('/login')}
                className="rounded-lg border border-line px-3 py-1.5 text-[13px] text-muted transition-colors hover:border-line2 hover:text-paper"
              >
                登录
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-4 md:pb-16">{page}</main>

      {syncError && (
        <div className="fixed inset-x-0 top-14 z-40 mx-auto flex max-w-6xl justify-center px-4">
          <div className="rounded-lg border border-seal/40 bg-[#2a1512] px-3 py-1.5 text-[11.5px] text-seal shadow-lg">
            保存失败：{syncError}
          </div>
        </div>
      )}

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 backdrop-blur-xl md:hidden">
        <div className="flex h-14 items-stretch">
          <TabItem to="/calendar" label="时刻" icon="calendar" active={activeTab === 'calendar'} />
          <TabItem to="/library" label="仓库" icon="grid" active={activeTab === 'library'} />
          <Link
            href={href(user ? '/create' : '/login')}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 text-brass"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brass text-[#1a1206]">
              <Icon name="plus" size={15} strokeWidth={2.6} />
            </span>
            <span className="text-[10px] leading-none">发车</span>
          </Link>
          <TabItem to="/platform" label="站台" icon="users" active={activeTab === 'platform'} />
          <TabItem to="/me" label="我的" icon="user" active={activeTab === 'me'} />
        </div>
      </nav>

      <button
        onClick={() => setFeedbackOpen(true)}
        aria-label="提反馈"
        className="safe-bottom fixed bottom-20 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-surface2 text-paper shadow-lg ring-1 ring-line transition-colors hover:bg-surface3 md:bottom-6"
      >
        <Icon name="info" size={18} />
      </button>

      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
      {isOwner && db.settings.length === 0 && null}
    </div>
  )
}

function NoAccess() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-16 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-surface2 text-faint">
        <Icon name="lock" size={20} />
      </div>
      <p className="text-sm text-paper">这里是管理后台</p>
      <p className="mt-1.5 max-w-xs text-[13px] leading-relaxed text-faint">
        只有管理员能进。需要权限的话找站长开一下。
      </p>
      <button
        onClick={() => navigate('/calendar')}
        className="mt-4 rounded-lg border border-line px-3 py-1.5 text-[13px] text-muted hover:border-line2 hover:text-paper"
      >
        回到时刻
      </button>
    </div>
  )
}
