// lib/chunker.ts
// Runs ffmpeg to produce exactly N-frame chunks from source segments.
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import type { ChunkSource, ChunkSettings, ChunkSSEEvent } from '@/types'

function ffmpegChunk(
  sourceFile: string,
  seekSec: number,
  outputPath: string,
  settings: ChunkSettings,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const { width, height, framesPerChunk, fps, includeAudio } = settings
    const vf = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`
    const args = [
      '-y',
      '-ss', seekSec.toFixed(6),
      '-i', sourceFile,
      '-frames:v', String(framesPerChunk),
      '-vf', vf,
      '-r', String(fps),
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '18',
      ...(includeAudio ? ['-c:a', 'aac', '-b:a', '128k'] : ['-an']),
      outputPath,
    ]

    const proc = spawn('ffmpeg', args)
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exited with code ${code}`))
    })
    proc.on('error', reject)
  })
}

export async function* runChunkJob(
  sources: ChunkSource[],
  settings: ChunkSettings,
): AsyncGenerator<ChunkSSEEvent> {
  fs.mkdirSync(settings.outputDir, { recursive: true })

  // Count total chunks up front for progress display
  let total = 0
  const plan: Array<{ sourceFile: string; seekSec: number }> = []

  for (const src of sources) {
    const durationSec = src.outSec - src.inSec
    const nChunks = Math.floor((durationSec * settings.fps) / settings.framesPerChunk)
    for (let i = 0; i < nChunks; i++) {
      plan.push({
        sourceFile: src.sourceFile,
        seekSec: src.inSec + (i * settings.framesPerChunk) / settings.fps,
      })
      total++
    }
  }

  for (let idx = 0; idx < plan.length; idx++) {
    const { sourceFile, seekSec } = plan[idx]
    const outputName = `chunk_${String(idx).padStart(4, '0')}.mp4`
    const outputPath = path.join(settings.outputDir, outputName)

    try {
      await ffmpegChunk(sourceFile, seekSec, outputPath, settings)
      yield { type: 'chunk-progress', file: outputName, index: idx + 1, total }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      yield { type: 'chunk-error', file: outputName, message }
    }
  }

  yield { type: 'chunk-done', total }
}
