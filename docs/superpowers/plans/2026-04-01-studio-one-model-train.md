# Studio.One Model Train — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Next.js web app that scans a directory of `.mp4` training clips, displays them in a styled grid/list, and runs Gemini Flash captioning with real-time SSE progress — captions animate in under each clip as they arrive.

**Architecture:** Next.js App Router with three API routes (clips scan, video stream, SSE captioning). Zustand manages all client state. Captioning uses `@google/genai` JS SDK, writing `.txt` sidecars and `captions.jsonl` to the clips directory on completion.

**Tech Stack:** Next.js 15 · TypeScript · Tailwind CSS 4 · shadcn/ui · `@google/genai` · Zustand · Vitest

---

## File Map

```
studio-one-model-train/
├── app/
│   ├── layout.tsx                       # Dark root layout, Inter font, .dark class on <html>
│   ├── globals.css                      # Tailwind v4 import, CSS vars (dark theme)
│   ├── page.tsx                         # Main page: fetches clips, wires SSE, renders shell
│   └── api/
│       ├── clips/route.ts               # GET — scan CLIPS_DIR, return ClipMeta[]
│       ├── video/[filename]/route.ts    # GET — stream video with Accept-Ranges
│       └── caption/route.ts            # POST — SSE captioning stream
├── components/
│   ├── Header.tsx                       # Title, API key input, Start button
│   ├── SettingsPanel.tsx                # Model selector + custom instructions textarea
│   ├── ProgressBar.tsx                  # Progress fill + metadata text
│   ├── Toolbar.tsx                      # Filter buttons + grid/list toggle
│   ├── ClipCard.tsx                     # Single clip card (grid mode)
│   ├── ClipListItem.tsx                 # Single clip row (list mode)
│   ├── ClipGrid.tsx                     # Grid wrapper rendering ClipCard[]
│   ├── ClipList.tsx                     # List wrapper rendering ClipListItem[]
│   └── ClipModal.tsx                    # Fullscreen video + caption overlay
├── hooks/
│   └── useTypewriter.ts                 # Typewriter animation hook
├── lib/
│   ├── clips.ts                         # Scan dir, read sidecars, ffprobe metadata
│   ├── gemini.ts                        # Upload / caption / delete via @google/genai
│   └── store.ts                         # Zustand store (all client state + actions)
├── types/
│   └── index.ts                         # ClipMeta, ClipStatus, SSEEvent, AppState
├── tests/
│   ├── lib/clips.test.ts
│   └── lib/store.test.ts
├── .env.example
├── .env.local                           # gitignored
├── postcss.config.mjs
└── vitest.config.ts
```

---

## Task 1: Scaffold Next.js project and install dependencies

**Files:**
- Create: all scaffolded files
- Create: `postcss.config.mjs`
- Create: `vitest.config.ts`
- Create: `.env.example`

- [ ] **Step 1: Scaffold into existing directory**

Run from `E:/SUGARBANK_DEV/studio-one-model-train/`:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm
```
When prompted about existing files — select **Yes** to continue.

- [ ] **Step 2: Upgrade to Tailwind CSS v4**

```bash
npm install tailwindcss@^4 @tailwindcss/postcss
npm uninstall tailwind-merge  # remove if installed by scaffold
```

- [ ] **Step 3: Replace postcss.config.mjs**

```js
// postcss.config.mjs
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
export default config
```

- [ ] **Step 4: Install app dependencies**

```bash
npm install zustand @google/genai
```

- [ ] **Step 5: Install dev/test dependencies**

```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 6: Create vitest.config.ts**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

- [ ] **Step 7: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 8: Create .env.example**

```
# .env.example
CLIPS_DIR=E:\WS_2026\WS_CUSTOM_MODEL_TRAINING\TRAINING\CHUNKS
```

- [ ] **Step 9: Create .env.local with actual path**

```
# .env.local  (gitignored)
CLIPS_DIR=E:\WS_2026\WS_CUSTOM_MODEL_TRAINING\TRAINING\CHUNKS
```

- [ ] **Step 10: Verify .gitignore has .env.local**

Check that `.gitignore` contains `.env.local` (create-next-app adds this). If not, add it.

- [ ] **Step 11: Commit scaffold**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with Tailwind v4, Zustand, Gemini SDK"
```

---

## Task 2: Types

**Files:**
- Create: `types/index.ts`

- [ ] **Step 1: Write types**

```ts
// types/index.ts

export type ClipStatus = 'pending' | 'captioning' | 'done' | 'failed'

export interface ClipMeta {
  file: string          // filename only, e.g. "clip_001_941_000.mp4"
  duration: number      // seconds
  fps: number
  resolution: string    // e.g. "960×575"
  caption: string | null
  status: ClipStatus
}

export interface SSEProgressEvent {
  type: 'progress'
  file: string
  caption: string
  index: number
  total: number
}

export interface SSEErrorEvent {
  type: 'error'
  file: string
  message: string
}

export interface SSEDoneEvent {
  type: 'done'
  total: number
}

