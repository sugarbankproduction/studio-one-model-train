// components/SettingsPanel.tsx
'use client'
import { useState } from 'react'
import { useAppStore, GEMINI_MODELS } from '@/lib/store'
import { DEFAULT_PROMPT } from '@/lib/prompts'

interface SettingsPanelProps {
  onRescan: (dir: string) => void
}

export default function SettingsPanel({ onRescan }: SettingsPanelProps) {
  const { model, setModel, instructions, setInstructions, clipsDir } = useAppStore()
  const [picking, setPicking] = useState(false)

  async function handleBrowse() {
    setPicking(true)
    try {
      const res = await fetch('/api/pick-folder')
      const data = await res.json()
      if (data.path) {
        onRescan(data.path)
      }
    } finally {
      setPicking(false)
    }
  }

  return (
    <div style={{
      background: 'var(--header)', borderBottom: '1px solid var(--card-border)',
      padding: '14px 24px', display: 'flex', gap: 20, alignItems: 'flex-start',
    }}>
      {/* Folder picker */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted-fg)' }}>
          Clips Folder
        </label>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={handleBrowse}
            disabled={picking}
            style={{
              background: picking ? 'var(--muted)' : 'var(--card)',
              border: '1px solid var(--card-border)', borderRadius: 6,
              color: picking ? 'var(--muted-fg)' : 'var(--foreground)',
              fontSize: 12, padding: '6px 12px', cursor: picking ? 'wait' : 'pointer',
              whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            📁 {picking ? 'Waiting…' : 'Browse'}
          </button>
          <span style={{
            fontSize: 11, color: 'var(--muted-fg)', fontFamily: 'var(--font-mono)',
            maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {clipsDir || 'No folder selected'}
          </span>
        </div>
      </div>

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
