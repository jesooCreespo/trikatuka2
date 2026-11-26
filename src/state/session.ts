import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { createSpotifyClient } from '@/lib/spotify/client'
import { createApi, type SpotifyApi } from '@/lib/spotify/endpoints'
import type { AuthData, Slot, UserProfile } from '@/lib/spotify/types'

export interface Account {
  auth: AuthData
  profile: UserProfile
}

interface SessionState {
  accounts: Partial<Record<Slot, Account>>
  setAccount: (slot: Slot, account: Account) => void
  setAuth: (slot: Slot, auth: AuthData) => void
  signOut: (slot: Slot) => void
  /** Exchanges the two accounts, with their tokens: no new login. */
  swap: () => void
}

/** Connected accounts. Kept in sessionStorage (per tab, cleared when the tab closes). */
export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      accounts: {},
      setAccount: (slot, account) => set((s) => ({ accounts: { ...s.accounts, [slot]: account } })),
      setAuth: (slot, auth) =>
        set((s) => {
          const account = s.accounts[slot]
          return account ? { accounts: { ...s.accounts, [slot]: { ...account, auth } } } : s
        }),
      swap: () => set(({ accounts }) => ({ accounts: { old: accounts.new, new: accounts.old } })),
      signOut: (slot) =>
        set((s) => {
          const accounts = { ...s.accounts }
          delete accounts[slot]
          return { accounts }
        }),
    }),
    {
      name: 'trikatuka:session',
      // Bump when the persisted shape changes; older data is then discarded.
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
)

const apis: Partial<Record<Slot, SpotifyApi>> = {}

/** API bound to one slot; reads the current token from the store on every request. */
export function getApi(slot: Slot): SpotifyApi {
  apis[slot] ??= createApi(
    createSpotifyClient({
      getAuth: () => useSession.getState().accounts[slot]?.auth ?? null,
      setAuth: (auth) => useSession.getState().setAuth(slot, auth),
      onAuthLost: () => useSession.getState().signOut(slot),
    }),
  )
  return apis[slot]
}

/** Used right after login, before the account is in the store. */
export function apiForAuth(auth: AuthData): SpotifyApi {
  let current = auth
  return createApi(
    createSpotifyClient({
      getAuth: () => current,
      setAuth: (fresh) => (current = fresh),
      onAuthLost: () => {},
    }),
  )
}
