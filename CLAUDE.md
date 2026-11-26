# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Angular: sources of truth

The Angular team's official context files are vendored in `docs/angular/` (provenance and hashes
in `docs/angular/SOURCE.md`). They are the source of truth for every line of Angular code here:
where anything else (habits, older docs, other projects) disagrees with them, they win.

- `docs/angular/best-practices.md` is always loaded, in full:

@docs/angular/best-practices.md

- `docs/angular/llms-full.txt` (the complete Angular documentation, ~865 KB) is the reference to
  consult whenever a question about Angular comes up: an API, a pattern, configuration, testing,
  the build. Don't load it in full; find the relevant sections and read them completely. Its
  headings work as an index: `grep -n "^#" docs/angular/llms-full.txt`.

## What this is

Trikatuka is a fully client-side SPA that transfers a Spotify library (playlists, liked songs, albums, followed artists, podcasts) from one account ("old", the source) to another ("new", the target). No backend: the browser talks directly to the Spotify Web API. Hosted on Firebase Hosting (project `trikatuka-7ccbe`). This repository is a fork of `aartek/trikatuka2`; changes should stay acceptable upstream.

Stack: Angular 22 (standalone components, signals, zoneless, `@angular/build` esbuild builder), TypeScript, Tailwind CSS 4 via PostCSS, spartan/ui (`src/app/ui/`, generated: see below), Transloco, `@ng-icons/lucide`.

## Commands

```bash
npm start                      # ng serve on http://127.0.0.1:4200 (must be 127.0.0.1, see below)
npm run build                  # dist/trikatuka/browser
npm run lint                   # angular-eslint (src/app/ui is ignored)
npm run format                 # Prettier (Angular parser for .html, Tailwind class sorting)
npm test                       # ng test (Vitest, jsdom) + node --test scripts/**/*.test.mjs
npx ng test --no-watch --include src/transfer/engine.test.ts   # one unit test file
npm run test:e2e               # Playwright on ng serve --configuration production :4173
npx playwright test -g "Italian"                               # one e2e test
npm run screenshots            # regenerate docs/screenshots/
```

`npm start`/`build`/`test` run `npm run i18n:sync` first (see i18n).

## Architecture

Framework-agnostic core (same logic as the React branch `modernize-v3`, formatted per branch; keep them in sync so fixes apply to both):

- `src/lib/spotify/` — `auth.ts` (PKCE), `client.ts` (the only `fetch` wrapper: token refresh 60 s before expiry and once after a 401, retries `429` with `Retry-After` and 5xx), `endpoints.ts` (typed calls + `LIMITS`), `paginate.ts`.
- `src/lib/library.ts` — normalizes every category into `LibraryItem`; `playlistAction` (owned and not collaborative → copy, else follow).
- `src/lib/spotify/paginate.ts` — `fetchAllOffset` reads the first page alone, then the rest with at most `READ_CONCURRENCY` (3) requests in flight, reassembled in Spotify's order; pass `{ signal }` so an abort stops scheduling. Cursor paging (followed artists) stays sequential.
- `src/lib/timers/` — `workerSleep`: same contract as `abortableSleep` (rejects with `signal.reason` on abort) but the timers run in one shared dedicated worker (`timer.worker.ts`, bundled by `@angular/build` from `new Worker(new URL('./timer.worker', import.meta.url), { type: 'module' })`, emitted as `worker-[hash].js`), because Chrome throttles chained timers in hidden tabs to once per minute. Falls back to `abortableSleep` without Worker support (jsdom) or if the worker fails. `RunController` passes it as `ctx.sleep` and holds a screen wake lock (`src/lib/wake-lock.ts`, best effort, re-acquired on `visibilitychange`) while a run lasts.
- `src/lib/trusted-types.ts` — the Trusted Types `default` policy (installed in `main.ts`): the worker constructor is a Trusted Types sink and must keep the bundler's literal form, so the default policy accepts only same-origin `/worker-*.js` script URLs; everything else stays blocked. Without it the CSP silently blocks the worker and pauses fall back to throttled main-thread timers (`e2e/security-headers.spec.ts` checks this).
- `src/transfer/engine.ts` — `runTransfer(selection, options, ctx)` over a `SpotifyApi` interface (fake it in tests). Each `ItemResult` carries its status and, while a playlist is copied, `progress` (`reading`/`creating`/`adding` with counts), cleared when it ends; the run step shows it per item (`src/app/wizard/run-details.ts`). `export.ts` builds the JSON backup (lazy-loaded).

