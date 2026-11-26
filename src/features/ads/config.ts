/**
 * Google AdSense configuration, read from the VITE_ADSENSE_* environment variables.
 * Ads are off unless VITE_ADSENSE_ENABLED is "true" and both IDs are valid.
 */

export interface AdsConfig {
  /** Publisher ID, e.g. `ca-pub-1234567890123456`. */
  client: string
  /** Ad unit (slot) ID, digits only. */
  slot: string
  /** Request non-personalized ads only. */
  nonPersonalized: boolean
}

type Env = Partial<Record<string, string | boolean | undefined>>

const CLIENT = /^ca-pub-\d{10,20}$/
const SLOT = /^\d{5,20}$/

const isTrue = (value: Env[string]) => value === true || String(value).toLowerCase() === 'true'

export function readAdsConfig(env: Env = import.meta.env): AdsConfig | null {
  if (!isTrue(env.VITE_ADSENSE_ENABLED)) return null

  const client = String(env.VITE_ADSENSE_CLIENT ?? '').trim()
  const slot = String(env.VITE_ADSENSE_SLOT ?? '').trim()
  if (!CLIENT.test(client) || !SLOT.test(slot)) {
    console.warn(
      'AdSense is enabled but VITE_ADSENSE_CLIENT / VITE_ADSENSE_SLOT are missing or invalid: ads stay off.',
    )
    return null
  }
  return { client, slot, nonPersonalized: isTrue(env.VITE_ADSENSE_NON_PERSONALIZED) }
}

export const adsConfig = readAdsConfig()
