import { ArrowRight, ArrowRightLeft, ArrowUpDown, Info, Loader2, LogOut } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { flushSync } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { prepareLogin, startLogin, type PreparedLogin } from '@/lib/spotify/auth'
import type { Slot } from '@/lib/spotify/types'
import { apiForAuth, useSession } from '@/state/session'
import { useWizard } from '@/state/wizard'
import { AccountChip } from './AccountChip'
import { accountName } from './format'

/** `view-transition-name` must be a CSS identifier; Spotify ids may contain dots. */
const transitionName = (id: string) => `account-${id.replace(/[^\w-]/g, '-')}`

/** One side of the connection: the account we copy from, or the one we copy to. */
function AccountCard({ slot }: { slot: Slot }) {
  const { t } = useTranslation()
  const headingId = useId()
  const account = useSession((s) => s.accounts[slot])
  const setAccount = useSession((s) => s.setAccount)
  const signOut = useSession((s) => s.signOut)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A login is prepared ahead of time so the click can open the popup without awaiting.
  const [prepared, setPrepared] = useState<PreparedLogin | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    prepareLogin(slot).then(
      (p) => !cancelled && setPrepared(p),
      (e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)),
    )
    return () => {
      cancelled = true
    }
  }, [slot, attempt])

  const isOld = slot === 'old'

  async function login() {
    if (!prepared) return
    // Synchronous, first thing in the click handler: see `startLogin`.
    const pending = startLogin(prepared)
    setPrepared(null)
    setAttempt((n) => n + 1)
    setError(null)
    setBusy(true)
    try {
      const auth = await pending
      const profile = await apiForAuth(auth).me()
      // Selections and cached libraries are kept per account, so nothing needs clearing.
      setAccount(slot, { auth, profile })
    } catch (e) {
      const code = e instanceof Error ? e.message : String(e)
      if (code === 'popup-closed') return
      const msg =
        code === 'popup-blocked'
          ? t('connect.popupBlocked')
          : t('connect.loginFailed', { message: code })
      setError(msg)
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="h-full" aria-labelledby={headingId} role="region">
      <CardHeader>
        <CardTitle>
          <h2 id={headingId}>{t(isOld ? 'connect.oldCard' : 'connect.newCard')}</h2>
        </CardTitle>
        <CardDescription>{t(isOld ? 'connect.oldBody' : 'connect.newBody')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {account ? (
          // The transition name follows the account, so a swap animates it across the cards.
          <div
            className="bg-muted/40 flex items-center justify-between gap-3 rounded-lg border p-3"
            style={{ viewTransitionName: transitionName(account.profile.id) }}
          >
            <AccountChip profile={account.profile} />
            <Button variant="outline" size="sm" onClick={() => signOut(slot)}>
              <LogOut />
              {t('connect.signOut')}
            </Button>
          </div>
        ) : (
          <Button
            size="lg"
            className="w-full"
            onClick={() => void login()}
            disabled={busy || !prepared}
          >
            {busy && <Loader2 className="animate-spin" />}
            {busy ? t('connect.signingIn') : t('connect.signIn')}
          </Button>
        )}
        {error && !account && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

/** Step 1: connect both accounts, and swap them if needed. */
export function StepConnect() {
  const { t } = useTranslation()
  const goTo = useWizard((s) => s.goTo)
  const oldId = useSession((s) => s.accounts.old?.profile.id)
  const newId = useSession((s) => s.accounts.new?.profile.id)
  const [announcement, setAnnouncement] = useState('')

  const sameAccount = Boolean(oldId && newId && oldId === newId)
  const canSwap = Boolean(oldId && newId) && !sameAccount

  /**
   * Swaps From and To. Libraries are cached and selections kept per account, so swapping back
   * reloads nothing from Spotify. The cards' accounts trade places with a view transition.
   */
  function swap() {
    if (!canSwap) return
    const apply = () => {
      // Render synchronously, so the view transition captures the new state.
      flushSync(() => {
        useSession.getState().swap()
        // The last results describe the previous direction.
        useWizard.getState().setResults([])
        const { old, new: target } = useSession.getState().accounts
        if (old && target) {
          setAnnouncement(
            t('connect.swapped', {
              from: accountName(old.profile),
              to: accountName(target.profile),
            }),
          )
        }
      })
    }
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (typeof document.startViewTransition === 'function' && !reduceMotion) {
      document.startViewTransition(apply)
    } else {
      apply()
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('connect.title')}</h1>
        <p className="text-muted-foreground">{t('connect.body')}</p>
      </div>

      <div className="grid items-center gap-3 md:grid-cols-[1fr_auto_1fr]">
        <AccountCard slot="old" />
        <Button
          variant="outline"
          size="icon-lg"
          className="mx-auto rounded-full"
          onClick={swap}
          disabled={!canSwap}
          aria-label={t('connect.swap')}
          title={t('connect.swap')}
        >
          <ArrowRightLeft className="hidden md:block" aria-hidden />
          <ArrowUpDown className="md:hidden" aria-hidden />
        </Button>
        <AccountCard slot="new" />
      </div>

      {/* Announces swaps to screen readers. */}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      {sameAccount && (
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border p-3 text-sm"
        >
          {t('connect.sameAccount')}
        </p>
      )}

      <div className="flex justify-end">
        <Button onClick={() => goTo('select')} disabled={!canSwap}>
          {t('connect.continue')}
          <ArrowRight />
        </Button>
      </div>

      <div className="bg-card flex gap-3 rounded-lg border p-4 text-sm">
        <Info className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="space-y-1">
          <p className="font-medium">{t('connect.tipTitle')}</p>
          <p className="text-muted-foreground">{t('connect.tip')}</p>
        </div>
      </div>
    </div>
  )
}