Angular layer (`src/app/`):

- `core/` — `@Service()` singletons holding signals: `Session` (accounts + `api(slot)`), `Wizard` (step; selections per source account id, then per category keyed by item id; options; results), `LibraryStore` (per-category cache; `category()` is a pure read, `ensureLoaded()` starts loading — never load inside a `computed`), `RunController` (runs a transfer outside components; throttled progress), `Theme`, `Toasts`. Persistence uses `persistedSignal` (explicit writes on every change, versioned keys, no `effect`); bump the version when a persisted shape changes.
- `wizard/` — `WizardPage` derives the allowed step from connected accounts (`connect` until both are); one component per step; `CategoryPanel`/`ItemRow` for the lists. `StepConnect` holds both `AccountCard`s and the swap button: `Session.swap()` exchanges the accounts with their tokens inside `document.startViewTransition` (skipped under reduced motion), and each account chip's `view-transition-name` follows the account so it animates across the cards. Library caches and selections are per account, so a double swap reloads nothing.
- `pages/` — lazy routes: `help`, `privacy`, `afterLogin` (the OAuth callback: the Angular builder has a single entry point, so it is a route, not a separate HTML page).
- `ads/` — optional AdSense banner, configured in `src/environments/` (`adsense`), off by default; when off nothing renders and no Google script is injected.
- Configuration: `src/environments/environment.ts` (production) / `environment.development.ts` (serve, test), typed by `environment.model.ts`.
- Icons are registered once in `app.config.ts` (`provideIcons`); use `<ng-icon name="lucide…">`.

**PKCE login**: `StepConnect` calls `prepareLogin(slot)` ahead of time (hashing is async); on click, `startLogin(prepared)` synchronously writes verifier/state to sessionStorage and only then `window.open`s the authorize URL with a unique window name. A popup gets a _copy_ of the opener's sessionStorage taken at open time, and `window.open` after an `await` risks the popup blocker. `/afterLogin` calls `completeLogin` and `postMessage`s tokens back (same origin only).

**Spotify API rules that shape the code** (post February 2026 migration — older endpoints like `PUT /me/tracks`, `/playlists/{id}/tracks`, `POST /users/{id}/playlists` are gone):

- Saving/following anything: `PUT /me/library?uris=…`, **max 40 URIs**. Checks: `GET /me/library/contains`, max 40.
- Playlist contents: `/playlists/{id}/items` (read max 50/page, add max 100/request), readable **only for playlists the user owns or collaborates on**; entries use `item` (`track` is a deprecated alias — read both).
- Create playlist: `POST /me/playlists`. Playlist objects expose the count as `items.total` (fallback `tracks.total`).
- Artists via `/me/library` are listed in the migration guide but not in the endpoint reference — verify with a real account if artist transfers fail.

