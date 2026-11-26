/** The parts of `navigator` and `document` that `keepScreenAwake` uses (so tests can fake them). */
export interface WakeLockEnv {
  navigator?: { wakeLock?: Pick<WakeLock, 'request'> };
  document?: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>;
}

const noop = () => undefined;

const browserEnv = (): WakeLockEnv => ({
  navigator: typeof navigator === 'undefined' ? undefined : navigator,
  document: typeof document === 'undefined' ? undefined : document,
});

/**
 * Asks the browser to keep the screen (and so the machine) awake until the returned function is
 * called, using the Screen Wake Lock API. The browser drops the lock when the page is hidden, so
 * it is requested again whenever the page becomes visible. Best effort: when the API is missing
 * or the request is denied nothing happens, and this never throws.
 */
export function keepScreenAwake(env: WakeLockEnv = browserEnv()): () => void {
  const wakeLock = env.navigator?.wakeLock;
  const doc = env.document;
  if (!wakeLock?.request) return noop;

  let active = true;
  let requesting = false;
  let sentinel: WakeLockSentinel | null = null;

  const acquire = async () => {
    if (!active || requesting || (sentinel && !sentinel.released)) return;
    if (doc && doc.visibilityState !== 'visible') return;
    requesting = true;
    try {
      const lock = await wakeLock.request('screen');
      if (active) sentinel = lock;
      else await lock.release();
    } catch {
      // Denied (e.g. battery saver, permissions policy) or unsupported: just run without it.
    } finally {
      requesting = false;
    }
  };
  const onVisibilityChange = () => void acquire();

  doc?.addEventListener('visibilitychange', onVisibilityChange);
  void acquire();

  return () => {
    if (!active) return;
    active = false;
    doc?.removeEventListener('visibilitychange', onVisibilityChange);
    const lock = sentinel;
    sentinel = null;
    lock?.release().catch(noop);
  };
}
