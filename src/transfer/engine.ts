import { CATEGORIES, playlistAction, type Category, type LibraryItem } from '@/lib/library';
import { abortableSleep, AuthLostError, SpotifyApiError } from '@/lib/spotify/client';
import { LIMITS, type SpotifyApi } from '@/lib/spotify/endpoints';
import { chunk, fetchAllOffset } from '@/lib/spotify/paginate';

export type ItemStatus = 'pending' | 'running' | 'ok' | 'skipped' | 'failed' | 'cancelled';

export interface ItemResult {
  key: string;
  item: LibraryItem;
  status: ItemStatus;
  /** i18n key (`result.*`) explaining a skip/failure, or a raw API message. */
  reason?: string;
  /** For copied playlists: how many items were added / left out. */
  added?: number;
  omitted?: number;
  /** While a playlist is being copied: the current phase and its counts. */
  progress?: CopyProgress;
}

/**
 * Copying a playlist reads its items (pages of 50), creates the copy, then adds the items
 * (blocks of 100). `done`/`total` count items; `creating` has no counts.
 */
export type CopyProgress =
  | { phase: 'reading'; done: number; total: number }
  | { phase: 'creating' }
  | { phase: 'adding'; done: number; total: number };

export interface TransferOptions {
  /** Saved tracks one by one, one second apart, so the target keeps the original order. */
  keepOrder: boolean;
  /** Skip what the target account already has. */
  skipDuplicates: boolean;
}

export type Selection = Partial<Record<Category, LibraryItem[]>>;

export interface TransferContext {
  source: SpotifyApi;
  target: SpotifyApi;
  sourceUserId: string;
  targetUserId: string;
  signal?: AbortSignal;
  onUpdate?: (results: ItemResult[]) => void;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** Pause between single-track saves in keep-order mode. */
  keepOrderDelayMs?: number;
}

export const itemKey = (item: LibraryItem) => `${item.category}:${item.id}`;

class RunState {
  readonly results: ItemResult[];
  private readonly index = new Map<string, number>();
  private readonly onUpdate?: (results: ItemResult[]) => void;

  constructor(items: LibraryItem[], onUpdate?: (results: ItemResult[]) => void) {
    this.onUpdate = onUpdate;
    this.results = items.map((item, i) => {
      const key = itemKey(item);
      this.index.set(key, i);
      return { key, item, status: 'pending' as ItemStatus };
    });
    this.emit();
  }

  set(items: LibraryItem[], patch: Omit<Partial<ItemResult>, 'key' | 'item'>) {
    for (const item of items) {
      const i = this.index.get(itemKey(item));
      if (i !== undefined) this.results[i] = { ...this.results[i]!, ...patch };
    }
    this.emit();
  }

  finishRemaining(status: ItemStatus, reason?: string) {
    const pending = this.results.filter((r) => r.status === 'pending' || r.status === 'running');
    this.set(
      pending.map((r) => r.item),
      { status, reason, progress: undefined },
    );
  }

  private emit() {
    this.onUpdate?.([...this.results]);
  }
}

