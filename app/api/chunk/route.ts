// app/api/chunk/route.ts
import { NextRequest } from 'next/server'
import { runChunkJob } from '@/lib/chunker'
import type { ChunkRequest, ChunkSSEEvent } from '@/types'

function encode(event: ChunkSSEEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`)
}

export async function POST(req: NextRequest) {
  const body: ChunkRequest = await req.json()
  const { sources, settings } = body

  if (!sources?.length) {
    return new Response('No sources provided', { status: 400 })
  }
  if (!settings?.outputDir) {
    return new Response('outputDir is required', { status: 400 })
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runChunkJob(sources, settings)) {
          controller.enqueue(encode(event))
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        controller.enqueue(encode({ type: 'chunk-error', file: '', message }))
      }
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