export type SSEEvent = SSEProgressEvent | SSEErrorEvent | SSEDoneEvent

export interface CaptionRequest {
  apiKey: string
  model: string
  instructions: string
  files: string[]   // filenames to caption (server skips already-done ones)
}
```

- [ ] **Step 2: Commit**

```bash
git add types/index.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 3: Zustand store

**Files:**
- Create: `lib/store.ts`
- Create: `tests/lib/store.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/lib/store.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '@/lib/store'
import type { ClipMeta } from '@/types'

const makeClip = (file: string): ClipMeta => ({
  file,
  duration: 5,
  fps: 24,
  resolution: '960×575',
  caption: null,
  status: 'pending',
})

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      clips: [],
      isRunning: false,
      view: 'grid',
      filter: 'all',
      apiKey: '',
      model: 'gemini-3-flash-preview',
      instructions: '',
      modalClip: null,
    })
  })

  it('setClips replaces clip list', () => {
    const clips = [makeClip('a.mp4'), makeClip('b.mp4')]
    useAppStore.getState().setClips(clips)
    expect(useAppStore.getState().clips).toHaveLength(2)
  })

  it('updateClip updates a single clip by filename', () => {
    useAppStore.setState({ clips: [makeClip('a.mp4')] })
    useAppStore.getState().updateClip('a.mp4', { status: 'done', caption: 'hello' })
    const clip = useAppStore.getState().clips[0]
    expect(clip.status).toBe('done')
    expect(clip.caption).toBe('hello')
  })

  it('updateClip ignores unknown filenames', () => {
    useAppStore.setState({ clips: [makeClip('a.mp4')] })
    useAppStore.getState().updateClip('nope.mp4', { status: 'done' })
    expect(useAppStore.getState().clips[0].status).toBe('pending')
  })

  it('filteredClips returns all clips when filter is "all"', () => {
    useAppStore.setState({
      clips: [makeClip('a.mp4'), { ...makeClip('b.mp4'), status: 'done', caption: 'x' }],
      filter: 'all',
    })
    expect(useAppStore.getState().filteredClips()).toHaveLength(2)
  })

  it('filteredClips returns only done clips when filter is "done"', () => {
    useAppStore.setState({
      clips: [makeClip('a.mp4'), { ...makeClip('b.mp4'), status: 'done', caption: 'x' }],
      filter: 'done',
    })
    expect(useAppStore.getState().filteredClips()).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test tests/lib/store.test.ts
```
Expected: `Cannot find module '@/lib/store'`

- [ ] **Step 3: Write the store**

```ts
// lib/store.ts
import { create } from 'zustand'
import type { ClipMeta, ClipStatus } from '@/types'

export const GEMINI_MODELS = [
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-3.1-flash-lite-preview',
] as const

interface AppState {
  clips: ClipMeta[]
  isRunning: boolean
  view: 'grid' | 'list'
  filter: 'all' | 'done' | 'pending'
  apiKey: string
  model: string
  instructions: string
  modalClip: string | null
  // actions
  setClips: (clips: ClipMeta[]) => void
  updateClip: (file: string, patch: Partial<ClipMeta>) => void
  setIsRunning: (v: boolean) => void
  setView: (v: 'grid' | 'list') => void
  setFilter: (v: 'all' | 'done' | 'pending') => void
  setApiKey: (v: string) => void
  setModel: (v: string) => void
  setInstructions: (v: string) => void
  setModalClip: (file: string | null) => void
  filteredClips: () => ClipMeta[]
  doneCounts: () => { done: number; pending: number; total: number }
}

export const useAppStore = create<AppState>((set, get) => ({
  clips: [],
  isRunning: false,
  view: 'grid',
  filter: 'all',
  apiKey: '',
  model: 'gemini-3-flash-preview',
  instructions: '',
  modalClip: null,

  setClips: (clips) => set({ clips }),
  updateClip: (file, patch) =>
    set((s) => ({
      clips: s.clips.map((c) => (c.file === file ? { ...c, ...patch } : c)),
    })),
  setIsRunning: (v) => set({ isRunning: v }),
  setView: (v) => set({ view: v }),
  setFilter: (v) => set({ filter: v }),
  setApiKey: (v) => set({ apiKey: v }),
  setModel: (v) => set({ model: v }),
  setInstructions: (v) => set({ instructions: v }),
  setModalClip: (file) => set({ modalClip: file }),

  filteredClips: () => {
    const { clips, filter } = get()
    if (filter === 'done') return clips.filter((c) => c.status === 'done')
    if (filter === 'pending') return clips.filter((c) => c.status !== 'done')
    return clips
  },

  doneCounts: () => {
    const { clips } = get()
    const done = clips.filter((c) => c.status === 'done').length
    return { done, pending: clips.length - done, total: clips.length }
  },
}))
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test tests/lib/store.test.ts
```
Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/store.ts tests/lib/store.test.ts
git commit -m "feat: add Zustand store with filteredClips and doneCounts"
```

---

## Task 4: lib/clips.ts — scan directory and read sidecars

**Files:**
- Create: `lib/clips.ts`
- Create: `tests/lib/clips.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/lib/clips.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'path'

