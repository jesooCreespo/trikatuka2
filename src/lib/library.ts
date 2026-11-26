import type { SpotifyApi } from './spotify/endpoints'
import { fetchAllCursor, fetchAllOffset, type ProgressFn } from './spotify/paginate'
import type { Image, Playlist } from './spotify/types'

export const CATEGORIES = ['playlists', 'tracks', 'albums', 'artists', 'shows'] as const
export type Category = (typeof CATEGORIES)[number]

export interface PlaylistMeta {
  ownerId: string
  ownerName: string | null
  collaborative: boolean
  isPublic: boolean
  description: string | null
  itemCount: number | null
}

/** A normalized entry of the source library, whatever its type. */
export interface LibraryItem {
  category: Category
  id: string
  uri: string
  name: string
  subtitle: string
  imageUrl: string | null
  playlist?: PlaylistMeta
}

function smallestImage(images: Image[] | null | undefined): string | null {
  if (!images?.length) return null
  const sorted = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0))
  // Prefer the smallest image that's still at least 64px wide.
  return (sorted.find((img) => (img.width ?? 0) >= 64) ?? sorted[sorted.length - 1])?.url ?? null
}

export function playlistToItem(p: Playlist): LibraryItem {
  return {
    category: 'playlists',
    id: p.id,
    uri: p.uri,
    name: p.name,
    subtitle: p.owner.display_name ?? p.owner.id,
    imageUrl: smallestImage(p.images),
    playlist: {
      ownerId: p.owner.id,
      ownerName: p.owner.display_name ?? null,
      collaborative: p.collaborative,
      isPublic: p.public ?? false,
      description: p.description,
      itemCount: p.items?.total ?? p.tracks?.total ?? null,
    },
  }
}

/**
 * Loads a whole category of the user's library, in Spotify's order (newest saved first;
 * playlists in the order the user sees them).
 */
export async function loadCategory(
  api: SpotifyApi,
  category: Category,
  onProgress?: ProgressFn,
  signal?: AbortSignal,
): Promise<LibraryItem[]> {
  switch (category) {
    case 'playlists': {
      const playlists = await fetchAllOffset((o) => api.myPlaylists(o, signal), onProgress)
      // Spotify can return null entries for playlists that are no longer available.
      return playlists.filter(Boolean).map(playlistToItem)
    }
    case 'tracks': {
      const saved = await fetchAllOffset((o) => api.savedTracks(o, signal), onProgress)
      return saved
        .filter((s) => s.track?.id && !s.track.is_local)
        .map(({ track }) => ({
          category,
          id: track.id!,
          uri: track.uri,
          name: track.name,
          subtitle: [track.artists?.map((a) => a.name).join(', '), track.album?.name]
            .filter(Boolean)
            .join(' · '),
          imageUrl: smallestImage(track.album?.images),
        }))
    }
    case 'albums': {
      const saved = await fetchAllOffset((o) => api.savedAlbums(o, signal), onProgress)
      return saved.map(({ album }) => ({
        category,
        id: album.id,
        uri: album.uri,
        name: album.name,
        subtitle: album.artists.map((a) => a.name).join(', '),
        imageUrl: smallestImage(album.images),
      }))
    }
    case 'artists': {
      const artists = await fetchAllCursor(
        (after) => api.followedArtists(after, signal),
        onProgress,
      )
      return artists.map((artist) => ({
        category,
        id: artist.id,
        uri: artist.uri,
        name: artist.name,
        subtitle: '',
        imageUrl: smallestImage(artist.images),
      }))
    }
    case 'shows': {
      const saved = await fetchAllOffset((o) => api.savedShows(o, signal), onProgress)
      return saved.map(({ show }) => ({
        category,
        id: show.id,
        uri: show.uri,
        name: show.name,
        subtitle: '',
        imageUrl: smallestImage(show.images),
      }))
    }
  }
}

/** Playlists the source user owns (and that aren't collaborative) are copied; others followed. */
export function playlistAction(item: LibraryItem, sourceUserId: string): 'copy' | 'follow' {
  const meta = item.playlist
  if (!meta) return 'follow'
  return !meta.collaborative && meta.ownerId === sourceUserId ? 'copy' : 'follow'
}

/** Case/whitespace-insensitive search over name and subtitle. */
export function matchesSearch(item: LibraryItem, query: string): boolean {
  const q = query.trim().toLocaleLowerCase()
  if (!q) return true
  return `${item.name} ${item.subtitle}`.toLocaleLowerCase().includes(q)
}
