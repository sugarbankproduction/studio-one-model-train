import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '@/lib/store'
import type { ClipMeta } from '@/types'

const makeClip = (file: string): ClipMeta => ({
  file,
  duration: 5,
  fps: 24,
  resolution: '960×575',
  caption: null,
  status: 'pending',
})

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      clips: [],
      isRunning: false,
      view: 'grid',
      filter: 'all',
      apiKey: '',
      model: 'gemini-3-flash-preview',
      instructions: '',
      modalClip: null,
    })
  })

  it('setClips replaces clip list', () => {
    const clips = [makeClip('a.mp4'), makeClip('b.mp4')]
    useAppStore.getState().setClips(clips)
    expect(useAppStore.getState().clips).toHaveLength(2)
  })

  it('updateClip updates a single clip by filename', () => {
    useAppStore.setState({ clips: [makeClip('a.mp4')] })
    useAppStore.getState().updateClip('a.mp4', { status: 'done', caption: 'hello' })
    const clip = useAppStore.getState().clips[0]
    expect(clip.status).toBe('done')
    expect(clip.caption).toBe('hello')
  })

  it('updateClip ignores unknown filenames', () => {
    useAppStore.setState({ clips: [makeClip('a.mp4')] })
    useAppStore.getState().updateClip('nope.mp4', { status: 'done' })
    expect(useAppStore.getState().clips[0].status).toBe('pending')
  })

  it('filteredClips returns all clips when filter is "all"', () => {
    useAppStore.setState({
      clips: [makeClip('a.mp4'), { ...makeClip('b.mp4'), status: 'done', caption: 'x' }],
      filter: 'all',
    })
    expect(useAppStore.getState().filteredClips()).toHaveLength(2)
  })

  it('filteredClips returns only done clips when filter is "done"', () => {
    useAppStore.setState({
      clips: [makeClip('a.mp4'), { ...makeClip('b.mp4'), status: 'done', caption: 'x' }],
      filter: 'done',
    })
    expect(useAppStore.getState().filteredClips()).toHaveLength(1)
  })
})
