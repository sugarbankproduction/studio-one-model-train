// lib/fcp-xml.ts
// Parses Premiere Pro FCP XML exports and returns ChunkSource[]
import { XMLParser } from 'fast-xml-parser'
import type { ChunkSource } from '@/types'

export function parseFcpXml(xmlContent: string): ChunkSource[] {
  const parser = new XMLParser({ ignoreAttributes: false, isArray: (name) => name === 'clipitem' || name === 'track' })
  const doc = parser.parse(xmlContent)

  // Navigate xmeml > sequence (may be nested inside xmeml or at root)
  const xmeml = doc.xmeml ?? doc
  const sequence = xmeml.sequence ?? xmeml

  // Timebase: frames per second of the sequence
  const timebase: number = Number(sequence.timebase ?? 24)

  const sources: ChunkSource[] = []

  // Tracks can be under sequence.media.video.track or sequence.video.track
  const media = sequence.media ?? sequence
  const videoSection = media.video ?? media
  const tracks: unknown[] = Array.isArray(videoSection.track)
    ? videoSection.track
    : videoSection.track
    ? [videoSection.track]
    : []

  // Collect unique file pathurls seen so we can de-dup file nodes
  const seenFiles = new Set<string>()

  for (const track of tracks) {
    const clipitems: unknown[] = Array.isArray((track as Record<string,unknown>).clipitem)
      ? ((track as Record<string,unknown>).clipitem as unknown[])
      : (track as Record<string,unknown>).clipitem
      ? [(track as Record<string,unknown>).clipitem]
      : []

    for (const item of clipitems) {
      const ci = item as Record<string, unknown>

      // Skip empty/transition clips (no file)
      const fileNode = ci.file as Record<string, unknown> | undefined
      if (!fileNode) continue

      const pathurl = String(fileNode.pathurl ?? '')
      if (!pathurl) continue

      // Convert file:///E:/... → E:\...
      const sourceFile = decodeURIComponent(pathurl.replace(/^file:\/\/\//, '').replace(/\//g, '\\'))

      // in/out are frame numbers in the SOURCE clip
      const inFrame = Number(ci.in ?? 0)
      const outFrame = Number(ci.out ?? 0)

      if (outFrame <= inFrame) continue

      const inSec = inFrame / timebase
      const outSec = outFrame / timebase

      const label = String(ci.name ?? fileNode.name ?? sourceFile.split('\\').pop() ?? sourceFile)

      // De-duplicate: same source + same in/out = same clip
      const key = `${sourceFile}|${inSec}|${outSec}`
      if (seenFiles.has(key)) continue
      seenFiles.add(key)

      sources.push({ sourceFile, inSec, outSec, label })
    }
  }

  return sources
}
