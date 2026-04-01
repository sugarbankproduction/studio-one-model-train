// components/ClipList.tsx
'use client'
import { useAppStore } from '@/lib/store'
import ClipListItem from './ClipListItem'

export default function ClipList() {
  const filteredClips = useAppStore((s) => s.filteredClips())
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '16px 24px' }}>
      {filteredClips.map((clip) => (
        <ClipListItem key={clip.file} clip={clip} />
      ))}
    </div>
  )
}
