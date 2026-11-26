import { chunk, fetchAllCursor, fetchAllOffset } from './paginate';
import type { Paging } from './types';

function paging<T>(data: readonly T[], offset: number, limit = 50): Paging<T> {
  return {
    items: data.slice(offset, offset + limit),
    total: data.length,
    limit,
    offset,
    next: offset + limit < data.length ? 'next' : null,
  };
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/**
 * A page fetcher whose responses resolve only when the test releases them, so pages can
 * finish in any order. Tracks how many requests are in flight.
 */
function controlledFetcher<T>(respond: (offset: number) => Paging<T>) {
  const pending: { offset: number; settle: () => void; fail: (e: unknown) => void }[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const fetchPage = vi.fn(
    (offset: number) =>
      new Promise<Paging<T>>((resolve, reject) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        pending.push({
          offset,
          settle: () => {
            inFlight--;
            resolve(respond(offset));
          },
          fail: (e) => {
            inFlight--;
            reject(e);
          },
        });
      }),
  );
  /** Lets pending promise callbacks run (and new requests start). */
  const flush = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  };
  return {
    fetchPage,
    pending,
    get maxInFlight() {
      return maxInFlight;
    },
    /** Resolves one pending request (by index into `pending`, default a random one). */
    async release(pick = Math.floor(Math.random() * pending.length)) {
      const [req] = pending.splice(pick, 1);
      req!.settle();
      await flush();
    },
    async drainRandomly() {
      await flush();
      while (pending.length) await this.release();
    },
    flush,
  };
}

