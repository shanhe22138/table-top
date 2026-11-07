import { useMemo, useState } from 'react'
import { mutate, useDB } from '../store/db'
import { useAuth } from '../store/auth'
import { href, navigate } from '../lib/router'
import { Icon } from '../components/Icons'
import { Avatar, Button, Chip, EmptyState, Field, Sheet, Switch, Tag } from '../components/ui'
import { SeatBar } from '../components/cards'
import { CoverArt } from '../components/CoverArt'
import { PsychEditor } from '../components/PsychEditor'
import {
  assignRole,
  addWaitlist,
  promoteWaitlist,
  removeSeat,
  submitPsych,
} from '../store/social'
import { JOIN_MODE_LABEL, KIND_LABEL, type Role, type Seat } from '../types'
import { formatDateFull, formatDuration, formatTime, gameTitle, relativeDay } from '../lib/format'
import Link from '../components/Link'
import { confirmAction, copyText, IS_BROWSER } from '../lib/platform'

export default function EventDetailPage({ id, autoJoin = false }: { id: string; autoJoin?: boolean }) {
  const db = useDB()
  const { user } = useAuth()
  const event = db.events.find((e) => e.id === id)
  const [addOpen, setAddOpen] = useState(false)
  const [pName, setPName] = useState('')
  const [pContact, setPContact] = useState('')
  const [pRole, setPRole] = useState('')
  const [err, setErr] = useState('')
  const [toast, setToast] = useState('')

  // 心测上车
  const [joinOpen, setJoinOpen] = useState(false)
  const [jName, setJName] = useState('')
  const [jContact, setJContact] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [jErr, setJErr] = useState('')
  // 车头分配角色
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignSeatId, setAssignSeatId] = useState('')
  const [assignRoleName, setAssignRoleName] = useState('')
  // 添加候补
  const [waitOpen, setWaitOpen] = useState(false)
  const [wName, setWName] = useState('')
  const [wContact, setWContact] = useState('')
  const [wErr, setWErr] = useState('')

  const game = useMemo(() => db.games.find((g) => g.id === event?.gameId), [db.games, event])

  if (!event) {
    return (
      <EmptyState
        icon="info"
        title="活动不存在"
        desc="链接可能已经失效，或者车头把这车撤了。"
        action={<Button onClick={() => navigate('/calendar')}>回到时刻</Button>}
      />
    )
  }

  const taken = event.seats.filter((s) => s.status === 'filled').length
  const pending = event.seats.filter((s) => s.status === 'pending').length
  const waitlist = event.seats.filter((s) => s.status === 'waitlist')
  const waitCount = waitlist.length
  const isHost = user?.id === event.hostId
  const mySeat = user ? event.seats.find((s) => s.userId === user.id) : undefined
  const openSeats = event.seats.filter((s) => s.status === 'open')
  const openSeat = openSeats[0]
  const psychOn = !!event.psych?.enabled
  const started = new Date(event.startAt).getTime() < Date.now()
  const closed = event.status === 'cancelled' || event.status === 'done' || started

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  function join() {
    if (psychOn) openJoin()
    else joinSeat()
  }

  function leave(seatId: string) {
    mutate((d) => {
      const ev = d.events.find((e) => e.id === id)
      const seat = ev?.seats.find((s) => s.id === seatId)
      if (!seat) return
      const wasWait = seat.status === 'waitlist'
      seat.userId = null
      seat.name = null
      seat.contact = null
      seat.note = null
      seat.roleName = null
      seat.psychAnswers = undefined
      // 候补位退出的话，保留为空的候补位；普通位退回 open
      seat.status = wasWait ? 'waitlist' : 'open'
    })
    flash('已退出该活动')
  }

  function confirmSeat(seatId: string) {
    mutate((d) => {
      const ev = d.events.find((e) => e.id === id)
      const seat = ev?.seats.find((s) => s.id === seatId)
      if (seat) seat.status = 'filled'
    })
    flash('已确认')
  }

  function addPlaceholder() {
    if (pName.trim().length < 1) {
      setErr('请填写玩家称呼')
      return
    }
    const target = event!.seats.find((s) => s.status === 'open')
    if (!target) {
      setErr('名额已满，请先增加人数')
      return
    }
    mutate((d) => {
      const ev = d.events.find((e) => e.id === id)
      const seat = ev?.seats.find((s) => s.id === target.id)
      if (!seat) return
      seat.name = pName.trim()
      seat.contact = pContact.trim() || null
      seat.roleName = pRole.trim() || null
      seat.status = 'filled'
      seat.note = '车头代占'
    })
    setPName('')
    setPContact('')
    setPRole('')
    setErr('')
    setAddOpen(false)
    flash('已代为占位')
  }

  async function cancelEvent() {
    if (!await confirmAction('确定取消该活动？取消后仍可查看，但不再接受报名。')) return
    mutate((d) => {
      const ev = d.events.find((e) => e.id === id)
      if (ev) ev.status = 'cancelled'
    })
    flash('活动已取消')
  }

  async function copyLink() {
    const url = IS_BROWSER
      ? `${location.origin}${location.pathname}#/join/${event!.shareCode}`
      : `/mini/index#/join/${event!.shareCode}`
    await copyText(url)
    flash('上车链接已复制')
  }

  /** 普通（无心测）上车：占第一个空位；指定 seatId 则占那个位（用来自选角色） */
  function joinSeat(seatId?: string) {
    if (!user) {
      navigate(`/login?next=/event/${id}`)
      return
    }
    if (mySeat) {
      flash('你已在该活动的名单中')
      return
    }
    const seat = seatId
      ? event!.seats.find((s) => s.id === seatId && s.status === 'open')
      : openSeat
    if (!seat) {
      flash('名额已满')
      return
    }
    if (event!.joinMode === 'invite' && !isHost) {
      flash('该活动仅限邀请，请联系发起人获取名额')
      return
    }
    mutate((d) => {
      const ev = d.events.find((e) => e.id === id)
      const s = ev?.seats.find((x) => x.id === seat.id)
      if (!ev || !s) return
      s.userId = user!.id
      s.name = user!.nickname
      s.status = ev.joinMode === 'approval' ? 'pending' : 'filled'
      s.note = null
    })
    flash(event!.joinMode === 'approval' ? '申请已提交，等待发起人确认' : '已加入，名额已为你保留')
  }

  /** 心测上车：填完问卷后提交，座位进入待分配（pending） */
  function openJoin() {
    if (!user) {
      navigate(`/login?next=/event/${id}`)
      return
    }
    if (mySeat) {
      flash('你已在该活动的名单中')
      return
    }
    if (!openSeat) {
      flash('名额已满')
      return
    }
    setJName(user.nickname)
    setJContact('')
    setAnswers({})
    setJErr('')
    setJoinOpen(true)
  }

  function submitPsychJoin() {
    if (!openSeat) {
      setJErr('名额已满')
      return
    }
    if (!jName.trim()) {
      setJErr('填一下你的称呼')
      return
    }
    const test = event!.psych?.test
    if (test) {
      const missing = test.questions.filter((q) => !answers[q.id])
      if (missing.length) {
        setJErr('还有题目没答完')
        return
      }
    }
    submitPsych(event!.id, openSeat.id, answers, {
      name: jName.trim(),
      contact: jContact.trim() || null,
    })
    setJoinOpen(false)
    flash('心测已提交，等待车头分配角色')
  }

  function openAssign(seatId: string) {
    setAssignSeatId(seatId)
    setAssignRoleName('')
    setAssignOpen(true)
  }

  function doAssign() {
    assignRole(event!.id, assignSeatId, assignRoleName.trim())
    setAssignOpen(false)
    flash('已分配角色')
  }

  function addWait() {
    if (!wName.trim()) {
      setWErr('填一下称呼')
      return
    }
    addWaitlist(event!.id, { name: wName.trim(), contact: wContact.trim() || null })
    setWName('')
    setWContact('')
    setWErr('')
    setWaitOpen(false)
    flash('已加入候补')
  }

  function promote(seatId: string) {
    promoteWaitlist(event!.id, seatId, {})
    flash('已让该候补上车')
  }

  function removeSeatById(seatId: string) {
    removeSeat(event!.id, seatId)
    flash('已移除')
  }

  return (
    <div className="anim-rise">
      <button
        onClick={() => (history.length > 1 ? history.back() : navigate('/calendar'))}
        className="mb-3 inline-flex items-center gap-1 text-[13px] text-faint transition-colors hover:text-paper"
      >
        <Icon name="left" size={15} /> 返回
      </button>

      <div className="mb-4">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="rounded bg-surface2 px-1.5 py-0.5 text-[10.5px] text-muted">
            {KIND_LABEL[event.kind]}
          </span>
          <Tag>{JOIN_MODE_LABEL[event.joinMode]}</Tag>
          {event.status === 'cancelled' && <Tag>已取消</Tag>}
          {event.status === 'done' && <Tag>已结束</Tag>}
          {taken >= event.capacity && event.status === 'open' && <Tag>满车</Tag>}
        </div>
        <h1 className="font-display text-[24px] leading-tight tracking-wide text-paper">
          {event.title}
        </h1>
        <div className="mt-2 flex items-center gap-2">
          <Link
            href={href(`/u/${event.hostId}`)}
            className="group inline-flex items-center gap-2"
            title={`查看 ${event.hostName} 的资料`}
          >
            <Avatar name={event.hostName} size={22} />
            <span className="text-[12.5px] text-muted transition-colors group-hover:text-brass">
              {event.hostName}
            </span>
          </Link>
          <span className="text-[12.5px] text-muted">的车 · {relativeDay(event.startAt)}</span>
        </div>
      </div>

      {/* 信息卡 */}
      <div className="rounded-2xl border border-line bg-surface/70 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoRow icon="calendar" label="时间">
            {formatDateFull(event.startAt)} {formatTime(event.startAt)}
          </InfoRow>
          <InfoRow icon="clock" label="预计时长">
            {formatDuration(event.durationMin)}
          </InfoRow>
          <InfoRow icon="pin" label="地点">
            {event.city} · {event.venue}
          </InfoRow>
          <InfoRow icon="users" label="人数">
            {taken}/{event.capacity} 人
            {pending > 0 && <span className="ml-1.5 text-brass/80">（{pending} 人待确认）</span>}
            {waitCount > 0 && <span className="ml-1.5 text-faint">· {waitCount} 候补</span>}
          </InfoRow>
        </div>

        <div className="mt-4">
          <SeatBar taken={taken} total={event.capacity} />
        </div>

        {event.note && (
          <div className="mt-4 rounded-xl border border-line/70 bg-ink/40 p-3">
            <div className="mb-1 text-[10.5px] text-faint">车头留言</div>
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-muted">{event.note}</p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {!mySeat && !closed && (
            <Button onClick={join} className="flex-1 sm:flex-none">
              <Icon name={psychOn ? 'book' : 'check'} size={15} />
              {psychOn ? '做心测上车' : event.joinMode === 'approval' ? '申请加入' : '我要上车'}
            </Button>
          )}
          {mySeat && (
            <Button variant="outline" onClick={() => leave(mySeat.id)}>
              <Icon name="close" size={14} /> 跳车
            </Button>
          )}
          <Button variant="soft" onClick={copyLink}>
            <Icon name="share" size={14} /> 分享上车链接
          </Button>
          {isHost && (
            <Button variant="soft" onClick={() => setAddOpen(true)}>
              <Icon name="plus" size={14} /> 代占一个位
            </Button>
          )}
          {isHost && (
            <Button variant="soft" onClick={() => setWaitOpen(true)}>
              <Icon name="users" size={14} /> 加候补
            </Button>
          )}
          {isHost && !closed && (
            <Button variant="danger" onClick={cancelEvent}>
              取消活动
            </Button>
          )}
        </div>
      </div>

      {/* 座位 */}
      <section className="mt-6">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-display text-[16px] text-paper">上车名单</h2>
          <span className="text-[11px] text-faint">
            {openSeats.length > 0 ? `空位 ${openSeats.length} 个` : '已满车'}
            {waitCount > 0 && ` · 候补 ${waitCount}`}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {event.seats.map((s, i) => {
            const mine = s.userId && s.userId === user?.id
            const isWait = s.status === 'waitlist'
            const isOpen = s.status === 'open'
            const isPending = s.status === 'pending'
            const isPsychPending = isPending && !!s.psychAnswers
            const seatUser = s.userId ? db.users.find((u) => u.id === s.userId) : undefined
            const canClickOpen = isOpen && !isHost && !closed && !mySeat

            const line2 = isOpen
              ? s.roleName
                ? `角色：${s.roleName}${s.gender ? ` · ${s.gender}` : ''}`
                : s.note
                  ? s.note
                  : '空位'
              : s.roleName
                ? `角色：${s.roleName}${s.gender ? ` · ${s.gender}` : ''}`
                : s.note
                  ? s.note
                  : s.contact ?? ''

            const inner = (
              <>
                {isOpen ? (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-line2 text-faint">
                    <Icon name="plus" size={12} />
                  </div>
                ) : (
                  <Avatar name={s.name ?? '?'} src={seatUser?.avatar} size={24} />
                )}
                <div className="min-w-0 flex-1">
                  <div
                    className={`truncate text-[12.5px] ${
                      isOpen || isWait ? 'text-faint' : 'text-paper'
                    }`}
                  >
                    {isOpen ? (s.roleName ? s.roleName : '空位') : s.name}
                    {isWait && s.name ? '（候补）' : ''}
                  </div>
                  <div className="truncate text-[10px] text-faint">{line2}</div>
                </div>
              </>
            )

            const body = s.userId ? (
              <Link
                href={href(`/u/${s.userId}`)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-md transition-opacity hover:opacity-80"
                title={`查看 ${s.name} 的资料`}
              >
                {inner}
              </Link>
            ) : (
              inner
            )

            return (
              <div
                key={s.id}
                className={`relative rounded-xl border p-2.5 ${
                  isWait
                    ? 'border-dashed border-jade/40 bg-jade/[0.04]'
                    : s.status === 'filled'
                      ? 'border-line bg-surface/70'
                      : isPending
                        ? 'border-brass/40 bg-brass/5'
                        : 'border-dashed border-line2 bg-transparent'
                } ${canClickOpen ? 'cursor-pointer transition-colors hover:border-brass/50' : ''}`}
                onClick={canClickOpen ? () => (psychOn ? openJoin() : joinSeat(s.id)) : undefined}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-faint">#{i + 1}</span>
                  {isPsychPending && <span className="text-[9.5px] text-brass">待分配</span>}
                  {isPending && !isPsychPending && (
                    <span className="text-[9.5px] text-brass">待确认</span>
                  )}
                  {isWait && <span className="text-[9.5px] text-jade">候补</span>}
                  {mine && s.status === 'filled' && (
                    <span className="text-[9.5px] text-jade">我</span>
                  )}
                </div>
                <div className="mt-1.5 flex items-center gap-2">{body}</div>
                {(isHost || (mine && !closed)) && (
                  <div className="mt-2 flex gap-1.5">
                    {isHost && isPsychPending && (
                      <button
                        onClick={() => openAssign(s.id)}
                        className="flex-1 rounded-md bg-brass/15 py-1 text-[10px] text-brass hover:bg-brass/25"
                      >
                        分配角色
                      </button>
                    )}
                    {isHost && isPending && !isPsychPending && (
                      <button
                        onClick={() => confirmSeat(s.id)}
                        className="flex-1 rounded-md bg-brass/15 py-1 text-[10px] text-brass hover:bg-brass/25"
                      >
                        确认
                      </button>
                    )}
                    {isHost && isWait && s.name && (
                      <button
                        onClick={() => promote(s.id)}
                        className="flex-1 rounded-md bg-jade/15 py-1 text-[10px] text-jade hover:bg-jade/25"
                      >
                        上车
                      </button>
                    )}
                    {isHost && isWait && (
                      <button
                        onClick={() => removeSeatById(s.id)}
                        className="flex-1 rounded-md bg-surface2 py-1 text-[10px] text-faint hover:text-seal"
                      >
                        移除
                      </button>
                    )}
                    {!isWait && (
                      <button
                        onClick={() => leave(s.id)}
                        className="flex-1 rounded-md bg-surface2 py-1 text-[10px] text-faint hover:text-seal"
                      >
                        {mine ? '退出' : '移出'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* 关联条目 */}
      {game && (
        <section className="mt-6">
          <h2 className="mb-2 font-display text-[16px] text-paper">这场玩的</h2>
          <Link
            href={href(`/game/${game.id}`)}
            className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 hover:border-line2"
          >
            <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg border border-line">
              <CoverArt game={game} showSeal={false} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-[14px] text-paper">{gameTitle(game)}</div>
              <div className="mt-0.5 line-clamp-1 text-[11.5px] text-faint">
                {game.tags.slice(0, 3).join(' · ')}
              </div>
              <div className="mt-1 text-[11px] text-brass">{game.rating.toFixed(1)} 分</div>
            </div>
            <Icon name="right" size={16} className="text-faint" />
          </Link>
        </section>
      )}

      <Sheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="代占一个位"
        subtitle="为不便自行报名的玩家预留名额"
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setAddOpen(false)}>
              取消
            </Button>
            <Button className="flex-1" onClick={addPlaceholder}>
              确认占位
            </Button>
          </div>
        }
      >
        <div className="space-y-3.5">
          <Field label="玩家称呼" error={err}>
            <input
              value={pName}
              onChange={(e) => {
                setPName(e.target.value)
                setErr('')
              }}
              placeholder="比如：小王"
            />
          </Field>
          <Field label="联系方式" hint="选填">
            <input
              value={pContact}
              onChange={(e) => setPContact(e.target.value)}
              placeholder="微信 / 手机号"
            />
          </Field>
          <Field label="想玩的角色" hint="选填">
            <input
              value={pRole}
              onChange={(e) => setPRole(e.target.value)}
              placeholder="比如：沈砚"
            />
          </Field>
        </div>
      </Sheet>

      {/* 心测上车 */}
      <Sheet
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        title="做心测上车"
        subtitle={event.psych?.test?.title}
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setJoinOpen(false)}>
              取消
            </Button>
            <Button className="flex-1" onClick={submitPsychJoin}>
              提交并上车
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {event.psych?.test?.questions.map((q) => (
            <div key={q.id}>
              <div className="mb-1.5 text-[13px] text-paper">{q.text}</div>
              <div className="space-y-1.5">
                {q.options.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setAnswers({ ...answers, [q.id]: o.id })}
                    className={`block w-full rounded-lg border px-3 py-2 text-left text-[12.5px] transition-colors ${
                      answers[q.id] === o.id
                        ? 'border-brass bg-brass/10 text-paper'
                        : 'border-line text-muted hover:border-line2'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {(!event.psych?.test || event.psych.test.questions.length === 0) && (
            <p className="text-[12.5px] text-faint">这车开启了心测，但还没配置题目，直接填称呼即可。</p>
          )}
          <Field label="你的称呼">
            <input
              value={jName}
              onChange={(e) => {
                setJName(e.target.value)
                setJErr('')
              }}
              placeholder="比如：小王"
            />
          </Field>
          <Field label="联系方式" hint="选填，方便车头联系你">
            <input
              value={jContact}
              onChange={(e) => setJContact(e.target.value)}
              placeholder="微信 / 手机号"
            />
          </Field>
          {jErr && <p className="text-[12.5px] text-seal">{jErr}</p>}
        </div>
      </Sheet>

      {/* 车头分配角色 */}
      <Sheet
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="分配角色"
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setAssignOpen(false)}>
              取消
            </Button>
            <Button className="flex-1" onClick={doAssign}>
              确认分配
            </Button>
          </div>
        }
      >
        <div className="space-y-3.5">
          {(() => {
            const seat = event.seats.find((s) => s.id === assignSeatId)
            const test = event.psych?.test
            const summary =
              test && seat?.psychAnswers
                ? test.questions.map((q) => {
                    const opt = q.options.find((o) => o.id === seat.psychAnswers?.[q.id])
                    return { q: q.text, a: opt?.label ?? '（未答）', tag: opt?.tag }
                  })
                : null
            if (!summary) return null
            return (
              <div className="rounded-xl border border-line bg-ink/40 p-3">
                <div className="mb-1.5 text-[10.5px] text-faint">{seat?.name} 的心测结果</div>
                <ul className="space-y-1">
                  {summary.map((s, i) => (
                    <li key={i} className="text-[12px] text-muted">
                      <span className="text-faint">{s.q}：</span> {s.a}
                      {s.tag && (
                        <span className="ml-1 rounded bg-brass/15 px-1 py-[1px] text-[10px] text-brass">
                          {s.tag}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })()}
          {game?.roles && game.roles.length > 0 && (
            <div>
              <div className="mb-1.5 text-[11.5px] text-faint">从角色表选（点一下即可）</div>
              <div className="flex flex-wrap gap-2">
                {game.roles.map((r: Role) => (
                  <Chip
                    key={r.name}
                    active={assignRoleName === r.name}
                    onClick={() => setAssignRoleName(r.name)}
                  >
                    {r.name}
                    {r.gender !== '不限' ? ` · ${r.gender}` : ''}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          <Field label="角色名" hint="也可直接手填">
            <input
              value={assignRoleName}
              onChange={(e) => setAssignRoleName(e.target.value)}
              placeholder="比如：沈砚"
            />
          </Field>
        </div>
      </Sheet>

      {/* 加候补 */}
      <Sheet
        open={waitOpen}
        onClose={() => setWaitOpen(false)}
        title="加一个候补"
        subtitle="满车后想上车的人排这里，是否上车由你联系决定"
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setWaitOpen(false)}>
              取消
            </Button>
            <Button className="flex-1" onClick={addWait}>
              加入候补
            </Button>
          </div>
        }
      >
        <div className="space-y-3.5">
          <Field label="玩家称呼" error={wErr}>
            <input
              value={wName}
              onChange={(e) => {
                setWName(e.target.value)
                setWErr('')
              }}
              placeholder="比如：小王"
            />
          </Field>
          <Field label="联系方式" hint="选填">
            <input
              value={wContact}
              onChange={(e) => setWContact(e.target.value)}
              placeholder="微信 / 手机号"
            />
          </Field>
        </div>
      </Sheet>

      {toast && (
        <div className="anim-fade fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-line bg-surface2 px-4 py-2 text-[12.5px] text-paper shadow-xl">
          {toast}
        </div>
      )}
    </div>
  )
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: string
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-surface2 text-brass/80">
        <Icon name={icon} size={13} />
      </span>
      <div className="min-w-0">
        <div className="text-[10.5px] text-faint">{label}</div>
        <div className="mt-0.5 text-[13px] leading-snug text-paper">{children}</div>
      </div>
    </div>
  )
}
