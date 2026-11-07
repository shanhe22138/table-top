import { useEffect } from 'react'
import { useDB } from '../store/db'
import { navigate } from '../lib/router'
import { Button, EmptyState } from '../components/ui'

export default function JoinPage({ code }: { code: string }) {
  const db = useDB()
  const event = db.events.find((e) => e.shareCode === code)

  useEffect(() => {
    if (event) navigate(`/event/${event.id}`, { replace: true })
  }, [event])

  if (event) {
    return (
      <div className="flex items-center justify-center py-20 text-[13px] text-faint">
        正在打开这车…
      </div>
    )
  }

  return (
    <div className="py-12">
      <EmptyState
        icon="link"
        title="这个上车链接已经失效了"
        desc="可能车头把这车撤了，或者链接复制的时候少了几位。"
        action={<Button onClick={() => navigate('/calendar')}>看看最近的车</Button>}
      />
    </div>
  )
}
