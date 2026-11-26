import type { CursorPaging, Paging } from './types';

export type ProgressFn = (loaded: number, total: number) => void;

export interface FetchAllOptions {
  /** Pages requested at the same time after the first one (default 3, minimum 1). */
  concurrency?: number;
  /** Once aborted, no further page is requested and the load rejects with `signal.reason`. */
  signal?: AbortSignal;
}

/** Concurrent page reads after the first one; kept low so Spotify doesn't rate limit us. */
export const READ_CONCURRENCY = 3;

function isLastPage(page: Paging<unknown>, offset: number) {
  return page.items.length === 0 || !page.next || offset + page.items.length >= page.total;
}

/**
 * Loads every page of an offset-paginated endpoint, in Spotify's order. The first page gives
 * the total and the page size; the remaining offsets are then read a few at a time
 * (`concurrency`) and reassembled in order. Any failed page rejects the whole load.
 *
 * If the library changes while loading, the first empty, final (`next: null`) or
 * past-the-total page ends the list and the pages after it are dropped; a short page that is
 * not the final one makes the rest load sequentially from where it ended.
 */
export async function fetchAllOffset<T>(
  fetchPage: (offset: number) => Promise<Paging<T>>,
  onProgress?: ProgressFn,
  { concurrency = READ_CONCURRENCY, signal }: FetchAllOptions = {},
): Promise<T[]> {
  signal?.throwIfAborted();
  let lastLoaded = -1;
  let lastTotal = -1;
  // `loaded` never goes back (dropped pages) and never exceeds `total`.
  const report: ProgressFn = (loaded, total) => {
    total = Math.max(total, loaded);
    if (loaded < lastLoaded || (loaded === lastLoaded && total === lastTotal)) return;
    lastLoaded = loaded;
    lastTotal = total;
    onProgress?.(loaded, total);
  };

  const first = await fetchPage(0);
  signal?.throwIfAborted();
  report(first.items.length, first.total);
  if (isLastPage(first, 0)) return first.items;
  const stride = first.limit > 0 ? first.limit : first.items.length;
  if (first.items.length < stride) {
    return fetchSequential(fetchPage, [...first.items], report, signal);
  }

  const maxInFlight = Math.max(1, Math.floor(concurrency));
  const pages: T[][] = [first.items];
  let total = first.total;
  let lastIndex = Infinity; // index of the page that ends the list, once one does
  let endsShort = false; // that page is short but not final: continue sequentially
  let next = 1;
  let inFlight = 0;
  let settled = false;
  const kept = () => pages.slice(0, lastIndex + 1).reduce((n, p) => n + (p?.length ?? 0), 0);

  const complete = await new Promise<boolean>((resolve, reject) => {
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      if (error === undefined) resolve(!endsShort);
      else reject(error);
    };
    const onAbort = () => finish(signal?.reason);
    signal?.addEventListener('abort', onAbort, { once: true });

    const pump = () => {
      if (settled) return;
      while (inFlight < maxInFlight && next <= lastIndex && next * stride < total) {
        launch(next++);
      }
      if (inFlight === 0) finish();
    };

    const launch = (index: number) => {
      const offset = index * stride;
      inFlight++;
      fetchPage(offset).then(
        (page) => {
          inFlight--;
          if (settled || index > lastIndex) return pump();
          pages[index] = page.items;
          total = page.total;
          const final = isLastPage(page, offset);
          if (final || page.items.length < stride) {
            lastIndex = index;
            endsShort = !final;
          }
          report(kept(), total);
          pump();
        },
        (error: unknown) => {
          inFlight--;
          finish(error ?? new Error('Page request failed'));
        },
      );
    };

    pump();
  });

  const items = pages.slice(0, lastIndex + 1).flat();
  return complete ? items : fetchSequential(fetchPage, items, report, signal);
}

/** The plain one-page-at-a-time walk, continuing after `items`. */
async function fetchSequential<T>(
  fetchPage: (offset: number) => Promise<Paging<T>>,
  items: T[],
  report: ProgressFn,
  signal?: AbortSignal,
): Promise<T[]> {
  for (;;) {
    signal?.throwIfAborted();
    const offset = items.length;
    const page = await fetchPage(offset);
    items.push(...page.items);
    report(items.length, page.total);
    if (isLastPage(page, offset)) return items;
  }
}

/** Loads every page of a cursor-paginated endpoint (followed artists use `after`). */
export async function fetchAllCursor<T>(
  fetchPage: (after: string | null) => Promise<CursorPaging<T>>,
  onProgress?: ProgressFn,
): Promise<T[]> {
  const items: T[] = [];
  let after: string | null = null;
  for (;;) {
    const page: CursorPaging<T> = await fetchPage(after);
    items.push(...page.items);
    onProgress?.(items.length, page.total);
    after = page.cursors?.after ?? null;
    if (!page.next || !after || page.items.length === 0) return items;
  }
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
