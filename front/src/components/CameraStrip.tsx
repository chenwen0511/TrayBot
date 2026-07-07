import { Maximize2, VideoOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { CameraStream } from '../types'

interface CameraStripProps {
  cameras: CameraStream[]
}

function tryPlay(video: HTMLVideoElement | null) {
  if (!video) return
  video.play().catch(() => {
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
      <div className="relative group rounded-md overflow-hidden bg-black border border-border aspect-[4/3]">
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
          <div className="flex flex-col items-center justify-center h-full bg-surface-3 min-h-[60px]">
            <VideoOff className="w-5 h-5 text-text-dim mb-1" />
            <span className="text-[10px] text-text-dim">{error ? '加载失败' : '信号中断'}</span>
          </div>
        )}

        <div className="absolute inset-x-0 top-0 px-2 py-1 bg-gradient-to-b from-black/75 to-transparent">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-medium text-white truncate">{camera.label}</span>
            {camera.online && !error && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="absolute bottom-1 right-1 p-0.5 rounded bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Maximize2 className="w-3 h-3 text-white/80" />
        </button>
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setExpanded(false)}
        >
          <div className="relative w-[90vw] max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <video src={camera.src} autoPlay loop muted playsInline className="w-full rounded-lg" />
            <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-black/60 text-sm text-white">
              {camera.label}
            </div>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-black/60 text-sm hover:bg-black/80"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </>
  )
}

/** 左侧栏纵向相机（紧凑排列） */
export default function CameraStrip({ cameras }: CameraStripProps) {
  return (
    <div className="space-y-1.5">
      {cameras.map((camera) => (
        <CameraTile key={camera.id} camera={camera} />
      ))}
    </div>
  )
}
