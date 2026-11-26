# Trikatuka – migration tool for Spotify

**Trikatuka** moves your Spotify library from one account to another: playlists, liked songs,
albums, followed artists and podcasts.

- Playlists you own are **copied** (name, visibility, description and songs).
- Collaborative playlists and playlists made by others are **followed**.
- It runs entirely in the browser; there is no backend.

**Production app:** https://trikatuka.aknakn.eu

How to: https://aknowakowski.blogspot.com/p/trikatuka2.html

## For developers

Stack: React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui, TanStack Query, Zustand,
react-i18next. Tests: Vitest and Playwright.

### Spotify app setup

1. Create an app on https://developer.spotify.com/dashboard and copy its **Client ID**.
2. Add these redirect URIs:
   - `http://127.0.0.1:5173/afterLogin` (development; Spotify only allows `http` on loopback
     IPs, not on `localhost`)
   - `https://<your-domain>/afterLogin` (production)
3. Put the Client ID in `.env.development` / `.env.production`:

   ```
   VITE_SPOTIFY_CLIENT_ID=<your client id>
   ```

   For a personal override, use `.env.development.local` (gitignored).

Apps in Spotify's development mode are limited to a few users, and the app owner needs Spotify
Premium. A public deployment needs extended quota mode.

### Commands

```bash
npm install
npm run dev          # http://127.0.0.1:5173
npm run build        # type check + production build in dist/
npm run preview      # serve dist/ on http://127.0.0.1:4173
npm run lint
npm run typecheck
npm run format       # Prettier
npm test             # unit tests (Vitest)
npm run test:e2e     # end-to-end tests (Playwright, fake Spotify; builds first)
```

The first time, install the Playwright browser with `npx playwright install chromium`.

### Deploy

```bash
firebase deploy --only hosting   # runs npm run build first
```

## Versioning

The project follows [Semantic Versioning](https://semver.org/). Changes are recorded in
[CHANGELOG.md](CHANGELOG.md), in the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
format. The version in `package.json` is the one shown in the app's footer.

## License

[MIT](LICENSE)
