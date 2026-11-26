import type { SpotifyClient } from './client';
import type {
  Artist,
  CursorPaging,
  Paging,
  Playlist,
  PlaylistItem,
  SavedAlbum,
  SavedShow,
  SavedTrack,
  UserProfile,
} from './types';

/**
 * Typed Web API calls, using the endpoints that exist after Spotify's February 2026 migration:
 * - saving/following anything goes through `PUT /me/library` with URIs (max 40 per call);
 * - "contains" checks go through `GET /me/library/contains` (max 40);
 * - playlist contents live under `/playlists/{id}/items` (read: max 50, add: max 100) and can
 *   only be read for playlists the user owns or collaborates on;
 * - playlists are created with `POST /me/playlists`.
 */
export const LIMITS = {
  page: 50,
  library: 40,
  addPlaylistItems: 100,
} as const;

export interface SpotifyApi {
  me(signal?: AbortSignal): Promise<UserProfile>;
  myPlaylists(offset: number, signal?: AbortSignal): Promise<Paging<Playlist>>;
  playlistItems(
    playlistId: string,
    offset: number,
    signal?: AbortSignal,
  ): Promise<Paging<PlaylistItem>>;
  savedTracks(offset: number, signal?: AbortSignal): Promise<Paging<SavedTrack>>;
  savedAlbums(offset: number, signal?: AbortSignal): Promise<Paging<SavedAlbum>>;
  savedShows(offset: number, signal?: AbortSignal): Promise<Paging<SavedShow>>;
  followedArtists(after: string | null, signal?: AbortSignal): Promise<CursorPaging<Artist>>;
  createPlaylist(
    data: { name: string; public: boolean; description?: string },
    signal?: AbortSignal,
  ): Promise<Playlist>;
  addPlaylistItems(playlistId: string, uris: string[], signal?: AbortSignal): Promise<void>;
  saveToLibrary(uris: string[], signal?: AbortSignal): Promise<void>;
  libraryContains(uris: string[], signal?: AbortSignal): Promise<boolean[]>;
}

function assertMax(uris: string[], max: number) {
  if (uris.length > max)
    throw new RangeError(`At most ${max} URIs per request, got ${uris.length}`);
}

export function createApi(client: SpotifyClient): SpotifyApi {
  const page = { limit: LIMITS.page };
  return {
    me: (signal) => client.request('GET', '/me', { signal }),
    myPlaylists: (offset, signal) =>
      client.request('GET', '/me/playlists', { query: { ...page, offset }, signal }),
    playlistItems: (id, offset, signal) =>
      client.request('GET', `/playlists/${encodeURIComponent(id)}/items`, {
        query: { ...page, offset, additional_types: 'track,episode' },
        signal,
      }),
    savedTracks: (offset, signal) =>
      client.request('GET', '/me/tracks', { query: { ...page, offset }, signal }),
    savedAlbums: (offset, signal) =>
      client.request('GET', '/me/albums', { query: { ...page, offset }, signal }),
    savedShows: (offset, signal) =>
      client.request('GET', '/me/shows', { query: { ...page, offset }, signal }),
    followedArtists: async (after, signal) => {
      const res = await client.request<{ artists: CursorPaging<Artist> }>('GET', '/me/following', {
        query: { type: 'artist', ...page, after: after ?? undefined },
        signal,
      });
      return res.artists;
    },
    createPlaylist: (data, signal) =>
      client.request('POST', '/me/playlists', { body: data, signal }),
    addPlaylistItems: async (id, uris, signal) => {
      assertMax(uris, LIMITS.addPlaylistItems);
      await client.request('POST', `/playlists/${encodeURIComponent(id)}/items`, {
        body: { uris },
        signal,
      });
    },
    saveToLibrary: async (uris, signal) => {
      assertMax(uris, LIMITS.library);
      await client.request('PUT', '/me/library', { query: { uris: uris.join(',') }, signal });
    },
    libraryContains: (uris, signal) => {
      assertMax(uris, LIMITS.library);
      return client.request('GET', '/me/library/contains', {
        query: { uris: uris.join(',') },
        signal,
      });
    },
  };
}
