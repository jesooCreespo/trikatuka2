# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Trikatuka is a fully client-side SPA that transfers a Spotify library (playlists, liked songs, albums, followed artists, podcasts) from one account ("old", the source) to another ("new", the target). No backend: the browser talks directly to the Spotify Web API. Hosted on Firebase Hosting (project `trikatuka-7ccbe`).

Stack: React 19 + TypeScript (strict) + Vite, Tailwind CSS 4 + shadcn/ui (`src/components/ui/`, generated — edit sparingly), TanStack Query, Zustand, react-i18next, react-router.

## Commands

```bash
npm run dev                          # http://127.0.0.1:5173 (must be 127.0.0.1, see below)
npm run build                        # tsc --noEmit + vite build -> dist/
npm run lint && npm run typecheck
npm run format                       # Prettier (also sorts Tailwind classes)
npm test                             # Vitest, all unit tests
npx vitest run src/transfer/engine.test.ts   # one file
npx vitest run -t "keeps order"              # tests matching a name
npm run test:e2e                     # Playwright; builds and serves dist/ on :4173
npx playwright test -g "Italian"     # one e2e test
```

Run commands from Git Bash or PowerShell; no POSIX-only scripts are needed.

## Architecture

**Layers** (each only depends on the ones above it):

1. `src/lib/spotify/` — Web API access.
   - `auth.ts`: PKCE login. `StepConnect` calls `prepareLogin(slot)` ahead of time (hashing is async); on click, `startLogin(prepared)` _synchronously_ writes verifier/state to **sessionStorage** and only then calls `window.open(authorizeUrl)` with a unique window name. Order matters: a popup gets a _copy_ of the opener's sessionStorage taken at open time, and `window.open` after an `await` risks the popup blocker. `afterLogin.html` → `src/afterLogin.ts` calls `completeLogin` (reads the popup's copy) and `postMessage`s tokens back (same origin only).
   - `client.ts`: the only `fetch` wrapper. Bearer token, refresh 60 s before expiry and once after a 401 (concurrent refreshes deduped), retries `429` (honours `Retry-After`) and 5xx with backoff. `onAuthLost` signs the slot out.
   - `endpoints.ts`: typed calls and per-request `LIMITS`.
2. `src/lib/library.ts` — normalizes every category into `LibraryItem` and holds the copy-vs-follow rule (`playlistAction`: owned and not collaborative → copy, else follow).
3. `src/transfer/engine.ts` — `runTransfer(selection, options, ctx)`: pure logic over a `SpotifyApi` interface (fake it in tests), reports per-item `ItemResult`s through `onUpdate`. `export.ts` builds the JSON backup (lazy-loaded).
4. `src/state/` — Zustand stores persisted to sessionStorage: `session.ts` (accounts + `getApi(slot)`), `wizard.ts` (step, selection keyed by id per category, options, results). Theme lives in `src/lib/theme.ts` (localStorage). Persisted stores have a `version`: bump it when the persisted shape changes.
5. `src/features/wizard/` — UI. `Wizard.tsx` derives the allowed step from which accounts are connected. Library lists are TanStack queries (`library-query.ts`, key `['library', userId, category]`, never stale). A transfer is started by `run-controller.ts` _outside React_ (so re-renders/StrictMode can't restart it) and pushes throttled results into the wizard store.

**Spotify API rules that shape the code** (post February 2026 migration — older endpoints like `PUT /me/tracks`, `/playlists/{id}/tracks`, `POST /users/{id}/playlists` are gone):

- Saving/following anything: `PUT /me/library?uris=…`, **max 40 URIs**. Checks: `GET /me/library/contains`, max 40.
- Playlist contents: `/playlists/{id}/items` (read max 50/page, add max 100/request), readable **only for playlists the user owns or collaborates on**; entries use `item` (`track` is a deprecated alias — read both).
- Create playlist: `POST /me/playlists`. Playlist objects expose the count as `items.total` (fallback `tracks.total`).
- Artists via `/me/library` are listed in the migration guide but not in the endpoint reference — verify with a real account if artist transfers fail.

**Transfer invariants** (don't break without a reason):

- Writes run strictly one at a time (parallel writes caused Spotify 500s). Reads are sequential too.
- Items are processed oldest first (Spotify lists newest first) so the target keeps the order.
- "Keep order" for liked songs saves one track per request, 1 s apart (Spotify sorts by save time).
- Local files (`spotify:local:`) can't be added to playlists; they're counted as `omitted`.

**i18n**: every user-facing string lives in `src/i18n/locales/<code>.json`. `src/i18n/index.ts` discovers locale files with `import.meta.glob` (no registry to edit): `en` is bundled (fallback), every other language is a lazy chunk; the app renders only after the detected language is loaded (`i18nReady` in `main.tsx`). Language names come from `Intl.DisplayNames`; browser locales map to the closest file via `pickLanguage`. `src/i18n/i18n.test.ts` is the gatekeeper for every locale file: same keys and placeholders as `en.json`, exactly the plural forms `Intl.PluralRules` says the language needs (Italian needs `_many` too), no HTML/URLs, no `__proto__`-style keys. Never render translations as HTML (`dangerouslySetInnerHTML`, `<Trans>` with tags) and never put links in them: hrefs stay in code. Engine results carry i18n keys (`result.*`) or raw Spotify messages as `reason`.

**Dev/prod parity**: Spotify allows `http` redirect URIs only on loopback IPs, so dev runs on `127.0.0.1:5173` (not `localhost`), with redirect `http://127.0.0.1:5173/afterLogin`. A Vite plugin in `vite.config.ts` rewrites `/afterLogin` → `afterLogin.html` like `firebase.json` does in production. Static files (favicon) live in `static/` (Vite `publicDir`; `public/` is gitignored).

**E2E tests** (`e2e/`) run against an in-memory fake Spotify (`e2e/fake-spotify.ts`) installed with `context.route`, including the OAuth popup flow; extend it when adding endpoints. `npm run screenshots` (`screenshots/`, own Playwright config) reuses it with a made-up demo library (`screenshots/demo-library.ts`: invented names, generated SVG covers on a `.invalid` domain, two forced failures) and writes `docs/screenshots/`. Regenerate them after visible UI changes.

## Versioning

SemVer + [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Every user-visible change gets an entry under `## [Unreleased]` in `CHANGELOG.md` (Added / Changed / Deprecated / Removed / Fixed / Security). On release: move entries to `## [x.y.z] - YYYY-MM-DD` and set the same version in `package.json`. The footer reads the version from `package.json` (`__APP_VERSION__`), so never hardcode it.

## Skills

`.claude/skills/react-best-practices/` (Vercel, MIT; source in `SOURCE.txt`) — performance rules for React. The `server-*` and Next.js-specific rules don't apply to this SPA.

## Privacy policy

`src/pages/Privacy.tsx` (route `/privacy`; `/privacypolicy.html` redirects there in the app and in `firebase.json`). It is the owner's legal text: keep it verbatim and English-only, and change the wording only when the owner asks.
