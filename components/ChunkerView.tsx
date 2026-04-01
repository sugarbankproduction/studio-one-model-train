// components/ChunkerView.tsx
'use client'
import { useRef, useState, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import type { ChunkSource, ChunkSSEEvent } from '@/types'

type ChunkResult = { file: string; status: 'ok' | 'error'; message?: string }

export default function ChunkerView() {
  const { chunkSources, setChunkSources, chunkSettings, setChunkSettings } = useAppStore()

  const [isDragging, setIsDragging]   = useState(false)
  const [isRunning, setIsRunning]     = useState(false)
  const [results, setResults]         = useState<ChunkResult[]>([])
  const [progress, setProgress]       = useState<{ index: number; total: number } | null>(null)
  const [error, setError]             = useState<string | null>(null)
  const [inputMode, setInputMode]     = useState<'xml' | 'folder'>('xml')

  const abortRef = useRef<AbortController | null>(null)

  // ── XML drag/drop ────────────────────────────────────────────────────────
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    setError(null)

    const file = e.dataTransfer.files[0]
    if (!file) return
    if (!file.name.endsWith('.xml')) {
      setError('Please drop a Premiere Pro FCP XML file (.xml)')
      return
    }

    const xmlContent = await file.text()
    try {
      const res = await fetch('/api/parse-xml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xmlContent }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setChunkSources(data.sources)
      setResults([])
      setProgress(null)
    } catch (err) {
      setError(String(err))
    }
  }, [setChunkSources])

  // ── Folder browse ────────────────────────────────────────────────────────
  async function handleBrowseFolder() {
    setError(null)
    const res = await fetch('/api/pick-folder')
    const data = await res.json()
    if (data.cancelled || !data.path) return

    // Scan for all .mp4 files in folder
    const clipsRes = await fetch(`/api/clips?dir=${encodeURIComponent(data.path)}`)
    const clipsData = await clipsRes.json()
    if (clipsData.error) { setError(clipsData.error); return }

    const sources: ChunkSource[] = clipsData.clips.map((c: { file: string; duration: number }) => ({
      sourceFile: `${data.path}\\${c.file}`,
      inSec: 0,
      outSec: c.duration,
      label: c.file,
    }))
    setChunkSources(sources)
    setResults([])
    setProgress(null)
  }

  // ── Output folder browse ──────────────────────────────────────────────────
  async function handleBrowseOutput() {
    const res = await fetch('/api/pick-folder')
    const data = await res.json()
    if (!data.cancelled && data.path) setChunkSettings({ outputDir: data.path })
  }

  // ── Estimate total chunks ─────────────────────────────────────────────────
  function estimateChunks(src: ChunkSource) {
    const dur = src.outSec - src.inSec
    return Math.floor((dur * chunkSettings.fps) / chunkSettings.framesPerChunk)
  }
  const totalChunks = chunkSources.reduce((n, s) => n + estimateChunks(s), 0)

  // ── Remove a source ───────────────────────────────────────────────────────
  function removeSource(idx: number) {
    setChunkSources(chunkSources.filter((_, i) => i !== idx))
  }

  // ── Start chunking ────────────────────────────────────────────────────────
  async function handleStart() {
    if (!chunkSettings.outputDir) { setError('Please set an output folder first.'); return }
    if (!chunkSources.length)     { setError('No source clips loaded.'); return }

    setIsRunning(true)
    setError(null)
    setResults([])
    setProgress(null)

    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/chunk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sources: chunkSources, settings: chunkSettings }),
        signal: abortRef.current.signal,
      })

      if (!res.body) { setError('No response body'); setIsRunning(false); return }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          let event: ChunkSSEEvent
          try { event = JSON.parse(line.slice(6)) } catch { continue }

          if (event.type === 'chunk-progress') {
            setProgress({ index: event.index, total: event.total })
            setResults((prev) => [...prev, { file: event.file, status: 'ok' }])
          } else if (event.type === 'chunk-error') {
            setResults((prev) => [...prev, { file: event.file, status: 'error', message: event.message }])
          } else if (event.type === 'chunk-done') {
            setIsRunning(false)
          }
        }
      }
      setIsRunning(false)
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') setError(`Error: ${String(e)}`)
      setIsRunning(false)
    }
  }

  function handleStop() {
    abortRef.current?.abort()
    setIsRunning(false)
  }

  const canStart = !isRunning && chunkSources.length > 0 && !!chunkSettings.outputDir

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Input mode toggle ── */}
      <div style={{ display: 'flex', gap: 8 }}>
        {(['xml', 'folder'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setInputMode(mode)}
            style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
              background: inputMode === mode ? 'var(--accent-subtle)' : 'var(--card)',
              border: `1px solid ${inputMode === mode ? 'var(--accent-border)' : 'var(--card-border)'}`,
              color: inputMode === mode ? 'var(--accent-light)' : 'var(--muted-fg)',
            }}
          >
            {mode === 'xml' ? '📄 Premiere XML' : '📁 Folder of Videos'}
          </button>
        ))}
      </div>

      {/* ── XML drop zone ── */}
      {inputMode === 'xml' && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          style={{
            border: `2px dashed ${isDragging ? 'var(--accent)' : 'var(--card-border)'}`,
            borderRadius: 10, padding: '40px 24px', textAlign: 'center',
            background: isDragging ? 'var(--accent-subtle)' : 'var(--card)',
            transition: 'all 0.15s', cursor: 'default',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 10 }}>📄</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', marginBottom: 6 }}>
            Drop Premiere Pro FCP XML here
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted-fg)' }}>
            File → Export → Final Cut Pro XML… in Premiere Pro
          </div>
        </div>
      )}

      {/* ── Folder browse ── */}
      {inputMode === 'folder' && (
        <button
          onClick={handleBrowseFolder}
          style={{
            padding: '40px 24px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
            background: 'var(--card)', border: '2px dashed var(--card-border)',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 10 }}>📁</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', marginBottom: 6 }}>
            Browse for folder of videos
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted-fg)' }}>
            All .mp4 files will be chunked end-to-end
          </div>
        </button>
      )}

      {/* ── Error ── */}
      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, fontSize: 13,
          background: 'var(--danger-subtle)', border: '1px solid var(--card-border)',
          color: 'var(--danger-fg)',
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* ── Settings row ── */}
      <div style={{
        display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end',
        padding: '16px 18px', background: 'var(--card)',
        border: '1px solid var(--card-border)', borderRadius: 10,
      }}>
        {/* Width */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Width</span>
          <input
            type="number" value={chunkSettings.width} min={1}
            onChange={(e) => setChunkSettings({ width: Number(e.target.value) })}
            style={numInputStyle}
          />
        </label>
        {/* Height */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Height</span>
          <input
            type="number" value={chunkSettings.height} min={1}
            onChange={(e) => setChunkSettings({ height: Number(e.target.value) })}
            style={numInputStyle}
          />
        </label>
        {/* Frames per chunk */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Frames / Chunk</span>
          <input
            type="number" value={chunkSettings.framesPerChunk} min={1}
            onChange={(e) => setChunkSettings({ framesPerChunk: Number(e.target.value) })}
            style={numInputStyle}
          />
        </label>
        {/* FPS */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>FPS</span>
          <input
            type="number" value={chunkSettings.fps} min={1}
            onChange={(e) => setChunkSettings({ fps: Number(e.target.value) })}
            style={{ ...numInputStyle, width: 64 }}
          />
        </label>
        {/* Output dir */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 200 }}>
          <span style={{ fontSize: 11, color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Output Folder</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text" value={chunkSettings.outputDir} placeholder="E:\path\to\output"
              onChange={(e) => setChunkSettings({ outputDir: e.target.value })}
              style={{
                flex: 1, background: 'oklch(0.12 0 0)', border: '1px solid var(--card-border)',
                borderRadius: 6, padding: '6px 10px', fontSize: 12,
                color: 'var(--foreground)', fontFamily: 'var(--font-mono)',
              }}
            />
            <button onClick={handleBrowseOutput} style={browseBtnStyle}>Browse</button>
          </div>
        </label>
      </div>

      {/* ── Source list ── */}
      {chunkSources.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--muted-fg)' }}>
              {chunkSources.length} source{chunkSources.length !== 1 ? 's' : ''} → ~{totalChunks} chunks
            </span>
            <button
              onClick={() => { setChunkSources([]); setResults([]); setProgress(null) }}
              style={{ fontSize: 11, color: 'var(--muted-fg)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Clear all
            </button>
          </div>
          <div style={{
            border: '1px solid var(--card-border)', borderRadius: 8,
            overflow: 'hidden', maxHeight: 260, overflowY: 'auto',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--card)', borderBottom: '1px solid var(--card-border)' }}>
                  {['Label', 'Source File', 'In', 'Out', 'Est. Chunks', ''].map((h) => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--muted-fg)', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chunkSources.map((src, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--muted)' }}>
                    <td style={{ padding: '7px 12px', color: 'var(--foreground)' }}>{src.label}</td>
                    <td style={{ padding: '7px 12px', color: 'var(--muted-fg)', fontFamily: 'var(--font-mono)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {src.sourceFile.split('\\').pop()}
                    </td>
                    <td style={{ padding: '7px 12px', color: 'var(--muted-fg)' }}>{src.inSec.toFixed(2)}s</td>
                    <td style={{ padding: '7px 12px', color: 'var(--muted-fg)' }}>{src.outSec.toFixed(2)}s</td>
                    <td style={{ padding: '7px 12px', color: 'var(--accent-light)', fontWeight: 600 }}>{estimateChunks(src)}</td>
                    <td style={{ padding: '7px 12px' }}>
                      <button onClick={() => removeSource(i)} style={{ fontSize: 11, color: 'var(--muted-fg)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Start / Stop ── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          onClick={handleStart}
          disabled={!canStart}
          style={{
            padding: '10px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: canStart ? 'pointer' : 'not-allowed',
            background: canStart ? 'var(--accent)' : 'var(--muted)',
            color: canStart ? '#fff' : 'var(--muted-fg)',
            border: 'none', transition: 'background 0.15s',
          }}
        >
          {isRunning ? `Chunking… (${progress?.index ?? 0}/${progress?.total ?? totalChunks})` : `Start Chunking${totalChunks > 0 ? ` (${totalChunks})` : ''}`}
        </button>

        {isRunning && (
          <button onClick={handleStop} style={{ padding: '10px 18px', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: 'var(--danger-subtle)', color: 'var(--danger-fg)', border: '1px solid var(--card-border)' }}>
            Stop
          </button>
        )}

        {!isRunning && results.length > 0 && (
          <span style={{ fontSize: 12, color: 'var(--success-fg)' }}>
            ✓ {results.filter((r) => r.status === 'ok').length} chunks written
            {results.filter((r) => r.status === 'error').length > 0 && (
              <span style={{ color: 'var(--danger-fg)', marginLeft: 8 }}>
                {results.filter((r) => r.status === 'error').length} errors
              </span>
            )}
          </span>
        )}
      </div>

      {/* ── Progress log ── */}
      {results.length > 0 && (
        <div style={{
          background: 'oklch(0.10 0 0)', border: '1px solid var(--card-border)',
          borderRadius: 8, padding: '12px 16px', maxHeight: 240, overflowY: 'auto',
          fontFamily: 'var(--font-mono)', fontSize: 11,
        }}>
          {results.map((r, i) => (
            <div key={i} style={{ color: r.status === 'ok' ? 'var(--success-fg)' : 'var(--danger-fg)', lineHeight: 1.7 }}>
              {r.status === 'ok' ? '✓' : '✗'} {r.file}{r.message ? ` — ${r.message}` : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const numInputStyle: React.CSSProperties = {
  width: 80, background: 'oklch(0.12 0 0)',
  border: '1px solid var(--card-border)', borderRadius: 6,
  padding: '6px 10px', fontSize: 12, color: 'var(--foreground)',
  fontFamily: 'var(--font-mono)',
}

const browseBtnStyle: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
  background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)',
  color: 'var(--accent-light)', whiteSpace: 'nowrap',
}
