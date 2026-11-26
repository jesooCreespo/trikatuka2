import type { CursorPaging, Paging } from './types';

export type ProgressFn = (loaded: number, total: number) => void;

/** Loads every page of an offset-paginated endpoint, one request at a time. */
export async function fetchAllOffset<T>(
  fetchPage: (offset: number) => Promise<Paging<T>>,
  onProgress?: ProgressFn,
): Promise<T[]> {
  const items: T[] = [];
  let offset = 0;
  for (;;) {
    const page = await fetchPage(offset);
    items.push(...page.items);
    offset += page.items.length;
    onProgress?.(items.length, page.total);
    if (!page.next || page.items.length === 0 || offset >= page.total) return items;
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
