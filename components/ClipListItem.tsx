// components/ClipListItem.tsx
'use client'
import { useAppStore } from '@/lib/store'
import { useTypewriter } from '@/hooks/useTypewriter'
import StatusBadge from './StatusBadge'
import type { ClipMeta } from '@/types'

export default function ClipListItem({ clip }: { clip: ClipMeta }) {
  const setModalClip = useAppStore((s) => s.setModalClip)
  const isTyping = clip.status === 'captioning'
  const typed = useTypewriter(isTyping ? clip.caption : null)
  const displayCaption = clip.status === 'done' ? clip.caption : typed

  return (
    <div
      style={{
        background: 'var(--card)', border: '1px solid var(--card-border)',
        borderRadius: 8, display: 'flex', overflow: 'hidden',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#6366f166'
        e.currentTarget.style.boxShadow = '0 0 20px -6px #6366f1aa'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--card-border)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Thumbnail */}
      <div
        style={{ width: 240, minWidth: 240, position: 'relative', cursor: 'pointer', aspectRatio: '16/9' }}
        onClick={() => setModalClip(clip.file)}
      >
        <video
          src={`/api/video/${encodeURIComponent(clip.file)}`}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          preload="metadata"
          muted
        />
        <StatusBadge status={clip.status} style={{ position: 'absolute', top: 8, right: 8 }} />
      </div>

      {/* Content */}
      <div style={{
        flex: 1, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 6,
        borderLeft: '1px solid var(--muted)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--foreground)', fontWeight: 500 }}>
            {clip.file}
          </span>
          <span style={{ fontSize: 10, color: 'var(--muted-fg)', marginLeft: 'auto' }}>
            {clip.duration.toFixed(2)}s · {clip.fps}fps · {clip.resolution}
          </span>
        </div>

        {clip.status === 'pending' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
            {[100, 60].map((w, i) => (
              <div key={i} style={{ height: 8, borderRadius: 4, background: 'var(--muted)', width: `${w}%` }} />
            ))}
          </div>
        )}
        {(clip.status === 'captioning' || clip.status === 'done' || clip.status === 'failed') && (
          <p style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--muted-fg)', flex: 1 }}>
            {displayCaption}
            {clip.status === 'captioning' && (
              <span style={{ animation: 'blink 0.8s step-end infinite', color: 'var(--accent)' }}>▋</span>
            )}
          </p>
        )}
      </div>
    </div>
  )
}
