// app/api/clips/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { scanClips } from '@/lib/clips'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const clipsDir = searchParams.get('dir') || process.env.CLIPS_DIR

  if (!clipsDir) {
    return NextResponse.json(
      { error: 'No folder selected. Click "Browse" to choose a clips folder.' },
      { status: 500 }
    )
  }

  try {
    const clips = scanClips(clipsDir)
    return NextResponse.json({ clips, dir: clipsDir })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: `Failed to scan clips directory: ${message}`, path: clipsDir },
      { status: 500 }
    )
  }
}