describe('fetchAllOffset', () => {
  it('walks pages until the total is reached', async () => {
    const data = range(120);
    const fetchPage = vi.fn(async (offset: number) => paging(data, offset));
    const progress = vi.fn();

    await expect(fetchAllOffset(fetchPage, progress)).resolves.toEqual(data);
    expect(fetchPage.mock.calls.map((c) => c[0])).toEqual([0, 50, 100]);
    expect(progress).toHaveBeenLastCalledWith(120, 120);
  });

  it('stops on an empty page even if total says otherwise', async () => {
    const fetchPage = vi.fn(async () => ({
      items: [],
      total: 10,
      limit: 50,
      offset: 0,
      next: 'x',
    }));
    await expect(fetchAllOffset(fetchPage)).resolves.toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('handles an empty library', async () => {
    const fetchPage = vi.fn(async (offset: number) => paging([], offset));
    const progress = vi.fn();
    await expect(fetchAllOffset(fetchPage, progress)).resolves.toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(progress.mock.calls).toEqual([[0, 0]]);
  });

  it('handles a single page', async () => {
    const data = range(50);
    const fetchPage = vi.fn(async (offset: number) => paging(data, offset));
    const progress = vi.fn();
    await expect(fetchAllOffset(fetchPage, progress)).resolves.toEqual(data);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(progress.mock.calls).toEqual([[50, 50]]);
  });

  it('keeps Spotify order when pages resolve out of order', async () => {
    for (let run = 0; run < 20; run++) {
      const data = range(1234);
      const f = controlledFetcher((offset) => paging(data, offset));
      const result = fetchAllOffset(f.fetchPage, undefined, { concurrency: 4 });
      await f.drainRandomly();
      await expect(result).resolves.toEqual(data);
      // Every offset requested exactly once.
      expect(f.fetchPage.mock.calls.map((c) => c[0]).sort((a, b) => a - b)).toEqual(
        range(25).map((i) => i * 50),
      );
    }
  });

  it('never has more requests in flight than the limit (default 3)', async () => {
    const data = range(1000);
    const f = controlledFetcher((offset) => paging(data, offset));
    const result = fetchAllOffset(f.fetchPage);
    await f.flush();
    // The first page is fetched alone: it tells the total and the page size.
    expect(f.pending.map((p) => p.offset)).toEqual([0]);
    await f.release(0);
    expect(f.pending.map((p) => p.offset)).toEqual([50, 100, 150]);
    await f.drainRandomly();
    await expect(result).resolves.toEqual(data);
    expect(f.maxInFlight).toBe(3);
  });

  it('honours a custom concurrency', async () => {
    const data = range(500);
    const f = controlledFetcher((offset) => paging(data, offset));
    const result = fetchAllOffset(f.fetchPage, undefined, { concurrency: 1 });
    await f.drainRandomly();
    await expect(result).resolves.toEqual(data);
    expect(f.maxInFlight).toBe(1);
    expect(f.fetchPage.mock.calls.map((c) => c[0])).toEqual(range(10).map((i) => i * 50));
  });

  it('reports monotonic progress of the items received so far', async () => {
    const data = range(230);
    const f = controlledFetcher((offset) => paging(data, offset));
    const progress = vi.fn();
    const result = fetchAllOffset(f.fetchPage, progress);
    await f.flush();
    await f.release(0); // offset 0
    await f.release(2); // offset 150 before 50 and 100
    await f.release(0); // offset 50
    await f.drainRandomly();
    await expect(result).resolves.toEqual(data);
    const loaded = progress.mock.calls.map((c) => c[0] as number);
    expect(loaded.slice(0, 3)).toEqual([50, 100, 150]);
    expect(loaded.at(-1)).toBe(230);
    expect(loaded).toEqual([...loaded].sort((a, b) => a - b));
    expect(progress.mock.calls.every((c) => c[1] === 230)).toBe(true);
  });

  it('loads the extra pages when the total grows while loading', async () => {
    let data = range(120);
    const f = controlledFetcher((offset) => paging(data, offset));
    const progress = vi.fn();
    const result = fetchAllOffset(f.fetchPage, progress);
    await f.flush();
    await f.release(0);
    data = range(260); // items appended (e.g. an older entry restored) mid-load
    await f.drainRandomly();
    await expect(result).resolves.toEqual(range(260));
    expect(progress).toHaveBeenLastCalledWith(260, 260);
    expect(new Set(f.fetchPage.mock.calls.map((c) => c[0])).size).toBe(
      f.fetchPage.mock.calls.length,
    );
  });

  it('stops at the new end when the total shrinks while loading', async () => {
    let data = range(300);
    const f = controlledFetcher((offset) => paging(data, offset));
    const progress = vi.fn();
    const result = fetchAllOffset(f.fetchPage, progress);
    await f.flush();
    await f.release(0);
    data = range(120);
    await f.drainRandomly();
    await expect(result).resolves.toEqual(range(120));
    // Pages past the end are not requested once the smaller total is known.
    expect(f.fetchPage.mock.calls.length).toBeLessThanOrEqual(6);
    const loaded = progress.mock.calls.map((c) => c[0] as number);
    expect(loaded).toEqual([...loaded].sort((a, b) => a - b));
    expect(progress).toHaveBeenLastCalledWith(120, 120);
  });

  it('drops pages after an empty page that arrives late', async () => {
    let data = range(200);
    const f = controlledFetcher((offset) => paging(data, offset));
    const result = fetchAllOffset(f.fetchPage);
    await f.flush();
    await f.release(0);
    // Offsets 50, 100, 150 are in flight. 150 answers first with the full list...
    await f.release(2);
    // ...then the list shrinks, so 50 is the last page and 100 is empty.
    data = range(100);
    await f.drainRandomly();
    await expect(result).resolves.toEqual(range(100));
  });

  it('continues sequentially after a short page that is not the last', async () => {
    const data = range(200);
    const f = controlledFetcher((offset) =>
      offset === 50
        ? { items: data.slice(50, 90), total: 200, limit: 50, offset, next: 'n' }
        : paging(data, offset),
    );
    const result = fetchAllOffset(f.fetchPage);
    await f.drainRandomly();
    await expect(result).resolves.toEqual(data);
    const offsets = f.fetchPage.mock.calls.map((c) => c[0]);
    expect(offsets.slice(4)).toEqual([90, 140, 190]);
  });

  it('rejects when any page fails, without dropping it silently', async () => {
    const data = range(400);
    const boom = new Error('500 after retries');
    const fetchPage = vi.fn(async (offset: number) => {
      if (offset === 150) throw boom;
      return paging(data, offset);
    });
    await expect(fetchAllOffset(fetchPage)).rejects.toBe(boom);
    // Nothing new is scheduled after the failure.
    expect(fetchPage.mock.calls.length).toBeLessThan(8);
  });

  it('rejects when the first page fails', async () => {
    const boom = new Error('nope');
    await expect(fetchAllOffset(async () => Promise.reject(boom))).rejects.toBe(boom);
  });

  it('stops scheduling and rejects when aborted', async () => {
    const data = range(1000);
    const controller = new AbortController();
    const f = controlledFetcher((offset) => paging(data, offset));
    const result = fetchAllOffset(f.fetchPage, undefined, { signal: controller.signal });
    const settled = vi.fn();
    result.catch(settled);
    await f.flush();
    await f.release(0);
    await f.release(0);
    const requested = f.fetchPage.mock.calls.length;
    controller.abort();
    await f.flush();
    // Rejects right away, even with requests still pending.
    expect(settled).toHaveBeenCalledWith(controller.signal.reason);
    await f.drainRandomly();
    expect(f.fetchPage.mock.calls.length).toBe(requested);
  });

  it('rejects immediately with an already aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchPage = vi.fn(async (offset: number) => paging(range(10), offset));
    await expect(fetchAllOffset(fetchPage, undefined, { signal: controller.signal })).rejects.toBe(
      controller.signal.reason,
    );
    expect(fetchPage).not.toHaveBeenCalled();
  });
});

describe('fetchAllCursor', () => {
  it('follows the `after` cursor', async () => {
    const pages = [
      { items: ['a', 'b'], total: 3, limit: 2, next: 'n', cursors: { after: 'b' } },
      { items: ['c'], total: 3, limit: 2, next: null, cursors: { after: null } },
    ];
    const fetchPage = vi.fn(async (after: string | null) => pages[after ? 1 : 0]!);
    await expect(fetchAllCursor(fetchPage)).resolves.toEqual(['a', 'b', 'c']);
    expect(fetchPage.mock.calls.map((c) => c[0])).toEqual([null, 'b']);
  });
});

describe('chunk', () => {
  it('splits into fixed-size parts', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });
});
