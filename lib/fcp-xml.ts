// lib/fcp-xml.ts
// Parses Premiere Pro FCP XML exports and returns ChunkSource[]
import { XMLParser } from 'fast-xml-parser'
import type { ChunkSource } from '@/types'

function toWindowsPath(pathurl: string): string {
  // Handles file://localhost/E:/... and file:///E:/... → E:\...
  return decodeURIComponent(
    pathurl.replace(/^file:\/\/(localhost)?\//, '').replace(/\//g, '\\')
  )
}

export function parseFcpXml(xmlContent: string): ChunkSource[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => ['clipitem', 'track', 'sequence'].includes(name),
  })
  const doc = parser.parse(xmlContent)

  const xmeml = doc.xmeml ?? doc

  // Support both single and multiple sequences
  const sequences: unknown[] = Array.isArray(xmeml.sequence)
    ? xmeml.sequence
    : xmeml.sequence
    ? [xmeml.sequence]
    : []

  // ── Pass 1: build a global file-id → pathurl map ─────────────────────────
  // Premiere only writes <pathurl> on the first use of a file; subsequent
  // clipitems reference the same file by id attribute with no pathurl.
  const fileIdToPath = new Map<string, string>()

  function collectFilePaths(node: unknown) {
    if (!node || typeof node !== 'object') return
    const obj = node as Record<string, unknown>
    if ('pathurl' in obj && typeof obj.pathurl === 'string') {
      const id = String(obj['@_id'] ?? '')
      if (id) fileIdToPath.set(id, obj.pathurl as string)
    }
    for (const val of Object.values(obj)) {
      if (Array.isArray(val)) val.forEach(collectFilePaths)
      else if (typeof val === 'object') collectFilePaths(val)
    }
  }
  collectFilePaths(xmeml)

  // ── Pass 2: extract clip in/out from every clipitem ───────────────────────
  const sources: ChunkSource[] = []
  const seen = new Set<string>()

  for (const sequence of sequences) {
    const seq = sequence as Record<string, unknown>
    const timebase: number = Number(seq.timebase ?? 24)

    const media = (seq.media ?? seq) as Record<string, unknown>
    const videoSection = (media.video ?? media) as Record<string, unknown>
    const tracks: unknown[] = Array.isArray(videoSection.track)
      ? videoSection.track
      : videoSection.track
      ? [videoSection.track]
      : []

    for (const track of tracks) {
      const t = track as Record<string, unknown>
      const clipitems: unknown[] = Array.isArray(t.clipitem)
        ? t.clipitem
        : t.clipitem
        ? [t.clipitem]
        : []

      for (const item of clipitems) {
        const ci = item as Record<string, unknown>
        const fileNode = ci.file as Record<string, unknown> | undefined
        if (!fileNode) continue

        // Resolve pathurl — either inline or via the id→path map
        let pathurl = String(fileNode.pathurl ?? '')
        if (!pathurl) {
          const fileId = String(fileNode['@_id'] ?? fileNode['@_idref'] ?? fileNode.id ?? '')
          pathurl = fileIdToPath.get(fileId) ?? ''
        }
        if (!pathurl) continue

        const sourceFile = toWindowsPath(pathurl)

        const inFrame  = Number(ci.in  ?? 0)
        const outFrame = Number(ci.out ?? 0)
        if (outFrame <= inFrame) continue

        const inSec  = inFrame  / timebase
        const outSec = outFrame / timebase

        const label = String(ci.name ?? fileNode.name ?? sourceFile.split('\\').pop() ?? sourceFile)

        // De-duplicate identical source segments
        const key = `${sourceFile}|${inFrame}|${outFrame}`
        if (seen.has(key)) continue
        seen.add(key)

        sources.push({ sourceFile, inSec, outSec, label })
      }
    }
  }

  return sources
}