function reasonOf(error: unknown): string {
  if (error instanceof SpotifyApiError) {
    if (error.status === 403) return 'result.forbidden';
    if (error.status === 404) return 'result.notFound';
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

function isAbort(error: unknown, signal?: AbortSignal) {
  return signal?.aborted || (error instanceof DOMException && error.name === 'AbortError');
}

/** Returns the URIs the target library already contains (40 per check, like the API allows). */
async function existingUris(api: SpotifyApi, uris: string[], signal?: AbortSignal) {
  const found = new Set<string>();
  for (const part of chunk(uris, LIMITS.library)) {
    const flags = await api.libraryContains(part, signal);
    part.forEach((uri, i) => flags[i] && found.add(uri));
  }
  return found;
}

/**
 * Transfers the selection from the source to the target account and reports per-item results.
 *
 * Writes run strictly one at a time: concurrent writes used to make Spotify return 500s. Items
 * are processed oldest first (Spotify lists newest first) so the target ends up in the same order.
 */
export async function runTransfer(
  selection: Selection,
  options: TransferOptions,
  ctx: TransferContext,
): Promise<ItemResult[]> {
  const ordered = CATEGORIES.flatMap((c) => [...(selection[c] ?? [])].reverse());
  const state = new RunState(ordered, ctx.onUpdate);
  const sleep = ctx.sleep ?? abortableSleep;

  try {
    for (const category of CATEGORIES) {
      const items = [...(selection[category] ?? [])].reverse();
      if (!items.length) continue;
      if (category === 'playlists') await transferPlaylists(items, options, ctx, state);
      else await transferLibraryItems(category, items, options, ctx, state, sleep);
    }
  } catch (error) {
    if (isAbort(error, ctx.signal)) state.finishRemaining('cancelled');
    else if (error instanceof AuthLostError) state.finishRemaining('failed', 'result.authLost');
    else throw error;
  }
  return state.results;
}

async function transferLibraryItems(
  category: Exclude<Category, 'playlists'>,
  items: LibraryItem[],
  options: TransferOptions,
  ctx: TransferContext,
  state: RunState,
  sleep: NonNullable<TransferContext['sleep']>,
) {
  const { target, signal } = ctx;
  let todo = items;

  if (options.skipDuplicates) {
    const existing = await existingUris(
      target,
      items.map((i) => i.uri),
      signal,
    );
    const dupes = items.filter((i) => existing.has(i.uri));
    state.set(dupes, { status: 'skipped', reason: 'result.alreadyInLibrary' });
    todo = items.filter((i) => !existing.has(i.uri));
  }

  const keepOrder = options.keepOrder && category === 'tracks';
  const batches = chunk(todo, keepOrder ? 1 : LIMITS.library);

  for (const [n, batch] of batches.entries()) {
    signal?.throwIfAborted();
    state.set(batch, { status: 'running' });
    try {
      await target.saveToLibrary(
        batch.map((i) => i.uri),
        signal,
      );
      state.set(batch, { status: 'ok' });
    } catch (error) {
      if (isAbort(error, signal) || error instanceof AuthLostError) throw error;
      state.set(batch, { status: 'failed', reason: reasonOf(error) });
    }
    // Spotify orders saved tracks by save time, so they need to land at distinct moments.
    if (keepOrder && n < batches.length - 1) await sleep(ctx.keepOrderDelayMs ?? 1000, signal);
  }
}

async function transferPlaylists(
  items: LibraryItem[],
  options: TransferOptions,
  ctx: TransferContext,
  state: RunState,
) {
  const { source, target, signal } = ctx;

  let ownedNames = new Set<string>();
  let followed = new Set<string>();
  if (options.skipDuplicates) {
    const targetPlaylists = await fetchAllOffset((o) => target.myPlaylists(o, signal), undefined, {
      signal,
    });
    ownedNames = new Set(
      targetPlaylists.filter((p) => p?.owner.id === ctx.targetUserId).map((p) => p.name),
    );
    const toFollow = items.filter((i) => playlistAction(i, ctx.sourceUserId) === 'follow');
    followed = await existingUris(
      target,
      toFollow.map((i) => i.uri),
      signal,
    );
  }

  for (const item of items) {
    signal?.throwIfAborted();
    const action = playlistAction(item, ctx.sourceUserId);

    if (action === 'copy' ? ownedNames.has(item.name) : followed.has(item.uri)) {
      state.set([item], { status: 'skipped', reason: 'result.alreadyInLibrary' });
      continue;
    }

    state.set([item], { status: 'running' });
    try {
      if (action === 'follow') {
        await target.saveToLibrary([item.uri], signal);
        state.set([item], { status: 'ok', reason: 'result.followed' });
      } else {
        const { added, omitted } = await copyPlaylist(item, source, target, signal, (progress) =>
          state.set([item], { progress }),
        );
        state.set([item], {
          status: 'ok',
          reason: 'result.copied',
          added,
          omitted,
          progress: undefined,
        });
      }
    } catch (error) {
      if (isAbort(error, signal) || error instanceof AuthLostError) throw error;
      state.set([item], { status: 'failed', reason: reasonOf(error), progress: undefined });
    }
  }
}

async function copyPlaylist(
  item: LibraryItem,
  source: SpotifyApi,
  target: SpotifyApi,
  signal: AbortSignal | undefined,
  onProgress: (progress: CopyProgress) => void,
) {
  onProgress({ phase: 'reading', done: 0, total: item.playlist?.itemCount ?? 0 });
  const entries = await fetchAllOffset(
    (o) => source.playlistItems(item.id, o, signal),
    (done, total) => onProgress({ phase: 'reading', done, total }),
    { signal },
  );
  const uris: string[] = [];
  let omitted = 0;
  for (const entry of entries) {
    const track = entry.item ?? entry.track;
    // Local files and unavailable tracks can't be added to a playlist through the API.
    if (!track?.uri || entry.is_local || track.is_local || track.uri.startsWith('spotify:local:')) {
      omitted++;
    } else {
      uris.push(track.uri);
    }
  }

  onProgress({ phase: 'creating' });
  const created = await target.createPlaylist(
    {
      name: item.name,
      public: item.playlist?.isPublic ?? false,
      ...(item.playlist?.description ? { description: item.playlist.description } : {}),
    },
    signal,
  );
  let done = 0;
  onProgress({ phase: 'adding', done, total: uris.length });
  for (const part of chunk(uris, LIMITS.addPlaylistItems)) {
    await target.addPlaylistItems(created.id, part, signal);
    done += part.length;
    onProgress({ phase: 'adding', done, total: uris.length });
  }
  return { added: uris.length, omitted };
}

export function summarize(results: ItemResult[]) {
  const counts: Record<ItemStatus, number> = {
    pending: 0,
    running: 0,
    ok: 0,
    skipped: 0,
    failed: 0,
    cancelled: 0,
  };
  for (const r of results) counts[r.status]++;
  return counts;
}
