import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Download, Loader2, Pencil, Play } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { CATEGORIES, playlistAction, type Category, type LibraryItem } from '@/lib/library'
import { getApi, useSession } from '@/state/session'
import { selectedItems, selectionCount, useWizard } from '@/state/wizard'
import { downloadJson } from '@/lib/download'
import { AccountChip } from './AccountChip'
import { CategoryIcon } from './CategoryIcon'
import { accountName } from './format'
import { libraryQuery } from './library-query'
import { startRun } from './run-controller'

export function StepReview() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const accounts = useSession((s) => s.accounts)
  const selection = useWizard((s) => s.selection)
  const options = useWizard((s) => s.options)
  const setOption = useWizard((s) => s.setOption)
  const goTo = useWizard((s) => s.goTo)
  const [exporting, setExporting] = useState<{ done: number; total: number } | null>(null)

  const items = selectedItems(selection)
  const total = selectionCount(selection)
  const playlists = items.playlists ?? []
  const sourceId = accounts.old?.profile.id ?? ''
  const copyCount = playlists.filter((p) => playlistAction(p, sourceId) === 'copy').length
  const trackCount = items.tracks?.length ?? 0

  if (!accounts.old || !accounts.new) return null
  const oldAccount = accounts.old
  const newAccount = accounts.new

  async function exportBackup() {
    setExporting({ done: 0, total: 0 })
    try {
      // Only needed by the few who export, so it's loaded on demand.
      const { buildBackup } = await import('@/transfer/export')
      const library: Partial<Record<Category, LibraryItem[]>> = {}
      for (const c of CATEGORIES) {
        library[c] = await queryClient.fetchQuery(libraryQuery(oldAccount.profile.id, c))
      }
      const backup = await buildBackup(
        library,
        oldAccount.profile,
        getApi('old'),
        __APP_VERSION__,
        (done, n) => setExporting({ done, total: n }),
      )
      const date = new Date().toISOString().slice(0, 10)
      downloadJson(backup, `trikatuka-backup-${oldAccount.profile.id}-${date}.json`)
      toast.success(t('review.exportDone'))
    } catch (e) {
      toast.error(t('review.exportFailed', { message: e instanceof Error ? e.message : String(e) }))
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('review.title')}</h1>

      <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <Card className="py-4">
          <CardContent className="space-y-1.5 px-4">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t('review.from')}
            </p>
            <AccountChip profile={oldAccount.profile} />
          </CardContent>
        </Card>
        <ArrowRight className="text-primary mx-auto size-5 rotate-90 sm:rotate-0" aria-hidden />
        <Card className="py-4">
          <CardContent className="space-y-1.5 px-4">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t('review.to')}
            </p>
            <AccountChip profile={newAccount.profile} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('review.whatTitle')}</CardTitle>
          <CardAction>
            <Button variant="ghost" size="sm" onClick={() => goTo('select')}>
              <Pencil />
              {t('review.edit')}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((c) => {
              const n = items[c]?.length ?? 0
              return (
                <li
                  key={c}
                  className={`flex items-center gap-3 rounded-lg border p-3 ${n === 0 ? 'border-dashed' : ''}`}
                >
                  <span className="bg-accent text-accent-foreground grid size-9 place-items-center rounded-md">
                    <CategoryIcon category={c} />
                  </span>
                  <div>
                    <p
                      className={`text-lg leading-tight font-semibold tabular-nums ${n === 0 ? 'text-muted-foreground' : ''}`}
                    >
                      {n}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {t(`categories.${c}`)}
                      {c === 'playlists' && n > 0 && (
                        <>
                          {' '}
                          ·{' '}
                          {t('review.playlistsBreakdown', {
                            copy: copyCount,
                            follow: n - copyCount,
                          })}
                        </>
                      )}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('review.optionsTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <OptionRow
            id="opt-skip"
            label={t('review.skipDuplicates')}
            hint={t('review.skipDuplicatesHint')}
            checked={options.skipDuplicates}
            onChange={(v) => setOption('skipDuplicates', v)}
          />
          <OptionRow
            id="opt-order"
            label={t('review.keepOrder')}
            hint={t('review.keepOrderHint', { minutes: Math.max(1, Math.ceil(trackCount / 60)) })}
            checked={options.keepOrder}
            disabled={trackCount === 0}
            onChange={(v) => setOption('keepOrder', v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('review.exportTitle')}</CardTitle>
          <CardDescription>{t('review.exportBody')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => void exportBackup()}
            disabled={Boolean(exporting)}
          >
            {exporting ? <Loader2 className="animate-spin" /> : <Download />}
            {exporting ? t('review.exporting', exporting) : t('review.exportButton')}
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => goTo('select')}>
          <ArrowLeft />
          {t('connect.back')}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="lg" disabled={total === 0}>
              <Play />
              {t('review.start')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('review.confirmTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('review.confirmBody', { count: total, name: accountName(newAccount.profile) })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('review.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={() => void startRun()}>
                {t('review.start')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}

function OptionRow(props: {
  id: string
  label: string
  hint: string
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={props.id} className={`space-y-0.5 ${props.disabled ? 'opacity-50' : ''}`}>
        <span className="block font-medium">{props.label}</span>
        <span className="text-muted-foreground block text-sm">{props.hint}</span>
      </label>
      <Switch
        id={props.id}
        checked={props.checked && !props.disabled}
        disabled={props.disabled}
        onCheckedChange={props.onChange}
      />
    </div>
  )
}
