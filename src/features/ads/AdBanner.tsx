import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { loadAdSense } from './adsense'
import { adsConfig, type AdsConfig } from './config'

/** A responsive AdSense unit. Renders nothing unless ads are enabled in the configuration. */
export function AdBanner({
  config = adsConfig,
  className,
}: {
  config?: AdsConfig | null
  className?: string
}) {
  const { t } = useTranslation()
  const ref = useRef<HTMLModElement>(null)

  useEffect(() => {
    const ins = ref.current
    if (!config || !ins) return
    loadAdSense(config)
    // Each <ins> may be filled only once (StrictMode runs effects twice in development).
    if (ins.dataset.adsbygoogleStatus || ins.dataset.trikatukaRequested) return
    ins.dataset.trikatukaRequested = 'true'
    try {
      ;(window.adsbygoogle ??= []).push({})
    } catch {
      // Ad blockers or AdSense errors must never break the app.
    }
  }, [config])

  if (!config) return null

  return (
    <aside className={cn('mx-auto w-full max-w-4xl px-4', className)} aria-label={t('ads.label')}>
      <p className="text-muted-foreground mb-1 text-[0.7rem] tracking-wide uppercase">
        {t('ads.label')}
      </p>
      <ins
        ref={ref}
        className="adsbygoogle block min-h-[90px]"
        data-ad-client={config.client}
        data-ad-slot={config.slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  )
}
