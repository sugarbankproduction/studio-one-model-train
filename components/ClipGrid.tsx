// components/ClipGrid.tsx
'use client'
import { useAppStore } from '@/lib/store'
import ClipCard from './ClipCard'

export default function ClipGrid() {
  const filteredClips = useAppStore((s) => s.filteredClips())
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
      gap: 18, padding: '20px 24px',
    }}>
      {filteredClips.map((clip) => (
        <ClipCard key={clip.file} clip={clip} />
      ))}
    </div>
  )
}
