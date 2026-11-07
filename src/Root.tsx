import { useEffect, useState } from 'react'
import App from './MainApp'
import { initDB } from './store/db'

export default function Root() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    initDB().then(() => setReady(true)).catch((err) => {
      console.error('[table-top] 初始化失败', err)
      setError(err instanceof Error ? err.message : '加载失败')
    })
  }, [])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink px-6 text-center">
        <div>
          <p className="font-display text-lg text-paper">加载失败</p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">{error}</p>
        </div>
      </div>
    )
  }
  return ready ? <App /> : <div className="min-h-screen bg-ink" />
}
