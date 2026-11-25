# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Admin notice for sites migrated from v0.1 (custom preset, defer or idle, linked page CSS) recommending the Recommended performance preset, with a nonce-checked per-user dismissal.
- E2E: hostile fixture theme and cookie-driven theme switch (mu-plugin), every page invariant runs on `stock` and `hostile`, pairwise feature-level combinations, hostile-only checks, and a Pixel 5 `@smoke` project. See `docs/TESTING.md`.
- CI: PHPStan level 8 (`composer run analyse`), WordPress Plugin Check on the packaged plugin, smoke E2E on pull requests, nightly WordPress and PHP matrix with Firefox and WebKit smoke, CodeQL and Dependabot.
- Settings schema v2: `performance.*` (preset, strategy, position, fetch priority, prefetch, page CSS, device skip, optimizer opt-out) with Recommended and Compatibility presets, `visibility.mode` with include lists, a v1 migration that maps `advanced.loadStrategy`, and `presets` in `GET /schema`.
- Visibility modes on the front end: `everywhere`, `only_on` and `except_on`, with a template matcher (block template slug or page template file) and the `__guest` pseudo-role for logged-out visitors.
- Panel data: per-locale `panel-{locale}-{hash}.json` in `uploads/kotlinskidev-a11y/` plus a public `GET /kotlinskidev-a11y/v1/panel-data` fallback, a new `loadError` string, and a `translations` reason for `kotlinskidev_a11y_cache_invalidated` after translation updates. Uninstall removes the files.
- Front end switch-over: one `loader.js` script on every page (strategy, position, fetch priority and optimizer opt-out attributes follow the Performance settings), the launcher server-rendered in a declarative shadow root, page CSS loaded lazily, and `build/manifest.php` for versions. The panel and feature chunks load on first use or from saved state. See `docs/PHASE3-SPEC.md`.
- `kotlinskidev_a11y_legacy_config` filter: return `true` to keep the moved config fields inline until v0.3.0.
- E2E `loading.spec.ts` (strategies, saved state, hostile fixture, early triggers, chunk failure, data fallback, device skip, no JavaScript, page CSS modes) and `tests/e2e/support/perf.ts`.

### Changed

- Document-level custom CSS is printed in the page head. Custom CSS that targets the launcher inside the shadow root applies after the first open.
- `window.kotlinskidevA11y` is merged into the bootstrap prefix and holds only the loader fields. The other fields arrive with the panel data.
- The panel dialog returns focus to the opener passed with the open command, and the launcher by default.
- Page footprint budget: bootstrap plus loader at most 3840 B gzip.

### Removed

- `build/frontend.js` and `frontend.asset.php`.

### Fixed

- Visibility: post ID and post type rules match singular views only (archives and the blog index no longer collide with term IDs), the decision is made once per request so head and footer agree, and non-ASCII URL patterns such as `/café/*` match percent-encoded requests.
- Panel data: invalid locales stay REST-only without rebuilding on every page view, the file is written atomically, malformed cached entries are rebuilt, and upload directory errors fall back to the REST URL.
- Uninstall also cleans every site of a multisite network and falls back to deleting files when the filesystem is not direct. The plugin now reports a missing `build/bootstrap.js` or `build/launcher.css`.
- Bootstrap keeps the early click handler when stored state is corrupt, and the loader shows a built-in message when the load error string is empty.

### Security

- Visibility URL patterns use a linear wildcard matcher with a length cap instead of a regular expression (no ReDoS).
- `GET /panel-data` returns 404 for locales the site does not use.
- Bootstrap rejects stored CSS variable values containing `url(`, `image-set(`, `expression`, `;`, `{`, `}` or more than 200 characters, builds the page CSS link with DOM APIs and escapes the URL on the `document.write` path, and clears the hidden toolbar key on `?ka11y=reset`.
- Loader command and group lookups ignore inherited keys such as `constructor` and `__proto__`; a failed JSON encoding no longer prints a broken inline script.

### Changed

- The logged-out pseudo-role is now `__guest` so it cannot collide with a real role slug. It was introduced in this unreleased work, so no migration is needed.

## [0.1.3] - 2026-11-24

### Added

- `kotlinskidev_a11y_cache_invalidated` action with a `$reason` argument: `settings` after settings are saved, imported or reset (once per request), `update` once after the plugin version changes.

### Docs

- README Installation and Page caches sections, with purge snippets for common cache plugins.

## [0.1.2] - 2026-11-24

### Fixed

- Reading mask, reading line and the ADHD profile no longer freeze the page: overlay classes no longer collide with the state classes on `<html>`. A build check now rejects unscoped state-class selectors.
- The reading mask appears only after the first pointer move instead of darkening the page on load.

### Added

- Recovery URLs: `?ka11y=reset` clears saved state, `?ka11y=off` disables the widget for that page view.
- Admin notice when `vendor/` or `build/` is missing, pointing to the release zip, instead of a silent stop.
- Playwright invariants test for every feature, level and profile, plus the roadmap in `docs/ROADMAP.md`.

## [0.1.1] - 2026-11-24

### Added

- Settings schema, sanitizer and repository with a REST controller and import/export round-trip.
- Page-language aware strings (Polylang, WPML, TranslatePress, `determine_locale()`) with `pl_PL` shipped beyond English.
- Front end: device-aware visibility, asset loading, Shadow DOM widget markup and a pre-paint head bootstrap.
- Widget core: store, storage modes (local, cookie, none), theme handling, accessible dialog, `Alt+Shift+A` shortcut, `#kotlinskidev-a11y` hash open, reset and hide toolbar.
- Content, color and orientation features, plus profiles with provenance.
- Admin settings page rendered from the REST schema, with alt-text tools, accessibility statement and dashboard widget.
- Updates through Plugin Update Checker v5 and GitHub Releases, swappable via `kotlinskidev_a11y_update_source` and `kotlinskidev_a11y_update_token`.
- `npm run check-version` and `npm run release` keep the plugin header, PHP constant, `package.json`, CHANGELOG and git tag in sync.
- GitHub Actions: CI (PHPCS, PHPUnit on PHP 8.1 and 8.3, ESLint, tsc, Jest, build, version check) and a tag-triggered release that builds `kotlinskidev-accessibility.zip`.

## [0.1.0] - 2026-11-24

### Added

- Plugin scaffold: header, bootstrap class, esbuild and dart-sass pipeline, PHPUnit, Jest, ESLint, PHPCS tooling.
