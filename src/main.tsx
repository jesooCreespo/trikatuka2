import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { App } from './App'
import { i18nReady } from './i18n'
import './index.css'
import { watchSystemTheme } from './lib/theme'
import { installDefaultTrustedTypesPolicy } from './lib/trusted-types'

// Before anything can reach a Trusted Types sink (the timer worker).
installDefaultTrustedTypesPolicy()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Libraries are big and change rarely during a session; reload them only on demand.
      staleTime: Infinity,
      gcTime: 60 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

watchSystemTheme()

function render() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  )
}

// Render once the user's language is loaded (even if loading fails: English is bundled).
void i18nReady.finally(render)
