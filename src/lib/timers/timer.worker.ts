/**
 * Dedicated worker that runs timers for the page (see `worker-sleep.ts`). Browsers throttle chained
 * timers in hidden tabs (Chrome: at most once per minute after ~5 minutes hidden); timers in a
 * dedicated worker are not subject to that throttling.
 *
 * Typed without the `webworker` lib on purpose: this file is compiled with the app's DOM lib.
 */
import type { TimerRequest, TimerResponse } from './protocol';

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<TimerRequest>) => void) | null;
  postMessage(message: TimerResponse): void;
};
const timers = new Map<number, ReturnType<typeof setTimeout>>();

scope.onmessage = ({ data: { id, ms } }) => {
  clearTimeout(timers.get(id));
  timers.delete(id);
  if (ms < 0) return;
  timers.set(
    id,
    setTimeout(() => {
      timers.delete(id);
      scope.postMessage({ id });
    }, ms),
  );
};
