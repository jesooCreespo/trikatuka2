import { inject, Service, signal, type Signal, type WritableSignal } from '@angular/core';
import { loadCategory, type Category, type LibraryItem } from '@/lib/library';
import { Session } from './session';

export interface CategoryState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  items: LibraryItem[];
  progress: { loaded: number; total: number } | null;
}

const idle = (): CategoryState => ({ status: 'idle', items: [], progress: null });

/**
 * The old account's library, loaded one category at a time on demand and kept for the session
 * (libraries are big and rarely change while the app is open). `refresh` reloads a category.
 */
@Service()
export class LibraryStore {
  private readonly session = inject(Session);
  private readonly states = new Map<string, WritableSignal<CategoryState>>();
  private readonly pending = new Map<string, Promise<LibraryItem[]>>();

  private key(category: Category) {
    return `${this.session.accounts().old?.profile.id ?? ''}:${category}`;
  }

  private stateFor(category: Category): WritableSignal<CategoryState> {
    const key = this.key(category);
    let state = this.states.get(key);
    if (!state) {
      state = signal(idle());
      this.states.set(key, state);
    }
    return state;
  }

  /** State of a category (pure read: safe inside `computed`). */
  category(category: Category): Signal<CategoryState> {
    return this.stateFor(category).asReadonly();
  }

  /** Starts loading a category the first time it's needed. */
  ensureLoaded(category: Category) {
    if (this.stateFor(category)().status === 'idle')
      void this.load(category).catch(() => {
        // The error is shown through the category state.
      });
  }

  /** Resolves with the whole category, loading it if needed (used by the backup). */
  load(category: Category, force = false): Promise<LibraryItem[]> {
    const key = this.key(category);
    const state = this.stateFor(category);
    if (!force && state().status === 'ready') return Promise.resolve(state().items);
    const inFlight = this.pending.get(key);
    if (inFlight && !force) return inFlight;

    state.update((s) => ({ ...s, status: 'loading', progress: null }));
    const promise = loadCategory(this.session.api('old'), category, (loaded, total) =>
      state.update((s) => ({ ...s, progress: { loaded, total } })),
    )
      .then((items) => {
        state.set({ status: 'ready', items, progress: null });
        return items;
      })
      .catch((error: unknown) => {
        state.set({ status: 'error', items: [], progress: null });
        throw error;
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, promise);
    promise.catch(() => {
      // Handled by callers and by the state above; avoids an unhandled rejection.
    });
    return promise;
  }

  refresh(category: Category) {
    void this.load(category, true).catch(() => {
      // The error is shown through the category state.
    });
  }

  /** Forget everything (another source account was connected). */
  clear() {
    this.states.clear();
    this.pending.clear();
  }
}
