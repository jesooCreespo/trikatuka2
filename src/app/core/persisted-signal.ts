import { signal, type Signal } from '@angular/core';

export interface PersistedSignal<T> extends Signal<T> {
  set(value: T): void;
  update(fn: (value: T) => T): void;
}

/**
 * A signal saved to Web Storage on every change, under a versioned key. Data saved with another
 * version (an older shape) is ignored. Storage errors (private mode, quota) never break the app.
 */
export function persistedSignal<T>(
  storage: () => Storage,
  key: string,
  version: number,
  initial: T,
  /** Shapes what is written, e.g. to drop transient fields. */
  serialize: (value: T) => T = (value) => value,
): PersistedSignal<T> {
  const fullKey = `${key}:v${version}`;
  let start = initial;
  try {
    const raw = storage().getItem(fullKey);
    if (raw) start = { ...initial, ...(JSON.parse(raw) as T) };
  } catch {
    // Missing, unreadable or disabled storage: start fresh.
  }

  const state = signal<T>(start);
  const save = (value: T) => {
    try {
      storage().setItem(fullKey, JSON.stringify(serialize(value)));
    } catch {
      // Not persisted this time.
    }
  };

  const persisted = state.asReadonly() as PersistedSignal<T>;
  persisted.set = (value) => {
    state.set(value);
    save(value);
  };
  persisted.update = (fn) => persisted.set(fn(state()));
  return persisted;
}
