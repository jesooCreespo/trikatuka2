import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Info, Loader2, LogOut } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { startLogin } from '@/lib/spotify/auth'
import type { Slot } from '@/lib/spotify/types'
import { apiForAuth, useSession } from '@/state/session'
import { useWizard } from '@/state/wizard'
import { AccountChip } from './AccountChip'

export function StepConnect({ slot }: { slot: Slot }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const account = useSession((s) => s.accounts[slot])
  const other = useSession((s) => s.accounts[slot === 'old' ? 'new' : 'old'])
  const setAccount = useSession((s) => s.setAccount)
  const signOut = useSession((s) => s.signOut)
  const goTo = useWizard((s) => s.goTo)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isOld = slot === 'old'
  const sameAsOther = account && other && account.profile.id === other.profile.id

  async function login() {
    setError(null)
    setBusy(true)
    try {
      const auth = await startLogin(slot)
      const profile = await apiForAuth(auth).me()
      if (isOld && profile.id !== account?.profile.id) {
        // A different source account: the old selection and cached library no longer apply.
        useWizard.getState().clearSelection()
        queryClient.removeQueries({ queryKey: ['library'] })
      }
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
    <div className="mx-auto max-w-xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>
            <h1 className="text-2xl tracking-tight">
              {isOld ? t('connect.oldTitle') : t('connect.newTitle')}
            </h1>
          </CardTitle>
          <CardDescription>{isOld ? t('connect.oldBody') : t('connect.newBody')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {account ? (
            <div className="bg-muted/40 flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="text-muted-foreground mb-1.5 text-xs">{t('connect.connectedAs')}</p>
                <AccountChip profile={account.profile} />
              </div>
              <Button variant="outline" size="sm" onClick={() => signOut(slot)}>
                <LogOut />
                {t('connect.signOut')}
              </Button>
            </div>
          ) : (
            <Button size="lg" className="w-full" onClick={() => void login()} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {busy ? t('connect.signingIn') : t('connect.signIn')}
            </Button>
          )}
          {sameAsOther && (
            <p
              role="alert"
              className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border p-3 text-sm"
            >
              {t('connect.sameAccount')}
            </p>
          )}
          {error && !account && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
        </CardContent>
        <CardFooter className="justify-between gap-2">
          {isOld ? (
            <span />
          ) : (
            <Button variant="ghost" onClick={() => goTo('connect-old')}>
              <ArrowLeft />
              {t('connect.back')}
            </Button>
          )}
          <Button
            onClick={() => goTo(isOld ? 'connect-new' : 'select')}
            disabled={!account || Boolean(sameAsOther)}
          >
            {t('connect.continue')}
            <ArrowRight />
          </Button>
        </CardFooter>
      </Card>

      {!isOld && (
        <div className="bg-card flex gap-3 rounded-lg border p-4 text-sm">
          <Info className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium">{t('connect.tipTitle')}</p>
            <p className="text-muted-foreground">{t('connect.tip')}</p>
          </div>
        </div>
      )}
    </div>
  )
}
