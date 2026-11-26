import { inject, Service, signal } from '@angular/core';
import { runTransfer, type ItemResult } from '@/transfer/engine';
import { I18n } from '@/i18n/i18n';
import { workerSleep } from '@/lib/timers/worker-sleep';
import { keepScreenAwake } from '@/lib/wake-lock';
import { Session } from './session';
import { Toasts } from './toasts';
import { Wizard } from './wizard';

/**
 * Runs a transfer outside any component, so navigation or re-renders can't restart or orphan it.
 * Progress is pushed to the wizard store at most every 150 ms. While it runs, the screen is kept
 * awake (when the browser allows it) and the pauses between writes run in a worker, so they aren't
 * throttled when the tab is in the background.
 */
@Service()
export class RunController {
  private readonly session = inject(Session);
  private readonly wizard = inject(Wizard);
  private readonly toasts = inject(Toasts);
  private readonly i18n = inject(I18n);
  private controller: AbortController | null = null;

  readonly running = signal(false);
  readonly stopping = signal(false);

  async start() {
    const { old: source, new: target } = this.session.accounts();
    if (this.running() || !source || !target) return;

    this.controller = new AbortController();
    this.running.set(true);
    this.stopping.set(false);
    this.wizard.setResults([]);
    this.wizard.goTo('run');

    const updates = throttled((r: ItemResult[]) => this.wizard.setResults(r));
    const releaseWakeLock = keepScreenAwake();
    try {
      const results = await runTransfer(this.wizard.selectedItems(), this.wizard.options(), {
        source: this.session.api('old'),
        target: this.session.api('new'),
        sourceUserId: source.profile.id,
        targetUserId: target.profile.id,
        signal: this.controller.signal,
        onUpdate: updates.push,
        sleep: workerSleep,
      });
      updates.flush();
      this.wizard.setResults(results);
    } catch (error) {
      updates.flush();
      this.toasts.error(error instanceof Error ? error.message : String(error));
    } finally {
      releaseWakeLock();
      this.controller = null;
      this.running.set(false);
      this.stopping.set(false);
      this.wizard.goTo('report');
    }
  }

  stop() {
    if (!this.controller) return;
    this.stopping.set(true);
    this.controller.abort(new DOMException(this.i18n.t('run.stopping'), 'AbortError'));
  }
}

function throttled(fn: (r: ItemResult[]) => void, ms = 150) {
  let last = 0;
  let pending: ItemResult[] | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    timer = null;
    last = Date.now();
    if (pending) fn(pending);
    pending = null;
  };
  return {
    push(r: ItemResult[]) {
      pending = r;
      if (timer) return;
      timer = setTimeout(flush, Math.max(0, ms - (Date.now() - last)));
    },
    flush() {
      if (timer) clearTimeout(timer);
      flush();
    },
  };
}
