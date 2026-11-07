import { useMemo, useState } from 'react'
import { useDB } from '../store/db'
import { useAuth } from '../store/auth'
import { followUser, unfollowUser, searchGames, searchUsers } from '../store/social'
import { navigate, href } from '../lib/router'
import { Avatar, Button, Chip, EmptyState } from '../components/ui'
import { GameCard } from '../components/cards'
import { Icon } from '../components/Icons'
import { ROLE_LABEL, type User } from '../types'
import Link from '../components/Link'

type Tab = 'user' | 'game'

export default function SearchPage({ q: initial = '' }: { q?: string }) {
  const db = useDB()
  const { user } = useAuth()
  const [q, setQ] = useState(initial)
  const [tab, setTab] = useState<Tab>('user')

  const users = useMemo(() => searchUsers(db, q, 30), [db, q])
  const games = useMemo(() => searchGames(db, q, 30), [db, q])

  const title = tab === 'user' ? '用户' : '仓库'
  const list = tab === 'user' ? users : games

  return (
    <div className="anim-rise">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] leading-tight tracking-wide text-paper">搜索</h1>
          <p className="mt-1 text-[12.5px] text-faint">找人、找车友，也找仓库里的本子和桌游</p>
        </div>
        <Link
          href={href('/calendar')}
          className="mt-1 shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-[12px] text-faint transition-colors hover:border-line2 hover:text-paper"
        >
          返回
        </Link>
      </div>

      <div className="relative mb-3">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
          <Icon name="search" size={15} />
        </span>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜昵称、@登录名、uid，或本子 / 桌游"
          className="!pl-9 !py-2.5 !text-[14px]"
        />
      </div>

      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        <Chip active={tab === 'user'} onClick={() => setTab('user')}>
          用户
        </Chip>
        <Chip active={tab === 'game'} onClick={() => setTab('game')}>
          仓库
        </Chip>
      </div>

      {!q.trim() ? (
        <EmptyState
          icon="search"
          title={`搜${title}`}
          desc="输入关键词后，这里会列出相关的用户或条目。"
        />
      ) : list.length === 0 ? (
        <EmptyState icon="search" title="没有匹配的结果" desc="换个关键词试试。" />
      ) : tab === 'user' ? (
        <div className="space-y-2">
          {users.map((u) => (
            <UserRow key={u.id} u={u} me={user} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {games.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      )}
    </div>
  )
}

function UserRow({ u, me }: { u: User; me: ReturnType<typeof useAuth>['user'] }) {
  const following = !!me && me.following.includes(u.id)
  const isSelf = !!me && me.id === u.id
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface/40 px-3 py-2.5">
      <Link href={href(`/u/${u.id}`)} className="shrink-0">
        <Avatar name={u.nickname} src={u.avatar} size={40} />
      </Link>
      <Link href={href(`/u/${u.id}`)} className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[14px] text-paper">{u.nickname}</span>
          {u.role !== 'user' && (
            <span className="rounded bg-brass/15 px-1 py-[1px] text-[10px] text-brass">
              {ROLE_LABEL[u.role]}
            </span>
          )}
        </div>
        <div className="truncate text-[11.5px] text-faint">
          {u.showUsername ? `@${u.username}` : '—'} · {u.uid}
        </div>
      </Link>
      {!isSelf && me && (
        <Button
          size="sm"
          variant={following ? 'outline' : 'primary'}
          onClick={() => (following ? unfollowUser(me.id, u.id) : followUser(me.id, u.id))}
        >
          {following ? '已关注' : '关注'}
        </Button>
      )}
      {isSelf && <span className="text-[11.5px] text-faint">我自己</span>}
    </div>
  )
}
