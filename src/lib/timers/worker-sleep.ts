import { abortableSleep } from '@/lib/spotify/client';
import type { TimerRequest, TimerResponse } from './protocol';

export type Sleep = (ms: number, signal?: AbortSignal) => Promise<void>;

/** The part of `Worker` that `createWorkerSleep` uses (so tests can pass a fake). */
export type TimerWorker = Pick<Worker, 'postMessage' | 'addEventListener'>;

interface Pending {
  deadline: number;
  done: () => void;
  /** Continues the sleep on the main thread when the worker fails. */
  fallBack: (remainingMs: number) => void;
}

/**
 * Builds a sleep with the same contract as `abortableSleep(ms, signal)` (rejects with
 * `signal.reason` on abort) whose timers run in one shared dedicated worker, so they aren't
 * throttled when the tab is hidden. The worker is created on the first call; if it can't be
 * created (no Worker support, e.g. jsdom) or fails later, sleeps fall back to `fallback`.
 */
export function createWorkerSleep(
  createWorker: () => TimerWorker | null,
  fallback: Sleep = abortableSleep,
  now: () => number = Date.now,
): Sleep {
  let worker: TimerWorker | null | undefined;
  let nextId = 1;
  const pending = new Map<number, Pending>();

  function failOver() {
    worker = null;
    const sleeps = [...pending.values()];
    pending.clear();
    for (const p of sleeps) p.fallBack(Math.max(0, p.deadline - now()));
  }

  function getWorker(): TimerWorker | null {
    if (worker !== undefined) return worker;
    try {
      worker = createWorker();
    } catch {
      worker = null;
    }
    worker?.addEventListener('message', (event: MessageEvent<TimerResponse>) => {
      const p = pending.get(event.data.id);
      pending.delete(event.data.id);
      p?.done();
    });
    worker?.addEventListener('error', failOver);
    worker?.addEventListener('messageerror', failOver);
    return worker;
  }

  return (ms, signal) => {
    if (signal?.aborted) return Promise.reject(signal.reason);
    const w = getWorker();
    if (!w) return fallback(ms, signal);

    return new Promise<void>((resolve, reject) => {
      const id = nextId++;
      const cleanUp = () => signal?.removeEventListener('abort', onAbort);
      const onAbort = () => {
        pending.delete(id);
        w.postMessage({ id, ms: -1 } satisfies TimerRequest);
        reject(signal?.reason);
      };
      pending.set(id, {
        deadline: now() + ms,
        done: () => {
          cleanUp();
          resolve();
        },
        fallBack: (remainingMs) => {
          cleanUp();
          fallback(remainingMs, signal).then(resolve, reject);
        },
      });
      signal?.addEventListener('abort', onAbort, { once: true });
      w.postMessage({ id, ms } satisfies TimerRequest);
    });
  };
}

/**
 * `abortableSleep` that isn't throttled in background tabs (Chrome runs chained timers in a tab
 * hidden for 5+ minutes at most once per minute). Uses one shared worker for every sleep.
 */
export const workerSleep: Sleep = createWorkerSleep(() =>
  typeof Worker === 'undefined'
    ? null
    : new Worker(new URL('./timer.worker', import.meta.url), { type: 'module' }),
);
