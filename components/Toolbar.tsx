// components/Toolbar.tsx
'use client'
import { useAppStore } from '@/lib/store'

export default function Toolbar() {
  const { filter, setFilter, view, setView, doneCounts } = useAppStore()
  const { done, pending, total } = doneCounts()

  const filters = [
    { key: 'all' as const,     label: `All (${total})` },
    { key: 'done' as const,    label: `✓ Done (${done})` },
    { key: 'pending' as const, label: `⟳ Pending (${pending})` },
  ]

  return (
    <div style={{
      padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 8,
      borderBottom: '1px solid var(--muted)',
    }}>
      <span style={{ fontSize: 12, color: 'var(--muted-fg)' }}>Show:</span>
      {filters.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => setFilter(key)}
          style={{
            background: filter === key ? 'var(--accent-subtle)' : 'var(--card)',
            border: `1px solid ${filter === key ? 'var(--accent-border)' : 'var(--card-border)'}`,
            borderRadius: 5,
            color: filter === key ? 'var(--accent-light)' : 'var(--foreground)',
            fontSize: 11, padding: '4px 10px', cursor: 'pointer', fontWeight: 500,
          }}
        >
          {label}
        </button>
      ))}

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
        {(['grid', 'list'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            title={v === 'grid' ? 'Grid view' : 'List view'}
            style={{
              background: view === v ? 'var(--accent-subtle)' : 'var(--card)',
              border: `1px solid ${view === v ? 'var(--accent-border)' : 'var(--card-border)'}`,
              borderRadius: 5,
              color: view === v ? 'var(--accent-light)' : 'var(--muted-fg)',
              fontSize: 14, padding: '4px 9px', cursor: 'pointer',
            }}
          >
            {v === 'grid' ? '⊞' : '☰'}
          </button>
        ))}
      </div>
    </div>
  )
}
