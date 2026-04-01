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