// Mock fs before importing clips
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    readdirSync: vi.fn(),
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  }
})

vi.mock('child_process', () => ({
  execSync: vi.fn(() =>
    JSON.stringify({
      format: { duration: '5.021008' },
      streams: [{ r_frame_rate: '24/1', width: 960, height: 575 }],
    })
  ),
}))

import * as fs from 'fs'
import { scanClips } from '@/lib/clips'

describe('scanClips', () => {
  beforeEach(() => {
    vi.mocked(fs.readdirSync).mockReturnValue(
      ['clip_001_941_000.mp4', 'clip_001_941_001.mp4', 'other.txt'] as any
    )
    vi.mocked(fs.existsSync).mockImplementation((p) =>
      String(p).endsWith('clip_001_941_000.txt')
    )
    vi.mocked(fs.readFileSync).mockReturnValue('A wide shot of an LCAC.' as any)
  })

  it('returns only .mp4 files', () => {
    const clips = scanClips('/fake/dir')
    expect(clips).toHaveLength(2)
    expect(clips.every((c) => c.file.endsWith('.mp4'))).toBe(true)
  })

  it('pre-populates caption for clips with sidecar .txt', () => {
    const clips = scanClips('/fake/dir')
    const withCaption = clips.find((c) => c.file === 'clip_001_941_000.mp4')
    expect(withCaption?.caption).toBe('A wide shot of an LCAC.')
    expect(withCaption?.status).toBe('done')
  })

  it('leaves caption null for clips without sidecar', () => {
    const clips = scanClips('/fake/dir')
    const noCaption = clips.find((c) => c.file === 'clip_001_941_001.mp4')
    expect(noCaption?.caption).toBeNull()
    expect(noCaption?.status).toBe('pending')
  })

  it('reads fps and resolution from ffprobe', () => {
    const clips = scanClips('/fake/dir')
    expect(clips[0].fps).toBe(24)
    expect(clips[0].resolution).toBe('960×575')
    expect(clips[0].duration).toBeCloseTo(5.021, 2)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test tests/lib/clips.test.ts
```
Expected: `Cannot find module '@/lib/clips'`

- [ ] **Step 3: Write lib/clips.ts**

```ts
// lib/clips.ts
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import type { ClipMeta } from '@/types'

interface ProbeResult {
  duration: number
  fps: number
  resolution: string
}

function ffprobe(filePath: string): ProbeResult {
  try {
    const out = execSync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate,width,height -show_entries format=duration -of json "${filePath}"`,
      { encoding: 'utf8' }
    )
    const data = JSON.parse(out)
    const duration = parseFloat(data.format.duration)
    const [num, den] = data.streams[0].r_frame_rate.split('/').map(Number)
    const fps = Math.round(num / den)
    const { width, height } = data.streams[0]
    return { duration, fps, resolution: `${width}×${height}` }
  } catch {
    return { duration: 5, fps: 24, resolution: '960×575' }
  }
}

export function scanClips(clipsDir: string): ClipMeta[] {
  const entries = fs.readdirSync(clipsDir) as string[]
  const mp4s = entries.filter((f) => f.endsWith('.mp4')).sort()

  return mp4s.map((file) => {
    const txtPath = path.join(clipsDir, file.replace('.mp4', '.txt'))
    const hasSidecar = fs.existsSync(txtPath)
    const caption = hasSidecar
      ? (fs.readFileSync(txtPath, 'utf8') as string).trim()
      : null

    const { duration, fps, resolution } = ffprobe(path.join(clipsDir, file))

    return {
      file,
      duration,
      fps,
      resolution,
      caption,
      status: hasSidecar ? 'done' : 'pending',
    } satisfies ClipMeta
  })
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test tests/lib/clips.test.ts
```
Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/clips.ts tests/lib/clips.test.ts
git commit -m "feat: add clip scanner with ffprobe metadata and sidecar reading"
```

---

## Task 5: lib/gemini.ts — Gemini upload/caption/delete

**Files:**
- Create: `lib/gemini.ts`

- [ ] **Step 1: Write lib/gemini.ts**

No unit test here — Gemini API calls require network. Tested end-to-end in Task 8.

```ts
// lib/gemini.ts
import { GoogleGenAI } from '@google/genai'
import fs from 'fs'
import path from 'path'

export const DEFAULT_PROMPT = `You are annotating military training footage of LCAC (Landing Craft Air Cushion) hovercraft operations for an AI model training dataset.

Watch this 5-second clip and write a single, dense descriptive caption (2-4 sentences) covering:
- What is happening (action, motion, activity)
- Camera angle and framing (wide shot, close-up, tracking shot, etc.)
- Environmental conditions (water, beach, dock, time of day, weather if visible)
- Any notable details (personnel, wake patterns, ramp position, cargo, etc.)

Be specific and factual. Do not speculate. Do not reference time codes.`

async function waitForActive(
  ai: GoogleGenAI,
  fileName: string
): Promise<void> {
  for (let i = 0; i < 30; i++) {
    const file = await ai.files.get({ name: fileName })
    if (file.state === 'ACTIVE') return
    if (file.state === 'FAILED') throw new Error(`File ${fileName} failed processing`)
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error(`Timed out waiting for file ${fileName} to become ACTIVE`)
}

export async function captionClip(
  apiKey: string,
  model: string,
  prompt: string,
  filePath: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey })

  // Upload
  const uploaded = await ai.files.upload({
    file: filePath,
    config: { mimeType: 'video/mp4' },
  })

  try {
    await waitForActive(ai, uploaded.name!)

    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            { fileData: { fileUri: uploaded.uri!, mimeType: 'video/mp4' } },
            { text: prompt },
          ],
        },
      ],
    })

    return response.text?.trim() ?? ''
  } finally {
    // Always clean up, even on error
    try {
      await ai.files.delete({ name: uploaded.name! })
    } catch {
      // non-fatal
    }
  }
}

