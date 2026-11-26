import {
  ChevronDown,
  Circle,
  CircleCheck,
  CircleDashed,
  CircleMinus,
  CircleX,
  LoaderCircle,
  type LucideIcon,
} from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Progress } from '@/components/ui/progress'
import { CATEGORIES, type Category } from '@/lib/library'
import { cn } from '@/lib/utils'
import type { ItemResult, ItemStatus } from '@/transfer/engine'
import { CategoryIcon } from './CategoryIcon'
import { useReasonText } from './format'

const STATUS_ICON: Record<ItemStatus, { Icon: LucideIcon; className: string }> = {
  pending: { Icon: Circle, className: 'text-muted-foreground' },
  running: { Icon: LoaderCircle, className: 'text-primary animate-spin' },
  ok: { Icon: CircleCheck, className: 'text-success' },
  skipped: { Icon: CircleMinus, className: 'text-muted-foreground' },
  failed: { Icon: CircleX, className: 'text-destructive' },
  cancelled: { Icon: CircleDashed, className: 'text-warning' },
}

const isDone = (status: ItemStatus) => status !== 'pending' && status !== 'running'

/** One row: status, name and either the current phase (with a bar) or the outcome. */
function RunItem({ result }: { result: ItemResult }) {
  const { t } = useTranslation()
  const reasonText = useReasonText()
  const { Icon, className } = STATUS_ICON[result.status]
  const p = result.status === 'running' ? result.progress : undefined
  const phase = !p
    ? null
    : p.phase === 'creating'
      ? { text: t('run.phaseCreating'), percent: null }
      : {
          text: t(p.phase === 'reading' ? 'run.phaseReading' : 'run.phaseAdding', {
            done: p.done,
            total: p.total,
          }),
          percent: p.total ? (p.done / p.total) * 100 : null,
        }
  const detail = reasonText(result)

  return (
    <div className="flex items-start gap-3 px-3 py-2">
      <Icon className={cn('mt-0.5 size-4 shrink-0', className)} aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-sm font-medium">
          {result.item.name}
          <span className="sr-only">: {t(`itemStatus.${result.status}`)}</span>
        </p>
        {phase ? (
          <>
            <p className="text-muted-foreground text-xs tabular-nums">{phase.text}</p>
            {phase.percent !== null && (
              <Progress value={phase.percent} className="h-1" aria-label={phase.text} />
            )}
          </>
        ) : detail ? (
          <p className="text-muted-foreground truncate text-xs">{detail}</p>
        ) : null}
      </div>
    </div>
  )
}

/** Per-item progress, grouped by category in collapsible sections (playlists open). */
export function RunDetails({ results }: { results: ItemResult[] }) {
  const { t } = useTranslation()
  const groups = useMemo(() => {
    const byCategory = new Map<Category, ItemResult[]>()
    for (const r of results) {
      const list = byCategory.get(r.item.category) ?? []
      list.push(r)
      byCategory.set(r.item.category, list)
    }
    return CATEGORIES.flatMap((category) => {
      const items = byCategory.get(category)
      return items ? [{ category, items, done: items.filter((r) => isDone(r.status)).length }] : []
    })
  }, [results])

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">{t('run.detailsTitle')}</h2>
      {groups.map((group) => (
        <details
          key={group.category}
          className="group rounded-lg border"
          open={group.category === 'playlists'}
        >
          <summary className="focus-visible:ring-ring/50 flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm outline-none focus-visible:ring-3 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <ChevronDown
                className="text-muted-foreground size-4 -rotate-90 transition-transform group-open:rotate-0"
                aria-hidden
              />
              <CategoryIcon category={group.category} className="text-muted-foreground" />
              {t(`categories.${group.category}`)}
            </span>
            <span className="text-muted-foreground tabular-nums">
              {t('run.overall', { done: group.done, total: group.items.length })}
            </span>
          </summary>
          <ul className="max-h-80 divide-y overflow-y-auto border-t">
            {group.items.map((result) => (
              // Sections can hold thousands of rows: skip layout for the off-screen ones.
              <li
                key={result.key}
                className="[contain-intrinsic-size:auto_3rem] [content-visibility:auto]"
              >
                <RunItem result={result} />
              </li>
            ))}
          </ul>
        </details>
      ))}
    </section>
  )
}
