/** Which of the two connected accounts: the one we copy from, or the one we copy to. */
export type Slot = 'old' | 'new';

export interface AuthData {
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds. */
  expiresAt: number;
  scope: string;
}

export interface Image {
  url: string;
  height?: number | null;
  width?: number | null;
}

export interface UserProfile {
  id: string;
  display_name: string | null;
  images?: Image[];
  uri: string;
}

export interface Paging<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  next: string | null;
}

export interface CursorPaging<T> {
  items: T[];
  total: number;
  limit: number;
  next: string | null;
  cursors: { after: string | null };
}

export interface SimplifiedArtist {
  id: string;
  name: string;
  uri: string;
}

export interface Playlist {
  id: string;
  name: string;
  uri: string;
  public: boolean | null;
  collaborative: boolean;
  description: string | null;
  images: Image[] | null;
  owner: { id: string; display_name?: string | null };
  /** Post-February-2026 name of the items reference. Absent for playlists the user can't read. */
  items?: { total: number } | null;
  /** Pre-migration name, kept as a fallback. */
  tracks?: { total: number } | null;
}

export interface Track {
  id: string | null;
  name: string;
  uri: string;
  is_local?: boolean;
  type: 'track' | 'episode';
  artists?: SimplifiedArtist[];
  album?: { name: string; images: Image[] };
}

export interface PlaylistItem {
  added_at: string;
  is_local: boolean;
  /** Post-migration field. */
  item?: Track | null;
  /** Deprecated alias of `item`. */
  track?: Track | null;
}

export interface SavedTrack {
  added_at: string;
  track: Track;
}

export interface Album {
  id: string;
  name: string;
  uri: string;
  images: Image[];
  artists: SimplifiedArtist[];
}

export interface SavedAlbum {
  added_at: string;
  album: Album;
}

export interface Artist {
  id: string;
  name: string;
  uri: string;
  images?: Image[];
}

export interface Show {
  id: string;
  name: string;
  uri: string;
  images: Image[];
}

export interface SavedShow {
  added_at: string;
  show: Show;
}
