import { useTranslation } from 'react-i18next'
import type { UserProfile } from '@/lib/spotify/types'
import type { ItemResult } from '@/transfer/engine'

export function accountName(profile: UserProfile) {
  return profile.display_name || profile.id
}

/** Human-readable explanation of an item result. */
export function useReasonText() {
  const { t } = useTranslation()
  return (r: ItemResult) => {
    if (!r.reason) return ''
    if (r.reason === 'result.copied' && r.omitted) {
      return t('result.copiedOmitted', { added: r.added, omitted: r.omitted })
    }
    // Known reasons are i18n keys; anything else is Spotify's own message.
    return r.reason.startsWith('result.') ? t(r.reason, { added: r.added ?? 0 }) : r.reason
  }
}