**Transfer invariants** (don't break without a reason):

- Writes run strictly one at a time (parallel writes caused Spotify 500s). Reads are sequential too.
- Items are processed oldest first (Spotify lists newest first) so the target keeps the order.
- "Keep order" for liked songs saves one track per request, 1 s apart (Spotify sorts by save time), using `workerSleep` so it isn't throttled in background tabs.
- Local files (`spotify:local:`) can't be added to playlists; they're counted as `omitted`.

**i18n**: strings live in `src/i18n/locales/<code>.json` (same files and format as the React branch). `scripts/sync-locales.mjs` generates `src/i18n/available-locales.ts` (lazy loaders; committed, do not edit). `src/i18n/i18n.ts`: Transloco + the `I18n` service — templates call `i18n.t(key, params)` and `i18n.tn(key, count, params)` (plural forms `_one`/`_few`/`_many`/`_other` via `Intl.PluralRules`); both read the `lang` signal so templates re-render on change. The user's language is loaded in `provideAppInitializer` before first render. `scripts/locales.test.mjs` validates every locale (keys/placeholders as `en.json`, exactly the plural forms the language needs — Italian needs `_many` too — no HTML/URLs, no `__proto__`-style keys) and that the registry is current. Never render translations as HTML; links stay in code.

**Security headers**: `firebase.json` sends a CSP and other headers on `**`. `script-src` is `'self'` plus the SHA-256 of the inline theme script in `src/index.html`. Editing that script changes its hash: `npm test` (`scripts/csp.test.mjs`) fails and prints the new value to put in `firebase.json`. `src/index.html` is LF-only (`.gitattributes`) so the hash is the same on every OS. Critical CSS inlining is off (`optimization.styles.inlineCritical: false`) because Beasties' inline script would be blocked; don't turn it back on. `style-src` needs `'unsafe-inline'` (Angular's runtime component styles, no nonces on static hosting). `img-src` allows Spotify's CDNs (`*.scdn.co`, `*.spotifycdn.com`) and Facebook avatar hosts (`platform-lookaside.fbsbx.com`, `*.fbcdn.net`); if covers are missing, look for `img-src` violations in the console and add the host. Trusted Types allows the `angular`, `angular#bundler`, `angular#components`, `ng-icons` and `default` policies; a new library that writes HTML may need its policy added. The hosting emulator ignores `headers`, so `e2e/security-headers.spec.ts` injects them and fails on any violation; new features must keep it green.

**Enabling AdSense** requires widening the policy (keep it strict while ads are off): add to `script-src` `https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.google.com https://*.gstatic.com https://*.adtrafficquality.google https://*.doubleclick.net`; to `img-src`/`connect-src` `https://*.googlesyndication.com https://*.google.com https://*.doubleclick.net https://*.adtrafficquality.google` (plus regional `https://*.google.<ccTLD>` if violations show them); add `frame-src https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com`; remove `require-trusted-types-for 'script'` and `trusted-types` (adsbygoogle and `script.src` in `src/app/ads/adsense.ts` aren't Trusted Types-compatible); optionally drop `browsing-topics=()` and use `Referrer-Policy: strict-origin-when-cross-origin`. Then set `adsense.enabled` and check the console for remaining violations; Google's domain list changes over time.

**Accessibility**: `e2e/accessibility.spec.ts` runs axe-core (WCAG 2.2 AA) on every step and page in both themes; it must stay green. Theme colors were tuned for contrast (light primary/destructive darker, dark destructive lighter); check AXE after changing them. Filters without panels are toggle-button groups (`aria-pressed`), not tabs.

**spartan/ui**: `src/app/ui/` is generated by `@spartan-ng/cli` (style `vega`, `components.json`) and kept identical to upstream; it uses the official `cn` package. Add components with `npx ng g @spartan-ng/cli:ui <name>`. The CLI is a devDependency pinned to the exact version that generated the components (bump it together with `@spartan-ng/brain` and regenerate). It brings `npm audit` findings (zod, minimatch via ts-morph) that only affect the CLI on a developer machine; check what ships with `npm run audit:prod`. Its `nx` postinstall is denied in `allowScripts`. Visited tab panels stay mounted (hidden), so e2e tests scope queries to the visible `tabpanel`.

**Dev/prod parity**: Spotify allows `http` redirect URIs only on loopback IPs, so `ng serve` runs on `127.0.0.1:4200` (redirect `http://127.0.0.1:4200/afterLogin`). Static assets live in `public/`. Firebase serves `dist/trikatuka/browser` with an SPA fallback; the local hosting emulator ignores `redirects`/`headers`, so old URLs (`/privacypolicy.html`) are also redirected by app routes.

**E2E tests** (`e2e/`) run against an in-memory fake Spotify (`e2e/fake-spotify.ts`, installed with `context.route`, including the OAuth popup); `screenshots/` reuses it with a made-up demo library.

## Privacy policy

`src/app/pages/privacy.html` is the owner's legal text: keep it verbatim and English-only, and change the wording only when the owner asks.

## Versioning

SemVer + [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Every user-visible change gets an entry under `## [Unreleased]` in `CHANGELOG.md`. On release: move entries to `## [x.y.z] - YYYY-MM-DD` and set the same version in `package.json`. The footer reads the version from `package.json`; never hardcode it.
