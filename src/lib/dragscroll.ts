import { useRef } from 'react'

/**
 * 让横向滚动容器支持鼠标按住拖动（触摸本来就能滑）。
 * 拖动后的一次点击会被吞掉，避免误触。
 */
export function useDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)
  const s = useRef({ down: false, startX: 0, startLeft: 0, moved: false })

  const onMouseDown = (e: React.MouseEvent) => {
    const el = ref.current
    if (!el || e.button !== 0) return
    s.current.down = true
    s.current.startX = e.pageX
    s.current.startLeft = el.scrollLeft
    s.current.moved = false
  }
  const onMouseMove = (e: React.MouseEvent) => {
    const el = ref.current
    if (!el || !s.current.down) return
    const dx = e.pageX - s.current.startX
    if (Math.abs(dx) > 3) s.current.moved = true
    el.scrollLeft = s.current.startLeft - dx
  }
  const end = () => {
    s.current.down = false
  }
  const onClickCapture = (e: React.MouseEvent) => {
    if (s.current.moved) {
      e.preventDefault()
      e.stopPropagation()
      s.current.moved = false
    }
  }

  return {
    ref,
    handlers: {
      onMouseDown,
      onMouseMove,
      onMouseUp: end,
      onMouseLeave: end,
      onClickCapture,
    },
  }
}
