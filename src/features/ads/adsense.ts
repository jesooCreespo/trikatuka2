import type { AdsConfig } from './config'

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>> & { requestNonPersonalizedAds?: number }
  }
}

export const ADSENSE_SCRIPT = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'

/** Adds the AdSense script once; nothing is loaded from Google while ads are off. */
export function loadAdSense({ client, nonPersonalized }: AdsConfig) {
  if (document.querySelector(`script[src^="${ADSENSE_SCRIPT}"]`)) return
  const queue = (window.adsbygoogle ??= [])
  // Must be set before the first ad request.
  if (nonPersonalized) queue.requestNonPersonalizedAds = 1
  const script = document.createElement('script')
  script.async = true
  script.crossOrigin = 'anonymous'
  script.src = `${ADSENSE_SCRIPT}?client=${encodeURIComponent(client)}`
  document.head.appendChild(script)
}
