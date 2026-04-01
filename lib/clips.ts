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
    return { duration, fps, resolution: `${width}\u00D7${height}` }
  } catch {
    return { duration: 5, fps: 24, resolution: '960\u00D7575' }
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
