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
  clipsDir: string
}

// ── Chunker ──────────────────────────────────────────────────────────────────

export interface ChunkSource {
  sourceFile: string  // absolute path to source video
  inSec: number       // start time in seconds
  outSec: number      // end time in seconds
  label: string       // display name (clip name from XML or filename)
}

export interface ChunkSettings {
  width: number          // default 960
  height: number         // default 576
  framesPerChunk: number // default 121
  fps: number            // default 24
  includeAudio: boolean  // default true
  outputDir: string
}

export interface ChunkRequest {
  sources: ChunkSource[]
  settings: ChunkSettings
}

export type ChunkSSEEvent =
  | { type: 'chunk-progress'; file: string; index: number; total: number }
  | { type: 'chunk-error'; file: string; message: string }
  | { type: 'chunk-done'; total: number }
