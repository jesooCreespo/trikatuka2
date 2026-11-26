import { computed, Service } from '@angular/core';
import { persistedSignal } from './persisted-signal';

export type ThemePreference = 'system' | 'light' | 'dark';

/** Light/dark theme: follows the OS unless the user picks one. Applied as `.dark` on <html>. */
@Service()
export class Theme {
  private readonly media = window.matchMedia('(prefers-color-scheme: dark)');
  private readonly state = persistedSignal(() => localStorage, 'trikatuka:theme', 1, {
    preference: 'system' as ThemePreference,
  });

  readonly preference = computed(() => this.state().preference);

  constructor() {
    this.apply();
    this.media.addEventListener('change', () => this.apply());
  }

  set(preference: ThemePreference) {
    this.state.set({ preference });
    this.apply();
  }

  private apply() {
    const pref = this.preference();
    const dark = pref === 'dark' || (pref === 'system' && this.media.matches);
    document.documentElement.classList.toggle('dark', dark);
  }
}
