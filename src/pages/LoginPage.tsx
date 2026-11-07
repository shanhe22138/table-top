import { useState } from 'react'
import { signIn, signUp } from '../store/auth'
import { navigate } from '../lib/router'
import { Button, Field } from '../components/ui'
import { Icon } from '../components/Icons'
import { useBackendKind } from '../store/db'
import { IS_MINI } from '../lib/platform'

export default function LoginPage({
  redirect,
  reason,
}: {
  redirect: string | null
  reason?: string
}) {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const backendLabel = useBackendKind()

  async function submit(e?: React.FormEvent) {
    e?.preventDefault()
    setErr('')
    setBusy(true)
    const res =
      mode === 'in'
        ? await signIn({ username, password })
        : await signUp({ username, password, nickname })
    setBusy(false)
    if (!res.ok) {
      setErr(res.error ?? '出错了，再试一次')
      return
    }
    navigate(redirect ?? '/calendar')
  }

  function fillDemo() {
    setMode('in')
    setUsername('demo')
    setPassword('demo1234')
    setErr('')
  }

  return (
    <div className="anim-rise mx-auto flex max-w-sm flex-col pt-6">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-brass/40 bg-brass/10">
          <Icon name="sparkle" size={22} className="text-brass" />
        </div>
        <h1 className="font-display text-[22px] tracking-wide text-paper">
          {mode === 'in' ? '欢迎回来' : '设置昵称'}
        </h1>
        <p className="mt-1.5 text-[12.5px] text-faint">
          {reason ?? (mode === 'in' ? '登录后可以发车、上车、攒展柜' : '登录名自己定，不用邮箱也不用手机号')}
        </p>
      </div>

      <div className="mb-4 flex rounded-xl border border-line bg-surface2/50 p-0.5">
        {[
          { v: 'in' as const, label: '登录' },
          { v: 'up' as const, label: '注册' },
        ].map((t) => (
          <button
            key={t.v}
            onClick={() => {
              setMode(t.v)
              setErr('')
            }}
            className={`flex-1 rounded-[10px] py-2 text-[13px] transition-colors ${
              mode === t.v ? 'bg-surface3 text-paper' : 'text-faint hover:text-muted'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-3.5">
        {mode === 'up' && (
          <Field label="昵称" hint="2–12 个字符，别人看到的就是它">
            <input
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value)
                setErr('')
              }}
              placeholder="比如：阿盐"
              autoComplete="nickname"
            />
          </Field>
        )}
        <Field label="登录名" hint={mode === 'up' ? '2–16 位，中英文都可以' : undefined}>
          <input
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
              setErr('')
            }}
            placeholder={mode === 'up' ? '比如：ayan' : '你的登录名'}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
          />
        </Field>
        <Field label="密码" hint={mode === 'up' ? '至少 6 位' : undefined}>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setErr('')
            }}
            placeholder={mode === 'up' ? '设置一个密码' : '输入密码'}
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          />
        </Field>

        {err && (
          <div className="rounded-lg border border-seal/30 bg-seal/10 px-3 py-2 text-[12.5px] text-seal">
            {err}
          </div>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={busy}
          onClick={() => { if (IS_MINI) void submit() }}>
          {busy ? '处理中…' : mode === 'in' ? '登录' : '注册并登录'}
        </Button>
      </form>

      {backendLabel !== '服务器' && (
        <button
          onClick={fillDemo}
          className="mt-4 rounded-xl border border-dashed border-line2 px-3 py-2.5 text-left text-[12px] leading-relaxed text-faint transition-colors hover:border-brassdim hover:text-muted"
        >
          <span className="text-brass/90">想先随便看看？</span> 点这里填入示例账号（登录名 demo /
          密码 demo1234），里面有现成的活动和展柜。demo 是这个站的站长，管理后台、权限和日志都用它看。
        </button>
      )}

      <p className="mt-6 text-center text-[11px] leading-relaxed text-faint/70">
        当前数据存放位置：{backendLabel}
        <br />
        {backendLabel === '服务器'
          ? '所有账号和活动都存在服务器上，换设备登录也能看到同一份数据。'
          : '账号与数据只保存在这台设备的浏览器里，换设备或清缓存会丢失。'}
      </p>
    </div>
  )
}
