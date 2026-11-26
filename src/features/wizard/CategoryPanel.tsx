import { ChevronLeft, ChevronRight, Inbox, RefreshCw, Search } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { matchesSearch, playlistAction, type Category } from '@/lib/library'
import { cn } from '@/lib/utils'
import { useSession } from '@/state/session'
import { useWizard } from '@/state/wizard'
import { ItemRow } from './ItemRow'
import { useLibrary } from './library-query'

const PAGE_SIZE = 50
type PlaylistFilter = 'all' | 'copy' | 'follow'
const PLAYLIST_FILTERS = [
  { value: 'all', label: 'select.filterAll' },
  { value: 'copy', label: 'select.filterCopy' },
  { value: 'follow', label: 'select.filterFollow' },
] as const satisfies readonly { value: PlaylistFilter; label: string }[]

export function CategoryPanel({ category }: { category: Category }) {
  const { t } = useTranslation()
  const sourceUserId = useSession((s) => s.accounts.old?.profile.id ?? '')
  const { data, isPending, isError, refetch, isFetching, progress } = useLibrary(category)
  const selected = useWizard((s) => s.selection[category])
  const toggle = useWizard((s) => s.toggle)
  const setSelected = useWizard((s) => s.setSelected)

  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [filter, setFilter] = useState<PlaylistFilter>('all')
  const [page, setPage] = useState(1)

  const visible = useMemo(
    () =>
      (data ?? []).filter(
        (item) =>
          matchesSearch(item, deferredQuery) &&
          (filter === 'all' || playlistAction(item, sourceUserId) === filter),
      ),
    [data, deferredQuery, filter, sourceUserId],
  )
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages)
  const pageItems = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const allVisibleSelected = visible.length > 0 && visible.every((i) => selected[i.id])
  const selectedCount = Object.keys(selected).length

  if (isPending) {
    const pct = progress && progress.total ? (progress.loaded / progress.total) * 100 : 0
    return (
      <div className="bg-card space-y-3 rounded-xl border p-6" role="status">
        <p className="text-muted-foreground text-sm">
          {progress ? t('select.loading', progress) : t('select.loadingStart')}
        </p>
        <Progress value={pct} />
        <div className="space-y-2 pt-2">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="bg-muted size-11 animate-pulse rounded-md" />
              <div className="bg-muted h-4 flex-1 animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="bg-card flex flex-col items-center gap-3 rounded-xl border p-10 text-center">
        <p className="text-destructive">{t('select.loadError')}</p>
        <Button variant="outline" onClick={() => void refetch()}>
          <RefreshCw />
          {t('select.retry')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
            placeholder={t('select.search')}
            aria-label={t('select.search')}
            className="pl-9"
          />
        </div>
        {category === 'playlists' && (
          // A filter, not tabs (there are no panels): toggle buttons in a labelled group.
          <div
            role="group"
            aria-label={t('categories.playlists')}
            className="bg-muted inline-flex h-9 items-center rounded-lg p-[3px]"
          >
            {PLAYLIST_FILTERS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => {
                  setFilter(value)
                  setPage(1)
                }}
                className={cn(
                  'focus-visible:ring-ring/50 h-full rounded-md px-3 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:outline-none',
                  filter === value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t(label)}
              </button>
            ))}
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void refetch()}
          disabled={isFetching}
          aria-label={t('select.retry')}
        >
          <RefreshCw className={isFetching ? 'animate-spin' : undefined} />
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Button
          variant="outline"
          size="sm"
          disabled={visible.length === 0}
          onClick={() => setSelected(category, visible, !allVisibleSelected)}
        >
          {allVisibleSelected
            ? t('select.clearShown')
            : t('select.selectAllShown', { count: visible.length })}
        </Button>
        <span className="text-muted-foreground tabular-nums">
          {t('select.selectedCount', { count: selectedCount })}
        </span>
      </div>

      {pageItems.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center">
          <Inbox className="size-8" aria-hidden />
          <p>
            {deferredQuery ? t('select.noMatches', { query: deferredQuery }) : t('select.empty')}
          </p>
        </div>
      ) : (
        <ul className="bg-card divide-y overflow-hidden rounded-xl border">
          {pageItems.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              checked={Boolean(selected[item.id])}
              onCheckedChange={(v) => toggle(item, v)}
              action={category === 'playlists' ? playlistAction(item, sourceUserId) : undefined}
            />
          ))}
        </ul>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground mr-2 tabular-nums">
            {t('select.page', { page: currentPage, pages })}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
            aria-label={t('select.prev')}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={currentPage >= pages}
            onClick={() => setPage(currentPage + 1)}
            aria-label={t('select.next')}
          >
            <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  )
}