export function writeSidecar(clipsDir: string, filename: string, caption: string): void {
  const txtPath = path.join(clipsDir, filename.replace('.mp4', '.txt'))
  fs.writeFileSync(txtPath, caption, 'utf8')
}

export function appendJsonl(clipsDir: string, filename: string, caption: string): void {
  const jsonlPath = path.join(clipsDir, 'captions.jsonl')
  const line = JSON.stringify({ file: filename, caption }) + '\n'
  fs.appendFileSync(jsonlPath, line, 'utf8')
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/gemini.ts
git commit -m "feat: add Gemini upload/caption/delete utilities"
```

---

## Task 6: API route — GET /api/clips

**Files:**
- Create: `app/api/clips/route.ts`

- [ ] **Step 1: Write route**

```ts
// app/api/clips/route.ts
import { NextResponse } from 'next/server'
import { scanClips } from '@/lib/clips'

export async function GET() {
  const clipsDir = process.env.CLIPS_DIR

  if (!clipsDir) {
    return NextResponse.json(
      { error: 'CLIPS_DIR is not set. Create .env.local with CLIPS_DIR=<path>' },
      { status: 500 }
    )
  }

  try {
    const clips = scanClips(clipsDir)
    return NextResponse.json(clips)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: `Failed to scan clips directory: ${message}`, path: clipsDir },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Manual smoke test**

```bash
npm run dev
```
Open: `http://localhost:3000/api/clips`

Expected: JSON array of `ClipMeta` objects with `file`, `duration`, `fps`, `resolution`, `caption`, `status` fields.

- [ ] **Step 3: Commit**

```bash
git add app/api/clips/route.ts
git commit -m "feat: add GET /api/clips route"
```

---

## Task 7: API route — GET /api/video/[filename]

**Files:**
- Create: `app/api/video/[filename]/route.ts`

- [ ] **Step 1: Write route**

```ts
// app/api/video/[filename]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params
  const clipsDir = process.env.CLIPS_DIR

  if (!clipsDir) {
    return new NextResponse('CLIPS_DIR not set', { status: 500 })
  }

  // Prevent path traversal
  const safe = path.basename(filename)
  if (!safe.endsWith('.mp4')) {
    return new NextResponse('Not found', { status: 404 })
  }

  const filePath = path.join(clipsDir, safe)

  if (!fs.existsSync(filePath)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const stat = fs.statSync(filePath)
  const fileSize = stat.size
  const range = req.headers.get('range')

  if (range) {
    const [startStr, endStr] = range.replace(/bytes=/, '').split('-')
    const start = parseInt(startStr, 10)
    const end = endStr ? parseInt(endStr, 10) : fileSize - 1
    const chunkSize = end - start + 1

    const nodeStream = fs.createReadStream(filePath, { start, end })
    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on('data', (chunk) => controller.enqueue(chunk))
        nodeStream.on('end', () => controller.close())
        nodeStream.on('error', (e) => controller.error(e))
      },
    })

    return new Response(webStream, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(chunkSize),
        'Content-Type': 'video/mp4',
      },
    })
  }

  const nodeStream = fs.createReadStream(filePath)
  const webStream = new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk) => controller.enqueue(chunk))
      nodeStream.on('end', () => controller.close())
      nodeStream.on('error', (e) => controller.error(e))
    },
  })

  return new Response(webStream, {
    headers: {
      'Content-Length': String(fileSize),
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
    },
  })
}
```

- [ ] **Step 2: Manual smoke test**

Open: `http://localhost:3000/api/video/clip_001_941_000.mp4`

Expected: video plays in browser tab.

- [ ] **Step 3: Commit**

```bash
git add app/api/video/
git commit -m "feat: add GET /api/video/[filename] with range request support"
```

---

## Task 8: API route — POST /api/caption (SSE stream)

**Files:**
- Create: `app/api/caption/route.ts`

- [ ] **Step 1: Write route**

```ts
// app/api/caption/route.ts
import { NextRequest } from 'next/server'
import path from 'path'
import fs from 'fs'
import { captionClip, writeSidecar, appendJsonl, DEFAULT_PROMPT } from '@/lib/gemini'
import type { CaptionRequest, SSEEvent } from '@/types'

function encode(event: SSEEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`)
}

