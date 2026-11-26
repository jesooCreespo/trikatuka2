import type { AppEnvironment } from './environment.model';

/** Development configuration (`ng serve`, `ng test`). */
export const environment: AppEnvironment = {
  spotifyClientId: '27edb2ed1e2c4c5c8cd7e192c81e37e8',
  // Ads stay off in development; see environment.ts.
  adsense: {
    enabled: false,
    client: '',
    slot: '',
    nonPersonalized: false,
  },
};
