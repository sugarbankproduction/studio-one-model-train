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
  const clipsDir = process.env.CLIPS_DIR
  if (!clipsDir) {
    return new Response('CLIPS_DIR is not set', { status: 500 })
  }
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
