import { environment } from '../../environments/environment';
import type { AppEnvironment } from '../../environments/environment.model';

/**
 * Google AdSense configuration, from `adsense` in src/environments/. Ads are off unless
 * `enabled` is true and both IDs are valid.
 */
export interface AdsConfig {
  /** Publisher ID, e.g. `ca-pub-1234567890123456`. */
  client: string;
  /** Ad unit (slot) ID, digits only. */
  slot: string;
  /** Request non-personalized ads only. */
  nonPersonalized: boolean;
}

const CLIENT = /^ca-pub-\d{10,20}$/;
const SLOT = /^\d{5,20}$/;

export function readAdsConfig(settings: AppEnvironment['adsense']): AdsConfig | null {
  if (!settings.enabled) return null;
  const client = settings.client.trim();
  const slot = settings.slot.trim();
  if (!CLIENT.test(client) || !SLOT.test(slot)) {
    console.warn(
      'AdSense is enabled but adsense.client / adsense.slot are missing or invalid: ads stay off.',
    );
    return null;
  }
  return { client, slot, nonPersonalized: settings.nonPersonalized };
}

export const adsConfig = readAdsConfig(environment.adsense);
