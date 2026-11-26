import { CircleAlert, CircleCheck, Download, Info, RotateCcw, Plus, OctagonX } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useWizard } from '@/state/wizard'
import { summarize, type ItemStatus } from '@/transfer/engine'
import { downloadJson } from '@/lib/download'
import { useReasonText } from './format'
import { Cover } from './ItemRow'

const TILES: { status: ItemStatus; className: string }[] = [
  { status: 'ok', className: 'text-success' },
  { status: 'skipped', className: 'text-muted-foreground' },
  { status: 'failed', className: 'text-destructive' },
  { status: 'cancelled', className: 'text-warning' },
]

export function StepReport() {
  const { t } = useTranslation()
  const results = useWizard((s) => s.results)
  const goTo = useWizard((s) => s.goTo)
  const reasonText = useReasonText()
  const counts = useMemo(() => summarize(results), [results])
  const problems = results.filter((r) => r.status === 'failed' || r.status === 'cancelled')

  const title =
    counts.cancelled > 0
      ? t('report.titleStopped')
      : counts.failed > 0
        ? t('report.titleIssues')
        : t('report.titleDone')
  const TitleIcon = counts.cancelled > 0 ? OctagonX : counts.failed > 0 ? CircleAlert : CircleCheck

  function downloadReport() {
    downloadJson(
      {
        app: 'trikatuka',
        appVersion: __APP_VERSION__,
        createdAt: new Date().toISOString(),
        summary: counts,
        items: results.map((r) => ({
          category: r.item.category,
          name: r.item.name,
          uri: r.item.uri,
          status: r.status,
          detail: reasonText(r) || undefined,
        })),
      },
      `trikatuka-report-${new Date().toISOString().slice(0, 10)}.json`,
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TitleIcon
          className={cn(
            'size-8',
            counts.cancelled > 0
              ? 'text-warning'
              : counts.failed > 0
                ? 'text-destructive'
                : 'text-success',
          )}
          aria-hidden
        />
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TILES.map(({ status, className }) => (
          <li key={status} className="bg-card rounded-xl border p-4">
            <p
              className={cn('text-3xl font-semibold tabular-nums', counts[status] > 0 && className)}
            >
              {counts[status]}
            </p>
            <p className="text-muted-foreground text-sm">{t(`status.${status}`)}</p>
          </li>
        ))}
      </ul>

      <div className="bg-card flex gap-3 rounded-lg border p-4 text-sm">
        <Info className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
        <p className="text-muted-foreground">{t('report.spotifyNote')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('report.problems')}</CardTitle>
        </CardHeader>
        <CardContent>
          {problems.length === 0 ? (
            <p className="text-muted-foreground">{t('report.noProblems')}</p>
          ) : (
            <ul className="max-h-96 divide-y overflow-y-auto rounded-lg border">
              {problems.map((r) => (
                <li
                  key={r.key}
                  // The list can hold thousands of rows: skip layout for the off-screen ones.
                  className="flex items-center gap-3 px-3 py-2 [contain-intrinsic-size:auto_3.25rem] [content-visibility:auto]"
                >
                  <Cover item={r.item} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.item.name}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {t(`categories.${r.item.category}`)}
                      {reasonText(r) && ` · ${reasonText(r)}`}
                    </p>
                  </div>
                  <Badge variant={r.status === 'failed' ? 'destructive' : 'secondary'}>
                    {t(r.status === 'failed' ? 'itemStatus.failed' : 'itemStatus.cancelled')}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" onClick={downloadReport}>
          <Download />
          {t('report.download')}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            const wizard = useWizard.getState()
            wizard.clearSelection()
            wizard.setResults([])
            goTo('select')
          }}
        >
          <Plus />
          {t('report.more')}
        </Button>
        {problems.length > 0 && (
          <Button
            onClick={() => {
              useWizard.getState().selectRetryable()
              goTo('review')
            }}
          >
            <RotateCcw />
            {t('report.retry')}
          </Button>
        )}
      </div>
    </div>
  )
}
