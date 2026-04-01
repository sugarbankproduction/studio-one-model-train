import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'path'

// Mock fs before importing clips
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  const readdirSync = vi.fn()
  const existsSync = vi.fn()
  const readFileSync = vi.fn()
  const mocked = {
    ...actual,
    readdirSync,
    existsSync,
    readFileSync,
    default: {
      ...(actual as any).default,
      readdirSync,
      existsSync,
      readFileSync,
    },
  }
  return mocked
})

vi.mock('child_process', () => ({
  execSync: vi.fn(() =>
    JSON.stringify({
      format: { duration: '5.021008' },
      streams: [{ r_frame_rate: '24/1', width: 960, height: 575 }],
    })
  ),
}))

import * as fs from 'fs'
import { scanClips } from '@/lib/clips'

describe('scanClips', () => {
  beforeEach(() => {
    vi.mocked(fs.readdirSync).mockReturnValue(
      ['clip_001_941_000.mp4', 'clip_001_941_001.mp4', 'other.txt'] as any
    )
    vi.mocked(fs.existsSync).mockImplementation((p) =>
      String(p).endsWith('clip_001_941_000.txt')
    )
    vi.mocked(fs.readFileSync).mockReturnValue('A wide shot of an LCAC.' as any)
  })

  it('returns only .mp4 files', () => {
    const clips = scanClips('/fake/dir')
    expect(clips).toHaveLength(2)
    expect(clips.every((c) => c.file.endsWith('.mp4'))).toBe(true)
  })

  it('pre-populates caption for clips with sidecar .txt', () => {
    const clips = scanClips('/fake/dir')
    const withCaption = clips.find((c) => c.file === 'clip_001_941_000.mp4')
    expect(withCaption?.caption).toBe('A wide shot of an LCAC.')
    expect(withCaption?.status).toBe('done')
  })

  it('leaves caption null for clips without sidecar', () => {
    const clips = scanClips('/fake/dir')
    const noCaption = clips.find((c) => c.file === 'clip_001_941_001.mp4')
    expect(noCaption?.caption).toBeNull()
    expect(noCaption?.status).toBe('pending')
  })

  it('reads fps and resolution from ffprobe', () => {
    const clips = scanClips('/fake/dir')
    expect(clips[0].fps).toBe(24)
    expect(clips[0].resolution).toBe('960\u00D7575')
    expect(clips[0].duration).toBeCloseTo(5.021, 2)
  })
})
