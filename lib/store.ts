import { create } from 'zustand'
import type { ClipMeta, ClipStatus } from '@/types'

export const GEMINI_MODELS = [
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-3.1-flash-lite-preview',
] as const

interface AppState {
  clips: ClipMeta[]
  clipsDir: string
  isRunning: boolean
  view: 'grid' | 'list'
  filter: 'all' | 'done' | 'pending'
  apiKey: string
  model: string
  instructions: string
  modalClip: string | null
  // actions
  setClips: (clips: ClipMeta[]) => void
  setClipsDir: (dir: string) => void
  updateClip: (file: string, patch: Partial<ClipMeta>) => void
  setIsRunning: (v: boolean) => void
  setView: (v: 'grid' | 'list') => void
  setFilter: (v: 'all' | 'done' | 'pending') => void
  setApiKey: (v: string) => void
  setModel: (v: string) => void
  setInstructions: (v: string) => void
  setModalClip: (file: string | null) => void
  filteredClips: () => ClipMeta[]
  doneCounts: () => { done: number; pending: number; total: number }
}

export const useAppStore = create<AppState>((set, get) => ({
  clips: [],
  clipsDir: '',
  isRunning: false,
  view: 'grid',
  filter: 'all',
  apiKey: '',
  model: 'gemini-3-flash-preview',
  instructions: '',
  modalClip: null,

  setClips: (clips) => set({ clips }),
  setClipsDir: (dir) => set({ clipsDir: dir }),
  updateClip: (file, patch) =>
    set((s) => ({
      clips: s.clips.map((c) => (c.file === file ? { ...c, ...patch } : c)),
    })),
  setIsRunning: (v) => set({ isRunning: v }),
  setView: (v) => set({ view: v }),
  setFilter: (v) => set({ filter: v }),
  setApiKey: (v) => set({ apiKey: v }),
  setModel: (v) => set({ model: v }),
  setInstructions: (v) => set({ instructions: v }),
  setModalClip: (file) => set({ modalClip: file }),

  filteredClips: () => {
    const { clips, filter } = get()
    if (filter === 'done') return clips.filter((c) => c.status === 'done')
    if (filter === 'pending') return clips.filter((c) => c.status !== 'done')
    return clips
  },

  doneCounts: () => {
    const { clips } = get()
    const done = clips.filter((c) => c.status === 'done').length
    return { done, pending: clips.length - done, total: clips.length }
  },
}))
