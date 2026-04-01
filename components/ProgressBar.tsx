// components/ProgressBar.tsx
'use client'
import { useAppStore } from '@/lib/store'

interface ProgressBarProps {
  currentFile?: string
}

export default function ProgressBar({ currentFile }: ProgressBarProps) {
  const { doneCounts, model, isRunning } = useAppStore()
  const { done, total } = doneCounts()

  if (!isRunning && done === 0) return null

  const pct = total > 0 ? (done / total) * 100 : 0
  const remaining = total - done
  const secPerClip = 12
  const mins = Math.ceil((remaining * secPerClip) / 60)

  return (
    <div style={{
      background: 'var(--header)', borderBottom: '1px solid var(--card-border)',
      padding: '10px 24px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, color: 'var(--muted-fg)' }}>
        <span>
          <strong style={{ color: 'var(--foreground)' }}>{done}</strong> of {total} clips captioned
        </span>
        <span>
          {model}{currentFile ? ` · ${currentFile}` : ''}{isRunning && remaining > 0 ? ` · ~${mins} min remaining` : ''}
        </span>
      </div>
      <div style={{ height: 4, background: 'var(--muted)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: 'linear-gradient(90deg, var(--accent), var(--accent-light))',
          borderRadius: 99, position: 'relative', overflow: 'hidden',
          transition: 'width 0.4s ease',
        }}>
          {isRunning && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)',
              animation: 'shimmer 1.5s infinite',
            }} />
          )}
        </div>
      </div>
    </div>
  )
}
