import { playlistAction, type Category, type LibraryItem } from '@/lib/library';
import type { SpotifyApi } from '@/lib/spotify/endpoints';
import { fetchAllOffset } from '@/lib/spotify/paginate';
import type { UserProfile } from '@/lib/spotify/types';

export interface LibraryBackup {
  format: 'trikatuka-backup';
  version: 1;
  appVersion: string;
  exportedAt: string;
  user: { id: string; displayName: string | null };
  playlists: {
    name: string;
    uri: string;
    owner: string;
    public: boolean;
    collaborative: boolean;
    description: string | null;
    /** Only present for playlists the user owns (Spotify doesn't expose other playlists' items). */
    items?: string[];
  }[];
  tracks: { name: string; uri: string; subtitle: string }[];
  albums: { name: string; uri: string; subtitle: string }[];
  artists: { name: string; uri: string }[];
  shows: { name: string; uri: string }[];
}

/**
 * Builds a JSON backup of the source library. Owned playlists include their item URIs, which
 * costs one or more extra requests per playlist.
 */
export async function buildBackup(
  library: Partial<Record<Category, LibraryItem[]>>,
  user: UserProfile,
  api: SpotifyApi,
  appVersion: string,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<LibraryBackup> {
  const playlists = library.playlists ?? [];
  const out: LibraryBackup['playlists'] = [];
  for (const [i, p] of playlists.entries()) {
    const owned = playlistAction(p, user.id) === 'copy';
    const items = owned
      ? (await fetchAllOffset((o) => api.playlistItems(p.id, o, signal), undefined, { signal }))
          .map((e) => (e.item ?? e.track)?.uri)
          .filter((uri): uri is string => Boolean(uri))
      : undefined;
    out.push({
      name: p.name,
      uri: p.uri,
      owner: p.playlist?.ownerId ?? '',
      public: p.playlist?.isPublic ?? false,
      collaborative: p.playlist?.collaborative ?? false,
      description: p.playlist?.description ?? null,
      ...(items ? { items } : {}),
    });
    onProgress?.(i + 1, playlists.length);
  }

  const basic = (items: LibraryItem[] = []) =>
    items.map(({ name, uri, subtitle }) => ({ name, uri, subtitle }));

  return {
    format: 'trikatuka-backup',
    version: 1,
    appVersion,
    exportedAt: new Date().toISOString(),
    user: { id: user.id, displayName: user.display_name },
    playlists: out,
    tracks: basic(library.tracks),
    albums: basic(library.albums),
    artists: (library.artists ?? []).map(({ name, uri }) => ({ name, uri })),
    shows: (library.shows ?? []).map(({ name, uri }) => ({ name, uri })),
  };
}
