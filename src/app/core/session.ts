import { computed, Service } from '@angular/core';
import { createSpotifyClient } from '@/lib/spotify/client';
import { createApi, type SpotifyApi } from '@/lib/spotify/endpoints';
import type { AuthData, Slot, UserProfile } from '@/lib/spotify/types';
import { persistedSignal } from './persisted-signal';

export interface Account {
  auth: AuthData;
  profile: UserProfile;
}

type Accounts = Partial<Record<Slot, Account>>;

/** Connected accounts, kept in sessionStorage (per tab, cleared when the tab closes). */
@Service()
export class Session {
  private readonly state = persistedSignal(() => sessionStorage, 'trikatuka:session', 1, {
    accounts: {} as Accounts,
  });
  private readonly apis: Partial<Record<Slot, SpotifyApi>> = {};

  readonly accounts = computed(() => this.state().accounts);

  setAccount(slot: Slot, account: Account) {
    this.state.update((s) => ({ accounts: { ...s.accounts, [slot]: account } }));
  }

  setAuth(slot: Slot, auth: AuthData) {
    this.state.update((s) => {
      const account = s.accounts[slot];
      return account ? { accounts: { ...s.accounts, [slot]: { ...account, auth } } } : s;
    });
  }

  signOut(slot: Slot) {
    this.state.update((s) => {
      const accounts = { ...s.accounts };
      delete accounts[slot];
      return { accounts };
    });
  }

  /** API bound to one slot; reads the current token on every request. */
  api(slot: Slot): SpotifyApi {
    this.apis[slot] ??= createApi(
      createSpotifyClient({
        getAuth: () => this.state().accounts[slot]?.auth ?? null,
        setAuth: (auth) => this.setAuth(slot, auth),
        onAuthLost: () => this.signOut(slot),
      }),
    );
    return this.apis[slot];
  }
}

/** Used right after login, before the account is stored. */
export function apiForAuth(auth: AuthData): SpotifyApi {
  let current = auth;
  return createApi(
    createSpotifyClient({
      getAuth: () => current,
      setAuth: (fresh) => (current = fresh),
      onAuthLost: () => {
        // Not stored yet: nothing to sign out.
      },
    }),
  );
}
