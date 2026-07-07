import type { ReactNode } from 'react'

interface PanelCardProps {
  title?: string
  children: ReactNode
  className?: string
  action?: ReactNode
  bare?: boolean
}

/** 侧栏统一卡片容器（暗黑） */
export default function PanelCard({ title, children, className = '', action, bare = false }: PanelCardProps) {
  if (bare) {
    return (
      <section className={`bg-surface-2 rounded-md overflow-hidden ${className}`}>
        <div className="p-1.5">{children}</div>
      </section>
    )
  }

  return (
    <section className={`bg-surface-2 rounded-md overflow-hidden ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-2.5 py-1.5 bg-surface-2/80">
          <h2 className="text-sm font-semibold text-text">{title}</h2>
          {action}
        </div>
      )}
      <div className="p-2">{children}</div>
    </section>
  )
}
