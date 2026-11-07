import { useState } from 'react'
import { getBackend } from '../lib/backend'
import { useAuth } from '../store/auth'
import { Button } from './ui'
import { Icon } from './Icons'

export function FeedbackModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState('')
  const [email, setEmail] = useState(user?.email ?? '')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ ok: boolean; msg: string } | null>(null)

  async function submit() {
    if (!content.trim()) return
    setBusy(true)
    try {
      const backend = getBackend()
      if (!backend.feedback) {
        setDone({ ok: false, msg: '当前环境不支持提交反馈' })
        return
      }
      const res = await backend.feedback({
        subject: subject.trim() || '用户反馈',
        content: content.trim(),
        email: email.trim() || null,
        fromName: user?.nickname ?? '匿名',
      })
      if (res.ok) {
        const extra = res.stored && !res.emailed ? '（已记录，部署到服务器后会邮件通知站长）' : ''
        const emailed = res.emailed ? '已通过邮件发送给站长。' : ''
        setDone({ ok: true, msg: `反馈已提交。${emailed}${extra}` })
        setContent('')
        setSubject('')
      } else {
        setDone({ ok: false, msg: res.error ?? '提交失败，请稍后再试' })
      }
    } catch (e) {
      setDone({ ok: false, msg: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-line bg-ink p-5 shadow-2xl anim-rise"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-[17px] text-paper">提反馈 / 报 issue</h2>
          <button onClick={onClose} className="rounded p-1 text-faint hover:text-paper" aria-label="关闭">
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="主题（选填）"
            className="!py-2"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="说说你遇到的问题，或想提的建议"
            rows={5}
            className="resize-none"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="你的邮箱（选填，方便站长回复）"
            className="!py-2"
          />
        </div>

        {done && (
          <div
            className={`mt-3 rounded-lg px-3 py-2 text-[12.5px] ${
              done.ok ? 'bg-jade/10 text-jade' : 'bg-seal/10 text-seal'
            }`}
          >
            {done.msg}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            关闭
          </Button>
          <Button size="sm" onClick={submit} disabled={busy || !content.trim()}>
            {busy ? '提交中…' : '提交'}
          </Button>
        </div>
      </div>
    </div>
  )
}
