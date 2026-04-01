// components/ClipModal.tsx
'use client'
import { useEffect, useRef } from 'react'
import { useAppStore } from '@/lib/store'
import StatusBadge from './StatusBadge'

export default function ClipModal() {
  const { modalClip, setModalClip, clips, clipsDir } = useAppStore()
  const videoRef = useRef<HTMLVideoElement>(null)

  const clip = clips.find((c) => c.file === modalClip)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalClip(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setModalClip])

  // Pause video when modal closes
  useEffect(() => {
    if (!modalClip && videoRef.current) videoRef.current.pause()
  }, [modalClip])

  if (!modalClip || !clip) return null

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) setModalClip(null) }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100, padding: 24,
      }}
    >
      <div style={{
        background: 'oklch(0.15 0 0)', border: '1px solid var(--card-border)',
        borderRadius: 12, width: '100%', maxWidth: 900, overflow: 'hidden',
        boxShadow: '0 0 60px -10px #6366f1aa',
      }}>
        {/* Video */}
        <div style={{ aspectRatio: '16/9', background: '#000', position: 'relative' }}>
          <video
            ref={videoRef}
            src={`/api/video/${encodeURIComponent(clip.file)}?dir=${encodeURIComponent(clipsDir)}`}
            controls
            autoPlay
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
          <button
            onClick={() => setModalClip(null)}
            style={{
              position: 'absolute', top: 12, right: 12,
              background: 'rgba(0,0,0,0.6)', border: '1px solid var(--card-border)',
              borderRadius: 6, color: 'var(--muted-fg)', fontSize: 14,
              padding: '4px 10px', cursor: 'pointer', backdropFilter: 'blur(4px)',
            }}
          >
            ✕ Close
          </button>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--muted-fg)' }}>
              {clip.file}
            </span>
            <StatusBadge status={clip.status} style={{ position: 'static' }} />
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--muted-fg)' }}>
              {clip.duration.toFixed(2)}s · {clip.fps}fps · {clip.resolution}
            </span>
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.65, color: 'oklch(0.82 0 0)' }}>
            {clip.caption ?? '—'}
          </p>
        </div>
      </div>
    </div>
  )
}
