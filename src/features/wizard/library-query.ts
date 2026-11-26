import { queryOptions, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { loadCategory, type Category } from '@/lib/library'
import { getApi, useSession } from '@/state/session'

type Progress = { loaded: number; total: number } | null

/** Query definition for one category of the old account's library (shared by UI and export). */
export function libraryQuery(
  userId: string,
  category: Category,
  onProgress?: (p: Progress) => void,
) {
  return queryOptions({
    queryKey: ['library', userId, category] as const,
    queryFn: ({ signal }) =>
      loadCategory(
        getApi('old'),
        category,
        (loaded, total) => onProgress?.({ loaded, total }),
        signal,
      ),
  })
}

export function useLibrary(category: Category) {
  const userId = useSession((s) => s.accounts.old?.profile.id)
  const [progress, setProgress] = useState<Progress>(null)
  const query = useQuery({
    ...libraryQuery(userId ?? '', category, setProgress),
    enabled: Boolean(userId),
  })
  return { ...query, progress }
}
