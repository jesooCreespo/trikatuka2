import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CATEGORIES } from '@/lib/library'
import { selectionCount, useWizard } from '@/state/wizard'
import { CategoryPanel } from './CategoryPanel'
import { CategoryIcon } from './CategoryIcon'

export function StepSelect() {
  const { t } = useTranslation()
  const selection = useWizard((s) => s.selection)
  const goTo = useWizard((s) => s.goTo)
  const total = selectionCount(selection)

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('select.title')}</h1>
        <p className="text-muted-foreground">{t('select.subtitle')}</p>
      </div>

      <Tabs defaultValue="playlists" className="gap-4">
        <TabsList className="h-10 w-full justify-start overflow-x-auto overflow-y-hidden">
          {CATEGORIES.map((c) => {
            const n = Object.keys(selection[c]).length
            return (
              <TabsTrigger key={c} value={c} className="flex-none gap-1.5 px-3 py-1.5">
                <CategoryIcon category={c} />
                {t(`categories.${c}`)}
                {n > 0 && (
                  <Badge
                    className="h-5 min-w-5 rounded-full px-1.5 tabular-nums"
                    aria-label={t('select.selectedCount', { count: n })}
                  >
                    {n}
                  </Badge>
                )}
              </TabsTrigger>
            )
          })}
        </TabsList>
        {CATEGORIES.map((c) => (
          <TabsContent key={c} value={c}>
            <CategoryPanel category={c} />
          </TabsContent>
        ))}
      </Tabs>

      <div className="bg-background/90 sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t px-4 py-3 backdrop-blur">
        <Button variant="ghost" onClick={() => goTo('connect')}>
          <ArrowLeft />
          {t('connect.back')}
        </Button>
        <span className="text-muted-foreground text-sm tabular-nums" aria-live="polite">
          {total > 0 ? t('select.totalSelected', { count: total }) : t('select.nothingSelected')}
        </span>
        <Button onClick={() => goTo('review')} disabled={total === 0}>
          {t('connect.continue')}
          <ArrowRight />
        </Button>
      </div>
    </div>
  )
}
