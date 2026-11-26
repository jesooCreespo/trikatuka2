import { Info, Loader2, Square } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CATEGORIES, type Category } from '@/lib/library'
import { useWizard } from '@/state/wizard'
import type { ItemResult } from '@/transfer/engine'
import { CategoryIcon } from './CategoryIcon'
import { RunDetails } from './RunDetails'
import { stopRun, useRun } from './run-controller'

const isDone = (s: string) => s !== 'pending' && s !== 'running'

/** One pass over the results (they can be thousands and update several times a second). */
function progressOf(results: ItemResult[]) {
  const totals = new Map<Category, { total: number; done: number }>()
  let done = 0
  let current: ItemResult | undefined
  for (const r of results) {
    const entry = totals.get(r.item.category) ?? { total: 0, done: 0 }
    entry.total++
    if (isDone(r.status)) {
      entry.done++
      done++
    } else if (r.status === 'running') {
      current ??= r
    }
    totals.set(r.item.category, entry)
  }
  const perCategory = CATEGORIES.flatMap((category) => {
    const entry = totals.get(category)
    return entry ? [{ category, ...entry }] : []
  })
  return { perCategory, done, current }
}

export function StepRun() {
  const { t } = useTranslation()
  const results = useWizard((s) => s.results)
  const stopping = useRun((s) => s.stopping)
  // "Keep order" saves liked songs one per second: tell the user why it is slow.
  const slowByDesign = useWizard(
    (s) => s.options.keepOrder && Object.keys(s.selection.tracks).length > 0,
  )

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  const { perCategory, done, current } = useMemo(() => progressOf(results), [results])
  const pct = results.length ? (done / results.length) * 100 : 0
  // With "keep order", liked songs go one per second (plus the request itself), so the remaining
  // time can be estimated. Other transfers are too fast or too variable to estimate.
  const keepOrder = useWizard((s) => s.options.keepOrder)
  const etaMinutes = useMemo(() => {
    if (!keepOrder) return 0
    const remaining = results.filter(
      (r) => r.item.category === 'tracks' && (r.status === 'pending' || r.status === 'running'),
    ).length
    return remaining ? Math.ceil((remaining * 1.2) / 60) : 0
  }, [keepOrder, results])

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>
          <h1 className="flex items-center gap-2 text-2xl tracking-tight">
            <Loader2 className="text-primary size-6 animate-spin" aria-hidden />
            {t('run.title')}
          </h1>
        </CardTitle>
        <CardDescription>{t('run.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {slowByDesign && (
          <div className="flex gap-3 rounded-lg border p-4 text-sm">
            <Info className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="space-y-1">
              <p className="font-medium">{t('run.keepOrderTitle')}</p>
              <p className="text-muted-foreground">{t('run.keepOrderNote')}</p>
            </div>
          </div>
        )}
        <div className="space-y-2" role="status" aria-live="polite">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground truncate">
              {current ? t('run.current', { name: current.item.name }) : t('run.preparing')}
            </span>
            <span className="shrink-0 font-medium tabular-nums">
              {t('run.overall', { done, total: results.length })}
            </span>
          </div>
          <Progress value={pct} className="h-3" aria-label={t('run.overallLabel')} />
          {etaMinutes > 0 && (
            <p className="text-muted-foreground text-xs">{t('run.eta', { count: etaMinutes })}</p>
          )}
        </div>

        <ul className="space-y-3">
          {perCategory.map(({ category, total, done }) => (
            <li key={category} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <CategoryIcon category={category} className="text-muted-foreground" />
                  {t(`categories.${category}`)}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {t('run.overall', { done, total })}
                </span>
              </div>
              <Progress
                value={(done / total) * 100}
                className="h-1.5"
                aria-label={t(`categories.${category}`)}
              />
            </li>
          ))}
        </ul>

        <RunDetails results={results} />

        <div className="flex justify-end">
          <Button variant="outline" onClick={stopRun} disabled={stopping}>
            {stopping ? <Loader2 className="animate-spin" /> : <Square />}
            {stopping ? t('run.stopping') : t('run.stop')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
