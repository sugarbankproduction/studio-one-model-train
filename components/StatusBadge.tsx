import type { ClipStatus } from '@/types'

const styles: Record<ClipStatus, React.CSSProperties> = {
  pending: {
    background: 'var(--muted)', color: 'var(--muted-fg)',
    border: '1px solid var(--card-border)',
  },
  captioning: {
    background: 'var(--warning-subtle)', color: 'var(--warning-fg)',
    border: '1px solid var(--warning-border)',
    animation: 'pulse-glow 1.5s ease-in-out infinite',
  },
  done: {
    background: 'var(--success-subtle)', color: 'var(--success-fg)',
    border: '1px solid var(--success-border)',
  },
  failed: {
    background: 'var(--danger-subtle)', color: 'var(--danger-fg)',
    border: '1px solid var(--card-border)',
  },
}

const labels: Record<ClipStatus, string> = {
  pending: 'Pending',
  captioning: '⟳ Captioning',
  done: '✓ Done',
  failed: '✗ Failed',
}

export default function StatusBadge({
  status,
  style,
}: {
  status: ClipStatus
  style?: React.CSSProperties
}) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
      padding: '3px 7px', borderRadius: 4, backdropFilter: 'blur(4px)',
      ...styles[status],
      ...style,
    }}>
      {labels[status]}
    </span>
  )
}
