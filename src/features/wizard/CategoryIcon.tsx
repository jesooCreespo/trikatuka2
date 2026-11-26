import { Disc3, Heart, ListMusic, Mic2, Podcast } from 'lucide-react'
import type { Category } from '@/lib/library'
import { cn } from '@/lib/utils'

const ICONS = {
  playlists: ListMusic,
  tracks: Heart,
  albums: Disc3,
  artists: Mic2,
  shows: Podcast,
} as const

export function CategoryIcon({ category, className }: { category: Category; className?: string }) {
  const Icon = ICONS[category]
  return <Icon className={cn('size-4', className)} aria-hidden />
}
