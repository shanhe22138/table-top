import type { ReactNode } from 'react'
import { useDragScroll } from '../lib/dragscroll'

/** 横向滚动行，支持鼠标按住拖动（触摸原生可滑） */
export function DragRow({ className, children }: { className?: string; children: ReactNode }) {
  const d = useDragScroll()
  return (
    <div ref={d.ref} {...d.handlers} className={`${className ?? ''} cursor-grab active:cursor-grabbing`}>
      {children}
    </div>
  )
}
