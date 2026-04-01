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
