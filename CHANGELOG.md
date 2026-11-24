# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
