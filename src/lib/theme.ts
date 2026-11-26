import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemePreference = 'system' | 'light' | 'dark'

interface ThemeState {
  preference: ThemePreference
  setPreference: (preference: ThemePreference) => void
}

const media = () => window.matchMedia('(prefers-color-scheme: dark)')

export function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference !== 'system') return preference
  return media().matches ? 'dark' : 'light'
}

function apply(preference: ThemePreference) {
  document.documentElement.classList.toggle('dark', resolveTheme(preference) === 'dark')
}

export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      preference: 'system',
      setPreference: (preference) => {
        apply(preference)
        set({ preference })
      },
    }),
    {
      name: 'trikatuka:theme',
      version: 1,
      onRehydrateStorage: () => (state) => apply(state?.preference ?? 'system'),
    },
  ),
)

/** Keeps the page in sync with the OS setting while the preference is "system". */
export function watchSystemTheme() {
  const listener = () => {
    if (useTheme.getState().preference === 'system') apply('system')
  }
  media().addEventListener('change', listener)
  return () => media().removeEventListener('change', listener)
}
