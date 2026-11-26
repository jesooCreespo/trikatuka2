import type { AppEnvironment } from './environment.model';

/** Production configuration (`ng build`). Development overrides live in environment.development.ts. */
export const environment: AppEnvironment = {
  spotifyClientId: '27edb2ed1e2c4c5c8cd7e192c81e37e8',
  // Google AdSense banner (see README, "Advertising"). Off: set `enabled` to true to show ads.
  adsense: {
    enabled: false,
    client: 'ca-pub-9007960458261252',
    slot: '2734653062',
    nonPersonalized: false,
  },
};
