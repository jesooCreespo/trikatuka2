# Trikatuka – migration tool for Spotify

**Trikatuka** moves your Spotify library from one account to another: playlists, liked songs,
albums, followed artists and podcasts.

- Playlists you own are **copied** (name, visibility, description and songs).
- Collaborative playlists and playlists made by others are **followed**.
- It runs entirely in the browser; there is no backend.

**Production app:** https://trikatuka.aknakn.eu

How to: https://aknowakowski.blogspot.com/p/trikatuka2.html

## Screenshots

| Choose what to transfer                                                                     | Report                                                                         |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| ![Choosing playlists to transfer](docs/screenshots/en-light-desktop-2-select-playlists.png) | ![Transfer report in dark mode](docs/screenshots/en-dark-desktop-6-report.png) |

More in [docs/screenshots](docs/screenshots/), in English and Italian, light and dark, desktop
and mobile. They show a made-up library and are regenerated with `npm run screenshots`.

## For developers

Stack: Angular 22 (standalone components, signals, zoneless), TypeScript, Tailwind CSS 4,
spartan/ui, Transloco. Tests: Vitest (via the Angular CLI), Node's test runner and Playwright.

The Angular team's official guidance is vendored in `docs/angular/` (`best-practices.md`, and
the full documentation in `llms-full.txt`) and is the reference for how Angular code is written
here.

### Spotify app setup

1. Create an app on https://developer.spotify.com/dashboard and copy its **Client ID**.
2. Add these redirect URIs:
   - `http://127.0.0.1:4200/afterLogin` (development; Spotify only allows `http` on loopback
     IPs, not on `localhost`)
   - `https://<your-domain>/afterLogin` (production)
3. Put the Client ID in `src/environments/environment.ts` (production) and
   `environment.development.ts` (`ng serve`, tests): `spotifyClientId`.

Apps in Spotify's development mode are limited to a few users, and the app owner needs Spotify
Premium. A public deployment needs extended quota mode.

### Commands

```bash
npm install
npm start            # ng serve on http://127.0.0.1:4200
npm run build        # production build in dist/trikatuka/browser
npm run lint         # angular-eslint, including template accessibility rules
npm run format       # Prettier
npm test             # unit tests (Vitest via ng test) + translation checks (node --test)
npx ng test --include src/transfer/engine.test.ts   # one unit test file
npm run test:e2e     # end-to-end + accessibility tests (Playwright, fake Spotify)
npx playwright test -g "Italian"                    # one e2e test
npm run screenshots  # regenerate docs/screenshots/ (demo library, all languages/themes)
```

`npm start`, `build` and `test` first run `npm run i18n:sync`, which registers the files in
`src/i18n/locales/`.

The first time, install the Playwright browser with `npx playwright install chromium`.

### Advertising (optional)

The app can show one Google AdSense banner above the footer. It is **off by default**, and
while it is off nothing is loaded from Google. It is configured in
`src/environments/environment.ts`:

```ts
adsense: {
  enabled: true,                     // false = no ads
  client: 'ca-pub-XXXXXXXXXXXXXXXX',
  slot: 'XXXXXXXXXX',
  nonPersonalized: false,            // true = non-personalized ads only
},
```

Rebuild and deploy after changing it. Before turning ads on for visitors in the EEA, UK or
Switzerland, set up a consent message (a Google-certified CMP, e.g. "Privacy & messaging" in
the AdSense account), and make sure the privacy policy matches what is enabled.

### Deploy

```bash
firebase deploy --only hosting   # runs npm run build first
```

`firebase emulators:start --only hosting` serves `dist/trikatuka/browser` locally with the rewrites, but the
local emulator does not apply the `redirects` and `headers` of `firebase.json`. Check those on a
preview channel (`firebase hosting:channel:deploy preview`).

## Adding a language

Translations live in `src/i18n/locales/`, one JSON file per language. Adding a language needs
no code changes:

1. Copy `src/i18n/locales/en.json` to `src/i18n/locales/<code>.json`, where `<code>` is a
   language code such as `de`, `pl` or `pt-BR`. The language menu shows its name automatically,
   in that language.
2. Translate the values. Keep the keys and the `{{placeholders}}` as they are.
3. Plurals: English has `_one` and `_other` forms. Provide exactly the forms your language uses
   (e.g. Polish needs `_one`, `_few`, `_many` and `_other`). If two forms read the same, repeat
   the text.
4. Run `npm test`. It registers the new file and checks every locale file, telling you what is
   missing or not allowed.

Translations are plain text: no HTML, no links. Each language is downloaded only by people who
use it.

## Versioning

The project follows [Semantic Versioning](https://semver.org/). Changes are recorded in
[CHANGELOG.md](CHANGELOG.md), in the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
format. The version in `package.json` is the one shown in the app's footer.

## License

[MIT](LICENSE)