export async function POST(req: NextRequest) {
  const body: CaptionRequest = await req.json()
  const { apiKey, model, instructions, files } = body
  const clipsDir = process.env.CLIPS_DIR!
  const prompt = instructions.trim() || DEFAULT_PROMPT

  // Filter out files that already have .txt sidecars (resume support)
  const pending = files.filter((f) => {
    const txtPath = path.join(clipsDir, f.replace('.mp4', '.txt'))
    return !fs.existsSync(txtPath)
  })

  const total = pending.length

  const stream = new ReadableStream({
    async start(controller) {
      for (let i = 0; i < pending.length; i++) {
        const file = pending[i]
        const filePath = path.join(clipsDir, file)

        try {
          const caption = await captionClip(apiKey, model, prompt, filePath)
          writeSidecar(clipsDir, file, caption)
          appendJsonl(clipsDir, file, caption)
          controller.enqueue(
            encode({ type: 'progress', file, caption, index: i + 1, total })
          )
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err)
          controller.enqueue(encode({ type: 'error', file, message }))
        }
      }

      controller.enqueue(encode({ type: 'done', total }))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/caption/route.ts
git commit -m "feat: add POST /api/caption SSE route with resume support"
```

---

## Task 9: Dark theme layout and global CSS

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Replace globals.css**

```css
/* app/globals.css */
@import "tailwindcss";

@custom-variant dark (&:is(.dark *));

@theme {
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'Geist Mono', 'Fira Code', monospace;
}

:root {
  --background: oklch(0.12 0 0);
  --foreground: oklch(0.94 0 0);
  --card: oklch(0.17 0 0);
  --card-border: oklch(0.26 0 0);
  --header: oklch(0.10 0 0);
  --muted: oklch(0.22 0 0);
  --muted-fg: oklch(0.55 0 0);
  --accent: #6366f1;
  --accent-fg: #ffffff;
  --accent-subtle: #6366f133;
  --accent-border: #6366f155;
  --accent-light: #a5b4fc;
  --success: #22c55e;
  --success-subtle: #22c55e33;
  --success-border: #22c55e55;
  --success-fg: #86efac;
  --warning: #f59e0b;
  --warning-subtle: #f59e0b33;
  --warning-border: #f59e0b55;
  --warning-fg: #fcd34d;
  --danger: #ef4444;
  --danger-subtle: #ef444433;
  --danger-fg: #fca5a5;
  --radius: 0.625rem;
}

* {
  box-sizing: border-box;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
  font-size: 14px;
  -webkit-font-smoothing: antialiased;
}

::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--card-border); border-radius: 3px; }

@keyframes shimmer {
  from { transform: translateX(-100%); }
  to   { transform: translateX(200%); }
}

@keyframes pulse-glow {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}

@keyframes blink {
  50% { opacity: 0; }
}
```

- [ ] **Step 2: Replace layout.tsx**

```tsx
// app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Studio.One Model Train',
  description: 'Gemini-powered captioning for video training clips',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.variable}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 3: Verify dark background loads**

Open `http://localhost:3000` — the page background should be near-black (`oklch(0.12 0 0)`).

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx app/globals.css
git commit -m "feat: dark theme layout with CSS custom properties"
```

---

## Task 10: Header and SettingsPanel components

**Files:**
- Create: `components/Header.tsx`
- Create: `components/SettingsPanel.tsx`

- [ ] **Step 1: Write Header.tsx**

```tsx
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
```

- [ ] **Step 2: Write SettingsPanel.tsx**

```tsx
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
```

- [ ] **Step 3: Commit**

```bash
git add components/Header.tsx components/SettingsPanel.tsx
git commit -m "feat: add Header and SettingsPanel components"
```

---

## Task 11: ProgressBar and Toolbar components

**Files:**
- Create: `components/ProgressBar.tsx`
- Create: `components/Toolbar.tsx`

- [ ] **Step 1: Write ProgressBar.tsx**

```tsx
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
```

- [ ] **Step 2: Write Toolbar.tsx**

```tsx
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
```

- [ ] **Step 3: Commit**

```bash
git add components/ProgressBar.tsx components/Toolbar.tsx
git commit -m "feat: add ProgressBar and Toolbar components"
```

---

## Task 12: useTypewriter hook and StatusBadge

**Files:**
- Create: `hooks/useTypewriter.ts`
- Create: `components/StatusBadge.tsx`

- [ ] **Step 1: Write useTypewriter.ts**

```ts
// hooks/useTypewriter.ts
import { useState, useEffect } from 'react'

