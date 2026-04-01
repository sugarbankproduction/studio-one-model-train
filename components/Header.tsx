// components/Header.tsx
'use client'
import { useAppStore, GEMINI_MODELS } from '@/lib/store'

interface HeaderProps {
  onStart: () => void
  disabled: boolean
}

export default function Header({ onStart, disabled }: HeaderProps) {
  const { apiKey, setApiKey, isRunning, clips } = useAppStore()
  const canStart = !!apiKey && clips.length > 0 && !isRunning

  return (
    <header style={{
      background: 'var(--header)',
      borderBottom: '1px solid var(--card-border)',
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    }}>
      <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
        Studio<span style={{ color: 'var(--muted-fg)', fontWeight: 400 }}>.</span>
        <span style={{ color: 'var(--accent)' }}>One</span>{' '}
        <span style={{ color: 'var(--muted-fg)', fontWeight: 400 }}>Model Train</span>
      </div>

      <span style={{
        fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
        padding: '2px 8px', borderRadius: 4,
        background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--accent-border)',
      }}>Caption</span>

      <div style={{ flex: 1 }} />

      <input
        type="password"
        placeholder="Gemini API Key"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        style={{
          background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 6,
          color: 'var(--foreground)', fontSize: 12, padding: '6px 10px', width: 220,
          outline: 'none', fontFamily: 'var(--font-mono)',
        }}
      />

      <button
        onClick={onStart}
        disabled={!canStart || disabled}
        style={{
          background: canStart ? 'var(--accent)' : 'var(--muted)',
          color: canStart ? 'var(--accent-fg)' : 'var(--muted-fg)',
          border: 'none', borderRadius: 6, padding: '7px 16px',
          fontSize: 13, fontWeight: 600, cursor: canStart ? 'pointer' : 'not-allowed',
          whiteSpace: 'nowrap', transition: 'background 0.2s',
        }}
      >
        {isRunning ? '⟳ Running…' : '▶ Start Captioning'}
      </button>
    </header>
  )
}
