// components/TabBar.tsx
'use client'
import { useAppStore } from '@/lib/store'

export default function TabBar() {
  const { activeTab, setActiveTab } = useAppStore()

  const tabs: { id: 'caption' | 'chunker'; label: string; icon: string }[] = [
    { id: 'caption', label: 'Captioner', icon: '✦' },
    { id: 'chunker', label: 'Chunker',   icon: '✂' },
  ]

  return (
    <div style={{
      display: 'flex', gap: 4, padding: '0 24px',
      borderBottom: '1px solid var(--card-border)',
      background: 'var(--header)',
    }}>
      {tabs.map((tab) => {
        const active = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 16px',
              fontSize: 13, fontWeight: active ? 600 : 400,
              color: active ? 'var(--accent-light)' : 'var(--muted-fg)',
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1,
              transition: 'color 0.15s',
            }}
          >
            <span style={{ fontSize: 11 }}>{tab.icon}</span>
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