export function useTypewriter(text: string | null, charsPerSec = 120): string {
  const [displayed, setDisplayed] = useState(text ?? '')

  useEffect(() => {
    if (!text) {
      setDisplayed('')
      return
    }
    setDisplayed('')
    let i = 0
    const delay = 1000 / charsPerSec
    const id = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) clearInterval(id)
    }, delay)
    return () => clearInterval(id)
  }, [text, charsPerSec])

  return displayed
}
```

- [ ] **Step 2: Write StatusBadge.tsx**

```tsx
// components/StatusBadge.tsx
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
```

- [ ] **Step 3: Commit**

```bash
git add hooks/useTypewriter.ts components/StatusBadge.tsx
git commit -m "feat: add useTypewriter hook and StatusBadge component"
```

---

## Task 13: ClipCard and ClipListItem

**Files:**
- Create: `components/ClipCard.tsx`
- Create: `components/ClipListItem.tsx`

- [ ] **Step 1: Write ClipCard.tsx**

```tsx
// components/ClipCard.tsx
'use client'
import { useAppStore } from '@/lib/store'
import { useTypewriter } from '@/hooks/useTypewriter'
import StatusBadge from './StatusBadge'
import type { ClipMeta } from '@/types'

export default function ClipCard({ clip }: { clip: ClipMeta }) {
  const setModalClip = useAppStore((s) => s.setModalClip)
  const isTyping = clip.status === 'captioning'
  const typed = useTypewriter(isTyping ? clip.caption : null)
  const displayCaption = clip.status === 'done' ? clip.caption : typed

  return (
    <div
      style={{
        background: 'var(--card)', border: '1px solid var(--card-border)',
        borderRadius: 10, overflow: 'hidden', transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#6366f166'
        e.currentTarget.style.boxShadow = '0 0 24px -4px #6366f1aa'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--card-border)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Thumbnail */}
      <div
        style={{ aspectRatio: '16/9', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
        onClick={() => setModalClip(clip.file)}
      >
        <video
          src={`/api/video/${encodeURIComponent(clip.file)}`}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          preload="metadata"
          muted
        />
        {/* Hover overlay */}
        <div className="play-overlay" style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: 0, transition: 'opacity 0.2s',
        }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
        >
          <div style={{
            width: 48, height: 48, background: 'rgba(99,102,241,0.9)', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, paddingLeft: 3, color: '#fff',
          }}>▶</div>
        </div>
        {/* Gradient overlay */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 50%)',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          padding: '10px 12px',
        }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
            {clip.file}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            {clip.duration.toFixed(2)}s · {clip.fps}fps · {clip.resolution}
          </div>
        </div>
        {/* Status badge */}
        <StatusBadge status={clip.status} style={{ position: 'absolute', top: 10, right: 10 }} />
      </div>

      {/* Caption area */}
      <div style={{ padding: '12px 14px', minHeight: 64, borderTop: '1px solid var(--muted)' }}>
        {clip.status === 'pending' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[100, 100, 60].map((w, i) => (
              <div key={i} style={{ height: 8, borderRadius: 4, background: 'var(--muted)', width: `${w}%` }} />
            ))}
          </div>
        )}
        {(clip.status === 'captioning' || clip.status === 'done' || clip.status === 'failed') && (
          <p style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--muted-fg)' }}>
            {displayCaption}
            {clip.status === 'captioning' && (
              <span style={{ animation: 'blink 0.8s step-end infinite', color: 'var(--accent)' }}>▋</span>
            )}
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write ClipListItem.tsx**

```tsx
// components/ClipListItem.tsx
'use client'
import { useAppStore } from '@/lib/store'
import { useTypewriter } from '@/hooks/useTypewriter'
import StatusBadge from './StatusBadge'
import type { ClipMeta } from '@/types'

export default function ClipListItem({ clip }: { clip: ClipMeta }) {
  const setModalClip = useAppStore((s) => s.setModalClip)
  const isTyping = clip.status === 'captioning'
  const typed = useTypewriter(isTyping ? clip.caption : null)
  const displayCaption = clip.status === 'done' ? clip.caption : typed

  return (
    <div
      style={{
        background: 'var(--card)', border: '1px solid var(--card-border)',
        borderRadius: 8, display: 'flex', overflow: 'hidden',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#6366f166'
        e.currentTarget.style.boxShadow = '0 0 20px -6px #6366f1aa'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--card-border)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Thumbnail */}
      <div
        style={{ width: 240, minWidth: 240, position: 'relative', cursor: 'pointer', aspectRatio: '16/9' }}
        onClick={() => setModalClip(clip.file)}
      >
        <video
          src={`/api/video/${encodeURIComponent(clip.file)}`}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          preload="metadata"
          muted
        />
        <StatusBadge status={clip.status} style={{ position: 'absolute', top: 8, right: 8 }} />
      </div>

      {/* Content */}
      <div style={{
        flex: 1, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 6,
        borderLeft: '1px solid var(--muted)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--foreground)', fontWeight: 500 }}>
            {clip.file}
          </span>
          <span style={{ fontSize: 10, color: 'var(--muted-fg)', marginLeft: 'auto' }}>
            {clip.duration.toFixed(2)}s · {clip.fps}fps · {clip.resolution}
          </span>
        </div>

        {clip.status === 'pending' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
            {[100, 60].map((w, i) => (
              <div key={i} style={{ height: 8, borderRadius: 4, background: 'var(--muted)', width: `${w}%` }} />
            ))}
          </div>
        )}
        {(clip.status === 'captioning' || clip.status === 'done' || clip.status === 'failed') && (
          <p style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--muted-fg)', flex: 1 }}>
            {displayCaption}
            {clip.status === 'captioning' && (
              <span style={{ animation: 'blink 0.8s step-end infinite', color: 'var(--accent)' }}>▋</span>
            )}
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/ClipCard.tsx components/ClipListItem.tsx
git commit -m "feat: add ClipCard and ClipListItem with typewriter animation"
```

---

## Task 14: ClipGrid, ClipList, and ClipModal

**Files:**
- Create: `components/ClipGrid.tsx`
- Create: `components/ClipList.tsx`
- Create: `components/ClipModal.tsx`

- [ ] **Step 1: Write ClipGrid.tsx**

```tsx
// components/ClipGrid.tsx
'use client'
import { useAppStore } from '@/lib/store'
import ClipCard from './ClipCard'

export default function ClipGrid() {
  const filteredClips = useAppStore((s) => s.filteredClips())
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
      gap: 18, padding: '20px 24px',
    }}>
      {filteredClips.map((clip) => (
        <ClipCard key={clip.file} clip={clip} />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Write ClipList.tsx**

```tsx
// components/ClipList.tsx
'use client'
import { useAppStore } from '@/lib/store'
import ClipListItem from './ClipListItem'

export default function ClipList() {
  const filteredClips = useAppStore((s) => s.filteredClips())
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '16px 24px' }}>
      {filteredClips.map((clip) => (
        <ClipListItem key={clip.file} clip={clip} />
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Write ClipModal.tsx**

```tsx
// components/ClipModal.tsx
'use client'
import { useEffect, useRef } from 'react'
import { useAppStore } from '@/lib/store'
import StatusBadge from './StatusBadge'

export default function ClipModal() {
  const { modalClip, setModalClip, clips } = useAppStore()
  const videoRef = useRef<HTMLVideoElement>(null)

  const clip = clips.find((c) => c.file === modalClip)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalClip(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setModalClip])

  // Pause video when modal closes
  useEffect(() => {
    if (!modalClip && videoRef.current) videoRef.current.pause()
  }, [modalClip])

  if (!modalClip || !clip) return null

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) setModalClip(null) }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100, padding: 24,
      }}
    >
      <div style={{
        background: 'oklch(0.15 0 0)', border: '1px solid var(--card-border)',
        borderRadius: 12, width: '100%', maxWidth: 900, overflow: 'hidden',
        boxShadow: '0 0 60px -10px #6366f1aa',
      }}>
        {/* Video */}
        <div style={{ aspectRatio: '16/9', background: '#000', position: 'relative' }}>
          <video
            ref={videoRef}
            src={`/api/video/${encodeURIComponent(clip.file)}`}
            controls
            autoPlay
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
          <button
            onClick={() => setModalClip(null)}
            style={{
              position: 'absolute', top: 12, right: 12,
              background: 'rgba(0,0,0,0.6)', border: '1px solid var(--card-border)',
              borderRadius: 6, color: 'var(--muted-fg)', fontSize: 14,
              padding: '4px 10px', cursor: 'pointer', backdropFilter: 'blur(4px)',
            }}
          >
            ✕ Close
          </button>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--muted-fg)' }}>
              {clip.file}
            </span>
            <StatusBadge status={clip.status} style={{ position: 'static' }} />
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--muted-fg)' }}>
              {clip.duration.toFixed(2)}s · {clip.fps}fps · {clip.resolution}
            </span>
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.65, color: 'oklch(0.82 0 0)' }}>
            {clip.caption ?? '—'}
          </p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add components/ClipGrid.tsx components/ClipList.tsx components/ClipModal.tsx
git commit -m "feat: add ClipGrid, ClipList, and ClipModal components"
```

---

## Task 15: page.tsx — wire everything together

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Write page.tsx**

```tsx
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
    setClips, updateClip, view, isRunning, setIsRunning,
    apiKey, model, instructions, clips,
  } = useAppStore()

  const [error, setError] = useState<string | null>(null)
  const [currentFile, setCurrentFile] = useState<string | undefined>()
  const abortRef = useRef<AbortController | null>(null)

  // Load clips on mount — restore API key from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('gemini_api_key')
    if (saved) useAppStore.getState().setApiKey(saved)

    fetch('/api/clips')
      .then((r) => r.json())
      .then((data: ClipMeta[] | { error: string }) => {
        if ('error' in data) {
          setError(data.error)
        } else {
          setClips(data)
        }
      })
      .catch((e) => setError(String(e)))
  }, [setClips])

  // Persist API key to localStorage whenever it changes
  useEffect(() => {
    if (apiKey) localStorage.setItem('gemini_api_key', apiKey)
  }, [apiKey])

  async function handleStart() {
    setError(null)
    setIsRunning(true)

    const pendingFiles = clips
      .filter((c) => c.status !== 'done')
      .map((c) => c.file)

    if (pendingFiles.length === 0) {
      setIsRunning(false)
      return
    }

    // Mark all pending as... pending (in case of re-run)
    pendingFiles.forEach((f) => updateClip(f, { status: 'pending', caption: null }))

    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, model, instructions, files: pendingFiles }),
        signal: abortRef.current.signal,
      })

      const reader = res.body!.getReader()
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
          const event: SSEEvent = JSON.parse(line.slice(6))

          if (event.type === 'progress') {
            setCurrentFile(event.file)
            updateClip(event.file, { status: 'captioning', caption: event.caption })
            // Short delay so typewriter animation plays, then mark done
            setTimeout(() => {
              updateClip(event.file, { status: 'done' })
            }, Math.min(event.caption.length * (1000 / 120) + 500, 5000))
          } else if (event.type === 'error') {
            updateClip(event.file, { status: 'failed' })
          } else if (event.type === 'done') {
            setCurrentFile(undefined)
            setIsRunning(false)
          }
        }
      }
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
      <SettingsPanel />
      <ProgressBar currentFile={currentFile} />

      {error && (
        <div style={{
          margin: '16px 24px', padding: '12px 16px',
          background: 'var(--danger-subtle)', border: '1px solid var(--card-border)',
          borderRadius: 8, fontSize: 13, color: 'var(--danger-fg)',
        }}>
          <strong>Error:</strong> {error}
          {error.includes('CLIPS_DIR') && (
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted-fg)' }}>
              Create <code>.env.local</code> in the project root with:{' '}
              <code>CLIPS_DIR=E:\path\to\your\chunks</code>
            </div>
          )}
        </div>
      )}

      <Toolbar />
      {view === 'grid' ? <ClipGrid /> : <ClipList />}
      <ClipModal />
    </>
  )
}
```

- [ ] **Step 2: Verify full app runs**

```bash
npm run dev
```

Open `http://localhost:3000`. Expected:
- All clips load in the grid
- Already-captioned clips show green ✓ Done badge with caption text
- Pending clips show skeleton lines
- Click Start Captioning → progress bar appears, captions type in one by one
- Click any thumbnail → fullscreen modal with video controls and caption
- Grid/List toggle switches between views
- Filter tabs show correct counts

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: wire all components into main page with SSE captioning flow"
```

---

## Task 16: Create GitHub repo and push

**Files:** none (git operations only)

- [ ] **Step 1: Add .gitignore entries**

Ensure `.gitignore` contains:
```
.env.local
.next/
node_modules/
.superpowers/
```

- [ ] **Step 2: Create the GitHub repo and push**

```bash
cd E:/SUGARBANK_DEV/studio-one-model-train
gh repo create studio-one-model-train --public --description "Gemini-powered video captioning UI for AI training data — Studio.One Model Train" --source=. --remote=origin --push
```

- [ ] **Step 3: Verify**

```bash
gh repo view studio-one-model-train --web
```

Expected: repo opens in browser with all files pushed.

---

## Self-Review

**Spec coverage check:**
- ✅ Header with title, API key, Start button → Task 10
- ✅ Settings panel with model selector + custom instructions → Task 10
- ✅ Progress bar with shimmer + metadata → Task 11
- ✅ Filter toolbar + grid/list toggle → Task 11
- ✅ Grid view with large cards (340px min) → Tasks 13–14
- ✅ List view with horizontal layout → Tasks 13–14
- ✅ Video thumbnails served via API → Task 7
- ✅ Status badges (done/captioning/pending/failed) → Task 12
- ✅ Skeleton placeholders for pending clips → Tasks 13
- ✅ Typewriter animation on caption reveal → Task 12
- ✅ Fullscreen modal with video controls → Task 14
- ✅ SSE streaming captioning → Task 8
- ✅ Resume support (skips done clips) → Task 8
- ✅ Writes .txt sidecars + captions.jsonl → Task 5
- ✅ Error banner for bad CLIPS_DIR → Task 15
- ✅ API key in localStorage (not env) → Task 15
- ✅ CLIPS_DIR via .env.local → Tasks 1, 6
- ✅ Dark theme matching dvidshub-web → Task 9
- ✅ GitHub repo → Task 16

**Type consistency check:**
- `ClipMeta` defined in Task 2, used consistently in Tasks 3, 4, 6, 13, 14, 15 ✅
- `SSEEvent` union type used in Task 8 (server emits) and Task 15 (client parses) ✅
- `CaptionRequest` defined in Task 2, consumed in Task 8 ✅
- `GEMINI_MODELS` defined in store (Task 3), consumed in SettingsPanel (Task 10) ✅
- `ClipStatus` type: `'pending' | 'captioning' | 'done' | 'failed'` — used identically across StatusBadge, store, and components ✅
- `filteredClips()` returns `ClipMeta[]` — used in ClipGrid and ClipList ✅
- `doneCounts()` returns `{ done, pending, total }` — used in ProgressBar and Toolbar ✅
