// components/SettingsPanel.tsx
'use client'
import { useAppStore, GEMINI_MODELS } from '@/lib/store'
import { DEFAULT_PROMPT } from '@/lib/gemini'

export default function SettingsPanel() {
  const { model, setModel, instructions, setInstructions } = useAppStore()

  return (
    <div style={{
      background: 'var(--header)', borderBottom: '1px solid var(--card-border)',
      padding: '14px 24px', display: 'flex', gap: 20, alignItems: 'flex-start',
    }}>
      {/* Model selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted-fg)' }}>
          Gemini Model
        </label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          style={{
            background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 6,
            color: 'var(--foreground)', fontSize: 12, padding: '6px 10px', minWidth: 220,
          }}
        >
          {GEMINI_MODELS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <span style={{ fontSize: 10, color: 'var(--muted-fg)' }}>Model used for all captions</span>
      </div>

      {/* Custom instructions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
        <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted-fg)' }}>
          Custom Instructions
        </label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder={DEFAULT_PROMPT}
          rows={3}
          style={{
            background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 6,
            color: 'var(--foreground)', fontSize: 11.5, padding: '7px 10px',
            resize: 'vertical', lineHeight: 1.5, fontFamily: 'inherit',
          }}
        />
        <span style={{ fontSize: 10, color: 'var(--muted-fg)' }}>
          Replaces default prompt when non-empty
        </span>
      </div>
    </div>
  )
}
