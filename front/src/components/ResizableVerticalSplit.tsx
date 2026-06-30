import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

interface ResizableVerticalSplitProps {
  top: ReactNode
  bottom: ReactNode
  defaultRatio?: number
  minTop?: number
  minBottom?: number
}

export default function ResizableVerticalSplit({
  top,
  bottom,
  defaultRatio = 0.38,
  minTop = 120,
  minBottom = 160,
}: ResizableVerticalSplitProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [topHeight, setTopHeight] = useState<number | null>(null)
  const dragging = useRef(false)

  const clampHeight = useCallback(
    (height: number, containerHeight: number) => {
      const maxTop = containerHeight - minBottom
      return Math.min(Math.max(height, minTop), maxTop)
    },
    [minTop, minBottom],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const syncDefault = () => {
      setTopHeight((prev) => {
        if (prev !== null) return prev
        const h = container.getBoundingClientRect().height
        return clampHeight(h * defaultRatio, h)
      })
    }

    syncDefault()
    const observer = new ResizeObserver(syncDefault)
    observer.observe(container)
    return () => observer.disconnect()
  }, [defaultRatio, clampHeight])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      setTopHeight(clampHeight(e.clientY - rect.top, rect.height))
    }

    const onUp = () => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [clampHeight])

  const startDrag = () => {
    dragging.current = true
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
  }

  return (
    <div ref={containerRef} className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div
        className="shrink-0 overflow-hidden flex flex-col min-h-0"
        style={topHeight !== null ? { height: topHeight } : undefined}
      >
        {top}
      </div>

      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="调整工单池与图文直播高度"
        onMouseDown={startDrag}
        className="shrink-0 h-1.5 cursor-ns-resize group flex items-center justify-center bg-surface-2 hover:bg-surface-3 transition-colors"
      >
        <div className="w-10 h-1 rounded-full bg-border group-hover:bg-text-dim/50 transition-colors" />
      </div>

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {bottom}
      </div>
    </div>
  )
}
