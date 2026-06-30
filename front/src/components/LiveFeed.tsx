import { useEffect, useRef, useState } from 'react'
import EventSnapshot from './EventSnapshot'
import {
  Brain,
  CheckCircle2,
  ClipboardList,
  Crosshair,
  GitBranch,
  Hand,
  Home,
  MapPin,
  Package,
  PackageOpen,
  Radio,
  Truck,
} from 'lucide-react'
import type { LiveEvent, LiveEventType } from '../types'

interface LiveFeedProps {
  events: LiveEvent[]
  /** 联调模式：thinking 由 WebSocket delta 推送，不用本地打字机 */
  deltaStream?: boolean
  /** 当前正在流式输出 thinking 的事件 id */
  thinkingLiveId?: string | null
}

const eventIcons: Record<LiveEventType, typeof Radio> = {
  order_received: ClipboardList,
  nav_to_pickup: Truck,
  arrived_pickup: MapPin,
  target_locked: Crosshair,
  grab_success: Hand,
  put_backpack: Package,
  nav_to_delivery: Truck,
  arrived_delivery: MapPin,
  taking_out: PackageOpen,
  put_shelf_success: CheckCircle2,
  batch_decision: GitBranch,
  return_home: Home,
}

const eventColors: Record<LiveEventType, string> = {
  order_received: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/30',
  nav_to_pickup: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  arrived_pickup: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
  target_locked: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  grab_success: 'text-accent bg-accent/10 border-accent/30',
  put_backpack: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
  nav_to_delivery: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  arrived_delivery: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  taking_out: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30',
  put_shelf_success: 'text-green-400 bg-green-400/10 border-green-400/30',
  batch_decision: 'text-violet-400 bg-violet-400/10 border-violet-400/30',
  return_home: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/30',
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function StreamingThinking({
  content,
  streaming,
  deltaStream = false,
}: {
  content: string
  streaming: boolean
  deltaStream?: boolean
}) {
  // 联调模式：后端已逐字推送，直接渲染，避免本地打字机叠加
  if (deltaStream) {
    return (
      <div className="mt-1.5 rounded border border-violet-500/20 bg-violet-500/5 overflow-hidden">
        <div className="flex items-center gap-1 px-2 py-1 border-b border-violet-500/10">
          <Brain className="w-3 h-3 text-violet-400 shrink-0" />
          <span className="text-[10px] text-violet-400 font-medium">Thinking</span>
          {streaming && <span className="ml-auto w-1 h-1 rounded-full bg-violet-400 animate-pulse" />}
        </div>
        <p className="px-2 py-1.5 text-[10px] text-text-dim/90 leading-relaxed max-h-20 overflow-y-auto">
          {content}
          {streaming && (
            <span className="inline-block w-1 h-2.5 ml-0.5 bg-violet-400/80 animate-pulse align-middle" />
          )}
        </p>
      </div>
    )
  }

  return <MockStreamingThinking content={content} streaming={streaming} />
}

function MockStreamingThinking({ content, streaming }: { content: string; streaming: boolean }) {
  const [displayed, setDisplayed] = useState(streaming ? '' : content)
  const [done, setDone] = useState(!streaming)

  useEffect(() => {
    if (!streaming) {
      setDisplayed(content)
      setDone(true)
      return
    }

    setDisplayed('')
    setDone(false)
    const chars = Array.from(content)
    let i = 0

    const timer = setInterval(() => {
      i += 1
      setDisplayed(chars.slice(0, i).join(''))
      if (i >= chars.length) {
        clearInterval(timer)
        setDone(true)
      }
    }, 40)

    return () => clearInterval(timer)
  }, [content, streaming])

  return (
    <div className="mt-1.5 rounded border border-violet-500/20 bg-violet-500/5 overflow-hidden">
      <div className="flex items-center gap-1 px-2 py-1 border-b border-violet-500/10">
        <Brain className="w-3 h-3 text-violet-400 shrink-0" />
        <span className="text-[10px] text-violet-400 font-medium">Thinking</span>
        {!done && <span className="ml-auto w-1 h-1 rounded-full bg-violet-400 animate-pulse" />}
      </div>
      <p className="px-2 py-1.5 text-[10px] text-text-dim/90 leading-relaxed max-h-20 overflow-y-auto">
        {displayed}
        {!done && <span className="inline-block w-1 h-2.5 ml-0.5 bg-violet-400/80 animate-pulse align-middle" />}
      </p>
    </div>
  )
}

function FeedItem({
  event,
  isLatest,
  deltaStream,
  thinkingLiveId,
}: {
  event: LiveEvent
  isLatest: boolean
  deltaStream?: boolean
  thinkingLiveId?: string | null
}) {
  const Icon = eventIcons[event.type]
  const colorClass = eventColors[event.type]

  return (
    <div
      className={`flex gap-2 p-2 rounded-lg border animate-slide-up ${
        isLatest ? 'bg-surface-3 border-accent/40' : 'bg-surface-2 border-border'
      }`}
    >
      <div className="w-20 h-14 shrink-0 rounded overflow-hidden border border-border bg-surface">
        <EventSnapshot type={event.type} activeRoute={event.activeRoute} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border ${colorClass}`}>
            <Icon className="w-2.5 h-2.5" />
            {event.title}
          </span>
          {isLatest && <span className="text-[10px] text-accent font-medium">最新</span>}
          <span className="ml-auto text-[10px] text-text-dim/50 font-mono shrink-0">{formatTime(event.timestamp)}</span>
        </div>
        {event.description && (
          <p className="text-[11px] text-text-dim leading-relaxed">{event.description}</p>
        )}
        {event.thinking && (
          <StreamingThinking
            content={event.thinking}
            streaming={isLatest && event.id === thinkingLiveId}
            deltaStream={deltaStream}
          />
        )}
      </div>
    </div>
  )
}

export default function LiveFeed({ events, deltaStream = false, thinkingLiveId = null }: LiveFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastEvent = events[events.length - 1]

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events.length, lastEvent?.id, lastEvent?.thinking, thinkingLiveId])

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-text-dim uppercase tracking-wider">图文直播</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs text-text-dim">实时</span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        {events.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-text-dim">
            <Radio className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">等待作业事件...</p>
          </div>
        ) : (
          <div className="mt-auto p-3 space-y-2">
            {events.map((event, i) => (
              <FeedItem
                key={event.id}
                event={event}
                isLatest={i === events.length - 1}
                deltaStream={deltaStream}
                thinkingLiveId={thinkingLiveId}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  )
}
