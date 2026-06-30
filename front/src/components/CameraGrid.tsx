import { Maximize2, Video, VideoOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { CameraStream } from '../types'

interface CameraGridProps {
  cameras: CameraStream[]
}

function tryPlay(video: HTMLVideoElement | null) {
  if (!video) return
  video.play().catch(() => {
    // 浏览器自动播放策略拦截时，静音后重试
    video.muted = true
    video.play().catch(() => {})
  })
}

function CameraTile({ camera }: { camera: CameraStream }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    tryPlay(videoRef.current)
  }, [camera.src])

  return (
    <>
      <div className="relative group rounded-lg overflow-hidden bg-black border border-border aspect-video">
        {camera.online && !error ? (
          <video
            ref={videoRef}
            src={camera.src}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className="w-full h-full object-cover"
            onLoadedData={() => tryPlay(videoRef.current)}
            onCanPlay={() => tryPlay(videoRef.current)}
            onError={() => setError(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full bg-surface-3">
            <VideoOff className="w-8 h-8 text-text-dim mb-2" />
            <span className="text-xs text-text-dim">{error ? '视频加载失败' : '信号中断'}</span>
          </div>
        )}

        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-3 py-2 bg-gradient-to-b from-black/70 to-transparent">
          <div className="flex items-center gap-2">
            <Video className="w-3.5 h-3.5 text-accent" />
            <span className="text-xs font-medium">{camera.label}</span>
          </div>
          {camera.online && !error && (
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs text-white/80">LIVE</span>
            </div>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-3 py-2 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-xs text-white/70">
            {camera.resolution} · {camera.fps}fps
          </span>
          <button
            onClick={() => setExpanded(true)}
            className="p-1 rounded hover:bg-white/10 transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5 text-white/80" />
          </button>
        </div>
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setExpanded(false)}
        >
          <div className="relative w-[90vw] max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <video
              src={camera.src}
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              className="w-full rounded-lg"
            />
            <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm">{camera.label}</span>
            </div>
            <button
              onClick={() => setExpanded(false)}
              className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-black/60 text-sm hover:bg-black/80 transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default function CameraGrid({ cameras }: CameraGridProps) {
  return (
    <div>
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-dim uppercase tracking-wider">摄像头直播</h2>
        <span className="text-xs text-text-dim">{cameras.filter((c) => c.online).length}/{cameras.length} 在线</span>
      </div>
      <div className="p-3 grid grid-cols-3 gap-2">
        {cameras.map((camera) => (
          <CameraTile key={camera.id} camera={camera} />
        ))}
      </div>
    </div>
  )
}
