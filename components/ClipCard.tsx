// components/ClipCard.tsx
'use client'
import { useAppStore } from '@/lib/store'
import { useTypewriter } from '@/hooks/useTypewriter'
import StatusBadge from './StatusBadge'
import type { ClipMeta } from '@/types'

export default function ClipCard({ clip }: { clip: ClipMeta }) {
  const setModalClip = useAppStore((s) => s.setModalClip)
  const isTyping = clip.status === 'captioning'
  const typed = useTypewriter(isTyping ? clip.caption : null)
  const displayCaption = clip.status === 'done' ? clip.caption : typed

  return (
    <div
      style={{
        background: 'var(--card)', border: '1px solid var(--card-border)',
        borderRadius: 10, overflow: 'hidden', transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#6366f166'
        e.currentTarget.style.boxShadow = '0 0 24px -4px #6366f1aa'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--card-border)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Thumbnail */}
      <div
        style={{ aspectRatio: '16/9', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
        onClick={() => setModalClip(clip.file)}
      >
        <video
          src={`/api/video/${encodeURIComponent(clip.file)}`}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          preload="metadata"
          muted
        />
        {/* Hover overlay */}
        <div className="play-overlay" style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: 0, transition: 'opacity 0.2s',
        }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
        >
          <div style={{
            width: 48, height: 48, background: 'rgba(99,102,241,0.9)', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, paddingLeft: 3, color: '#fff',
          }}>▶</div>
        </div>
        {/* Gradient overlay */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 50%)',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          padding: '10px 12px',
        }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
            {clip.file}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            {clip.duration.toFixed(2)}s · {clip.fps}fps · {clip.resolution}
          </div>
        </div>
        {/* Status badge */}
        <StatusBadge status={clip.status} style={{ position: 'absolute', top: 10, right: 10 }} />
      </div>

      {/* Caption area */}
      <div style={{ padding: '12px 14px', minHeight: 64, borderTop: '1px solid var(--muted)' }}>
        {clip.status === 'pending' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[100, 100, 60].map((w, i) => (
              <div key={i} style={{ height: 8, borderRadius: 4, background: 'var(--muted)', width: `${w}%` }} />
            ))}
          </div>
        )}
        {(clip.status === 'captioning' || clip.status === 'done' || clip.status === 'failed') && (
          <p style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--muted-fg)' }}>
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
