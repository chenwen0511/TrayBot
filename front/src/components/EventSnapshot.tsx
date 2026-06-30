import type { LiveEventType } from '../types'

interface EventSnapshotProps {
  type: LiveEventType
  className?: string
}

export default function EventSnapshot({ type, className = '' }: EventSnapshotProps) {
  const base = `w-full h-full ${className}`

  switch (type) {
    case 'order_received':
      return (
        <svg viewBox="0 0 320 180" className={base} xmlns="http://www.w3.org/2000/svg">
          <rect width="320" height="180" fill="#1a2332" />
          <rect x="80" y="40" width="160" height="100" rx="6" fill="#243044" stroke="#6366f1" strokeWidth="2" />
          <line x1="100" y1="65" x2="220" y2="65" stroke="#6366f1" strokeWidth="2" opacity="0.5" />
          <line x1="100" y1="85" x2="190" y2="85" stroke="#6366f1" strokeWidth="2" opacity="0.3" />
          <line x1="100" y1="105" x2="200" y2="105" stroke="#6366f1" strokeWidth="2" opacity="0.3" />
          <circle cx="240" cy="55" r="10" fill="#6366f1" opacity="0.8" />
          <text x="240" y="59" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">!</text>
        </svg>
      )
    case 'nav_to_pickup':
    case 'nav_to_delivery':
      return (
        <svg viewBox="0 0 320 180" className={base} xmlns="http://www.w3.org/2000/svg">
          <rect width="320" height="180" fill="#1a2332" />
          <line x1="40" y1="140" x2="280" y2="140" stroke="#334155" strokeWidth="2" />
          <circle cx="60" cy="140" r="6" fill="#6366f1" />
          <circle cx="160" cy="100" r="8" fill="#00d4aa">
            <animate attributeName="cx" values="60;260;60" dur="4s" repeatCount="indefinite" />
            <animate attributeName="cy" values="140;100;140" dur="4s" repeatCount="indefinite" />
          </circle>
          <circle cx="260" cy="100" r="6" fill="#10b981" />
          <path d="M60 140 Q160 60 260 100" stroke="#f59e0b" strokeWidth="2" fill="none" strokeDasharray="8 4" />
        </svg>
      )
    case 'arrived_pickup':
      return (
        <svg viewBox="0 0 320 180" className={base} xmlns="http://www.w3.org/2000/svg">
          <rect width="320" height="180" fill="#1a2332" />
          <rect x="100" y="50" width="120" height="80" rx="4" fill="#243044" stroke="#f59e0b" strokeWidth="2" />
          {[0, 1, 2].map((i) => (
            <rect key={i} x={110 + i * 35} y="60" width="25" height="20" rx="2" fill="#f59e0b" opacity={0.3 + i * 0.2} />
          ))}
          <circle cx="160" cy="150" r="8" fill="#00d4aa" />
        </svg>
      )
    case 'arrived_delivery':
      return (
        <svg viewBox="0 0 320 180" className={base} xmlns="http://www.w3.org/2000/svg">
          <rect width="320" height="180" fill="#1a2332" />
          <rect x="100" y="50" width="120" height="80" rx="4" fill="#243044" stroke="#10b981" strokeWidth="2" />
          {[0, 1, 2].map((i) => (
            <rect key={i} x={110 + i * 35} y="60" width="25" height="20" rx="2" fill="#10b981" opacity={0.3 + i * 0.2} />
          ))}
          <circle cx="160" cy="150" r="8" fill="#00d4aa" />
        </svg>
      )
    case 'target_locked':
      return (
        <svg viewBox="0 0 320 180" className={base} xmlns="http://www.w3.org/2000/svg">
          <rect width="320" height="180" fill="#1a2332" />
          <rect x="100" y="40" width="120" height="80" rx="4" stroke="#3b82f6" strokeWidth="2" fill="none" strokeDasharray="6 3" />
          <circle cx="160" cy="80" r="30" stroke="#3b82f6" strokeWidth="2" fill="none" />
          <line x1="130" y1="50" x2="190" y2="110" stroke="#3b82f6" strokeWidth="1.5" />
          <line x1="190" y1="50" x2="130" y2="110" stroke="#3b82f6" strokeWidth="1.5" />
          <circle cx="160" cy="80" r="4" fill="#3b82f6" />
        </svg>
      )
    case 'grab_success':
      return (
        <svg viewBox="0 0 320 180" className={base} xmlns="http://www.w3.org/2000/svg">
          <rect width="320" height="180" fill="#1a2332" />
          <rect x="120" y="60" width="80" height="50" rx="3" fill="#00d4aa" opacity="0.3" stroke="#00d4aa" strokeWidth="2" />
          <path d="M100 90 L120 70 L120 110 Z" fill="#00d4aa" opacity="0.6" />
          <path d="M220 90 L200 70 L200 110 Z" fill="#00d4aa" opacity="0.6" />
          <path d="M150 95 L157 102 L172 87" stroke="#00d4aa" strokeWidth="3" fill="none" strokeLinecap="round" />
        </svg>
      )
    case 'put_backpack':
      return (
        <svg viewBox="0 0 320 180" className={base} xmlns="http://www.w3.org/2000/svg">
          <rect width="320" height="180" fill="#1a2332" />
          <rect x="110" y="30" width="100" height="120" rx="8" fill="#243044" stroke="#a855f7" strokeWidth="2" />
          <rect x="130" y="70" width="60" height="30" rx="2" fill="#a855f7" opacity="0.5" />
          <line x1="160" y1="50" x2="160" y2="65" stroke="#a855f7" strokeWidth="2" />
          <circle cx="160" cy="48" r="4" fill="#a855f7" />
        </svg>
      )
    case 'taking_out':
      return (
        <svg viewBox="0 0 320 180" className={base} xmlns="http://www.w3.org/2000/svg">
          <rect width="320" height="180" fill="#1a2332" />
          <rect x="110" y="30" width="100" height="120" rx="8" fill="#243044" stroke="#06b6d4" strokeWidth="2" />
          <rect x="130" y="70" width="60" height="30" rx="2" fill="#06b6d4" opacity="0.3" stroke="#06b6d4" strokeWidth="1" strokeDasharray="4 2">
            <animate attributeName="y" values="70;55;70" dur="1.5s" repeatCount="indefinite" />
          </rect>
        </svg>
      )
    case 'put_shelf_success':
      return (
        <svg viewBox="0 0 320 180" className={base} xmlns="http://www.w3.org/2000/svg">
          <rect width="320" height="180" fill="#1a2332" />
          <rect x="100" y="50" width="120" height="80" rx="4" fill="#243044" stroke="#22c55e" strokeWidth="2" />
          <rect x="130" y="70" width="60" height="30" rx="2" fill="#22c55e" opacity="0.4" stroke="#22c55e" strokeWidth="1" />
          <path d="M150 60 L157 67 L172 52" stroke="#22c55e" strokeWidth="3" fill="none" strokeLinecap="round" />
        </svg>
      )
    case 'batch_decision':
      return (
        <svg viewBox="0 0 320 180" className={base} xmlns="http://www.w3.org/2000/svg">
          <rect width="320" height="180" fill="#1a2332" />
          <circle cx="120" cy="90" r="18" fill="#10b981" opacity="0.5" />
          <circle cx="200" cy="90" r="18" fill="#f59e0b" opacity="0.5" />
          <path d="M138 90 L182 90" stroke="#a855f7" strokeWidth="2" markerEnd="url(#arrow)" />
          <polygon points="182,90 174,86 174,94" fill="#a855f7" />
          <text x="160" y="130" textAnchor="middle" fill="#a855f7" fontSize="11" fontFamily="sans-serif">决策</text>
        </svg>
      )
    case 'return_home':
      return (
        <svg viewBox="0 0 320 180" className={base} xmlns="http://www.w3.org/2000/svg">
          <rect width="320" height="180" fill="#1a2332" />
          <circle cx="160" cy="90" r="35" fill="#6366f1" opacity="0.15" />
          <path d="M160 60 L160 100 M145 75 L160 60 L175 75" stroke="#6366f1" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <text x="160" y="130" textAnchor="middle" fill="#6366f1" fontSize="12" fontFamily="sans-serif">HOME</text>
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 320 180" className={base} xmlns="http://www.w3.org/2000/svg">
          <rect width="320" height="180" fill="#1a2332" />
          <circle cx="160" cy="90" r="20" stroke="#64748b" strokeWidth="2" fill="none" />
        </svg>
      )
  }
}
