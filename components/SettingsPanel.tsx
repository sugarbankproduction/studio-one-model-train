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
  const [pathInput, setPathInput] = useState('')

  async function handleBrowse() {
    setPicking(true)
    try {
      const res = await fetch('/api/pick-folder')
      const data = await res.json()
      if (data.path) {
        setPathInput(data.path)
        onRescan(data.path)
      }
    } finally {
      setPicking(false)
    }
  }

  function handlePathSubmit() {
    const p = pathInput.trim()
    if (p) onRescan(p)
  }

  return (
    <div style={{
      background: 'var(--header)', borderBottom: '1px solid var(--card-border)',
      padding: '14px 24px', display: 'flex', gap: 20, alignItems: 'flex-start',
    }}>
      {/* Folder picker */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 340 }}>
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
              fontSize: 12, padding: '6px 10px', cursor: picking ? 'wait' : 'pointer',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            📁 {picking ? 'Waiting…' : 'Browse'}
          </button>
          <input
            type="text"
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePathSubmit()}
            placeholder={clipsDir || 'Paste or type a folder path…'}
            style={{
              flex: 1, background: 'var(--card)', border: '1px solid var(--card-border)',
              borderRadius: 6, color: 'var(--foreground)', fontSize: 11,
              padding: '6px 10px', fontFamily: 'var(--font-mono)', outline: 'none',
              minWidth: 0,
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent-border)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--card-border)')}
          />
          <button
            onClick={handlePathSubmit}
            disabled={!pathInput.trim()}
            style={{
              background: pathInput.trim() ? 'var(--accent-subtle)' : 'var(--muted)',
              border: `1px solid ${pathInput.trim() ? 'var(--accent-border)' : 'var(--card-border)'}`,
              borderRadius: 6,
              color: pathInput.trim() ? 'var(--accent-light)' : 'var(--muted-fg)',
              fontSize: 12, padding: '6px 10px', cursor: pathInput.trim() ? 'pointer' : 'not-allowed',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            Load ↵
          </button>
        </div>
        {clipsDir && (
          <span style={{ fontSize: 10, color: 'var(--muted-fg)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {clipsDir}
          </span>
        )}
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
