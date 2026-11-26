export interface AppEnvironment {
  /** Client ID of the Spotify app (developer.spotify.com/dashboard). Public: PKCE needs no secret. */
  spotifyClientId: string;
  adsense: {
    enabled: boolean;
    /** Publisher ID, e.g. `ca-pub-1234567890123456`. */
    client: string;
    /** Ad unit (slot) ID, digits only. */
    slot: string;
    /** Request non-personalized ads only. */
    nonPersonalized: boolean;
  };
}
