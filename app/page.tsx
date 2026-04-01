// app/page.tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/lib/store'
import Header from '@/components/Header'
import SettingsPanel from '@/components/SettingsPanel'
import ProgressBar from '@/components/ProgressBar'
import Toolbar from '@/components/Toolbar'
import ClipGrid from '@/components/ClipGrid'
import ClipList from '@/components/ClipList'
import ClipModal from '@/components/ClipModal'
import type { ClipMeta, SSEEvent } from '@/types'

export default function Page() {
  const {
    setClips, setClipsDir, updateClip, view, isRunning, setIsRunning,
    apiKey, model, instructions, clips, clipsDir,
  } = useAppStore()

  const [error, setError] = useState<string | null>(null)
  const [currentFile, setCurrentFile] = useState<string | undefined>()
  const abortRef = useRef<AbortController | null>(null)
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([])

  async function loadClips(dir?: string) {
    setError(null)
    const url = dir ? `/api/clips?dir=${encodeURIComponent(dir)}` : '/api/clips'
    try {
      const r = await fetch(url)
      const data = await r.json()
      if ('error' in data) {
        setError(data.error)
      } else {
        setClips(data.clips)
        setClipsDir(data.dir)
      }
    } catch (e) {
      setError(String(e))
    }
  }

  // Load clips on mount (uses CLIPS_DIR from .env.local if set)
  useEffect(() => {
    loadClips()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleStart() {
    // Clear any stale typewriter timeouts from previous run
    timeoutRefs.current.forEach(clearTimeout)
    timeoutRefs.current = []

    setError(null)
    setIsRunning(true)

    const pendingFiles = clips
      .filter((c) => c.status !== 'done')
      .map((c) => c.file)

    if (pendingFiles.length === 0) {
      setIsRunning(false)
      return
    }

    // Reset pending clips
    pendingFiles.forEach((f) => updateClip(f, { status: 'pending', caption: null }))

    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, model, instructions, files: pendingFiles, clipsDir }),
        signal: abortRef.current.signal,
      })

      if (!res.body) {
        setError('No response body from captioning API')
        setIsRunning(false)
        return
      }

      const reader = res.body.getReader()
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
          let event: SSEEvent
          try {
            event = JSON.parse(line.slice(6))
          } catch {
            continue
          }

          if (event.type === 'progress') {
            setCurrentFile(event.file)
            updateClip(event.file, { status: 'captioning', caption: event.caption })
            // Delay so typewriter animation plays, then mark done
            const tid = setTimeout(() => {
              updateClip(event.file, { status: 'done' })
            }, Math.min(event.caption.length * (1000 / 120) + 500, 5000))
            timeoutRefs.current.push(tid)
          } else if (event.type === 'error') {
            updateClip(event.file, { status: 'failed' })
          } else if (event.type === 'done') {
            setCurrentFile(undefined)
            setIsRunning(false)
          }
        }
      }

      // Stream ended cleanly without a 'done' event (e.g. server crash mid-stream)
      setIsRunning(false)
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') {
        setError(`Connection lost: ${String(e)}`)
      }
      setIsRunning(false)
    }
  }

  return (
    <>
      <Header onStart={handleStart} disabled={isRunning} />
      <SettingsPanel onRescan={loadClips} />
      <ProgressBar currentFile={currentFile} />

      {error && (
        <div style={{
          margin: '16px 24px', padding: '12px 16px',
          background: 'var(--danger-subtle)', border: '1px solid var(--card-border)',
          borderRadius: 8, fontSize: 13, color: 'var(--danger-fg)',
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {!clipsDir && !error && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '80px 24px', gap: 12, color: 'var(--muted-fg)',
        }}>
          <div style={{ fontSize: 48 }}>📁</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>No folder selected</div>
          <div style={{ fontSize: 13 }}>Click <strong>Browse</strong> in the settings panel above to choose your clips folder.</div>
        </div>
      )}

      {clipsDir && (
        <>
          <Toolbar />
          {view === 'grid' ? <ClipGrid /> : <ClipList />}
        </>
      )}
      <ClipModal />
    </>
  )
}
