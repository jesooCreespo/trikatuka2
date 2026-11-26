import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, Route, Routes } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { Wizard } from '@/features/wizard/Wizard'

const Help = lazy(() => import('@/pages/Help').then((m) => ({ default: m.Help })))
const Privacy = lazy(() => import('@/pages/Privacy').then((m) => ({ default: m.Privacy })))

export function App() {
  const { t } = useTranslation()
  return (
    <TooltipProvider delayDuration={300}>
      <a
        href="#main"
        className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:px-3 focus:py-2"
      >
        {t('app.skipToContent')}
      </a>
      <div className="flex min-h-dvh flex-col">
        <Header />
        <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:py-10">
          <Routes>
            <Route path="/" element={<Wizard />} />
            <Route
              path="/help"
              element={
                <Suspense fallback={null}>
                  <Help />
                </Suspense>
              }
            />
            <Route
              path="/privacy"
              element={
                <Suspense fallback={null}>
                  <Privacy />
                </Suspense>
              }
            />
            {/* Old address of the policy, possibly linked from elsewhere. */}
            <Route path="/privacypolicy.html" element={<Navigate to="/privacy" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Footer />
      </div>
      <Toaster richColors closeButton position="top-center" />
    </TooltipProvider>
  )
}
