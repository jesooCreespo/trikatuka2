# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Version 3.0.0 is a full rewrite. It is a major release because the stack, the build, the
configuration and the UI flow all change.

### Added

- Guided six-step wizard: connect the old account, connect the new account, choose, review,
  transfer, report.
- Selection of individual liked songs, albums, artists and podcasts. Before, only playlists could
  be picked one by one; everything else was "transfer all".
- Search in every section, and a filter for playlists that will be copied or followed.
- "Skip what the new account already has" option, on by default.
- Live progress, overall and per section, and a button to stop the transfer.
- Final report with per-item results, "retry failed items" and a JSON report download.
- JSON backup of the old account's library, including the items of owned playlists.
- Italian translation, with language selection (detected from the browser).
- Languages are discovered from `src/i18n/locales/`: adding a language only takes a new JSON
  file, validated by the test suite. Each language is downloaded only when used.
- Light and dark themes (follows the system by default).
- Automatic retry on Spotify rate limits (`429` with `Retry-After`) and server errors.
- Optional Google AdSense banner, off by default. It is enabled and configured with
  `adsense` settings in `src/environments/`; when off, no Google script is loaded.
- Unit tests (Vitest) and end-to-end tests (Playwright) against a fake Spotify, including
  automated accessibility checks (axe-core, WCAG 2.2 AA) on every step in both themes.

### Changed

- Rewritten in Angular 22 (standalone components, signals, zoneless), TypeScript, Tailwind CSS 4
  and spartan/ui, with Transloco for translations. Replaces AngularJS 1.5,
  jQuery, UIkit 2 and Grunt.
- Uses Spotify Web API endpoints introduced by the February 2026 migration: `PUT /me/library`
  for saving and following, `/playlists/{id}/items` for playlist contents, and
  `POST /me/playlists` for creating playlists.
- Playlist copies keep their description.
- The login popup now hands tokens to the app with a same-origin `postMessage`.
- The privacy policy is a page of the app (`/privacy`), with its header, theme and language
  menu. The old `/privacypolicy.html` address redirects to it. The text is unchanged.
- The Spotify client ID is configured in `src/environments/`.
- Local development runs on `http://127.0.0.1:4200` with no self-signed certificate.
- The OAuth callback `/afterLogin` is a route of the app instead of a separate page.
- The version shown in the footer comes from `package.json`.

### Removed

- `config.dev.json`, `config.prod.json`, `config/default.json.template`, `Gruntfile.js` and the
  `certs/` folder.
- Unused dependencies: socket.io, angular-socket-io, ngStorage, cookiesEU, keycloak-angular.

### Fixed

- Transfers no longer fail on endpoints that Spotify removed in February 2026.
- Local files are skipped when copying a playlist instead of making the request fail.

## [2.7.1] - 2026-03-06

### Fixed

- Authentication.

## [2.7] - 2025-01-22

### Added

- Podcasts.
- Experimental option to keep the order of liked songs.

## [2.6] - 2024-09-23

### Changed

- The app is now fully client side.

### Fixed

- Transfer of tracks and albums.

## [2.5] - 2019-01-01

### Changed

- Playlists are transferred in the same order.

## [2.4] - 2018-09-29

### Added

- Transfer of albums and playlists.

## [2.3] - 2016-04-18

### Added

- "Help" page.

### Fixed

- Moving playlists: requests are now made one by one, because concurrent requests caused
  `500` errors.

[Unreleased]: https://github.com/aartek/trikatuka2/compare/v2.7...HEAD
[2.7]: https://github.com/aartek/trikatuka2/compare/v2.5...v2.7
[2.5]: https://github.com/aartek/trikatuka2/compare/2.4...v2.5
[2.4]: https://github.com/aartek/trikatuka2/compare/v2.3...2.4
[2.3]: https://github.com/aartek/trikatuka2/releases/tag/v2.3
