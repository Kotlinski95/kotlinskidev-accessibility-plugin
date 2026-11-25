# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Settings core, schema v5: settings resolve in layers (defaults, network defaults, site values, locks) and the site option stores only values that differ from the defaults below it. Locks come from `KOTLINSKIDEV_A11Y_LOCKED_SETTINGS`, the `kotlinskidev_a11y_locked_settings` filter or network locks; invalid locks are dropped.
- Versioned export envelope and import with a version check. `POST /settings`, `/import` and `/reset` take `dry_run` and return the changes, `/reset` takes `paths`, locked paths return 409, bodies over 262144 B return 413, and `/schema` lists `effectiveDefaults`, `locked` and `sources`. `maintenance.keepDataOnUninstall` is added to the schema.
- Golden payload tests prove the inline config, panel data, bootstrap prefix and token CSS are byte-identical to v0.4.0, and a CI guard fails pull requests that touch front-end source unless they carry the `frontend-change` label.
- A change to locks or network defaults purges page caches, detected by a fingerprint checked on admin requests and cron.
- Update channels: a Maintenance tab Updates card (for `update_plugins` users) switches between stable and beta, `KOTLINSKIDEV_A11Y_UPDATE_CHANNEL` and the `kotlinskidev_a11y_update_channel` filter override it. `KOTLINSKIDEV_A11Y_DISABLE_UPDATER` or the `kotlinskidev_a11y_enable_updater` filter turn the updater, rollback and update routes off.
- Plugin zips are checked against their `.sha256` before unzipping, and the release workflow now writes the checksum, attests build provenance, pins every action by commit SHA, uses `CHANGELOG.md` as the release notes and marks `-beta` and `-rc` tags as pre-releases. `npm run release` takes `--pre beta|rc`.
- Rollback to the 3 newest older releases (not below v0.4.0) from the Updates card, via `GET /releases`, `GET` and `POST /update-channel` and a confirmation page. It backs settings up to `kotlinskidev_a11y_settings_backup` and downloads the zip only after the checksum check.

### Fixed

- Sparse storage no longer flips a site value that equals the plugin default but differs from a network default, saving keeps the stored value of locked paths, and `POST /import` of a version-less tree is no longer treated as v1. `/reset` rejects empty `paths` and oversized bodies, `dry_run` must be a boolean, and a real import with conflicting locked paths returns 409.
- Language switcher returns the shipped translation for locales without an installed core language pack: `Strings::for_locale()` loads `languages/kotlinskidev-accessibility-{locale}.mo` when `switch_to_locale()` does nothing, then restores the previous text domain.

## [0.4.0] - 2026-11-25

### Added

- Appearance tab: style presets (`classic`, `brand`, `soft`, `contrast`), header, canvas and dark primary color tokens with a live contrast check, tile columns, section toggles and a language switcher toggle. Settings schema v4.
- Panel language switcher that changes the widget language only and remembers the choice in `localStorage` under `<storage key>-locale`.
- Inline SVG icon set built from path data, with the `kotlinskidev_a11y_icons` and `kotlinskidev_a11y_locale_label` filters.
- `/panel-data` payload carries `panel`, `layout`, `locales` and `icons`.
- Visual snapshot and panel UI e2e specs.

### Changed

- Panel redesign: header with language switcher, section cards, icon tiles, steppers and a skip-to-content select; the dialog is non-modal and uses a side panel on desktop and a bottom sheet on mobile. The panel chunk budget is 8704 B gzip (was 7168): the chunk loads only on first open and the redesign, icons and language switcher account for the growth.
- Internal shadow classes `.ka11y-toggle`, `.ka11y-profile`, `.ka11y-grid`, `.ka11y-feature`, `.ka11y-section` and `.ka11y-group` are removed. Custom CSS that targets them must be updated, see the README.
- Escape closes the panel only when focus is inside it or on the launcher.

### Fixed

- Dark mode pressed tiles and the focus ring on the dark header now meet the 3:1 non-text contrast minimum.
- The panel host no longer carries a `transform`, which broke fixed positioning of the panel.

## [0.3.0] - 2026-11-25

### Added

- One action vocabulary: `open`, `close`, `toggle`, `reset`, `feature:<key>[:<level>]`, `profile:<key>`, `statement`, `hide`, `show`. See `docs/API.md`.
- Triggers from `data-ka11y`, `#ka11y/<action>` links, the `.ka11y-open` class, custom selectors, `?ka11y=<action>` and landing hashes. URL actions are allowlisted, applied only to enabled features, never saved by themselves and removed from the address bar.
- Public JavaScript API `kotlinskidevA11y.open()`, `close()`, `toggle()`, `set()`, `reset()`, `getState()` and `on()`, plus the events `ka11y:ready`, `ka11y:open`, `ka11y:close` and `ka11y:change`.
- Trigger button renderer with the `[kotlinskidev_a11y_button]` shortcode, the `kotlinskidev-a11y/trigger` block, `kotlinskidev_a11y_button()` and `kotlinskidev_a11y_get_button()`. Default trigger labels are new strings.
- Launcher modes `floating`, `inline` and `hidden`, and settings schema v3 for them.
- Triggers tab in the admin with a snippet generator, a no-trigger check of the home page and URL action settings.
- Filters `kotlinskidev_a11y_button_html`, `kotlinskidev_a11y_trigger_selectors` and `kotlinskidev_a11y_url_actions`, and the `GET kotlinskidev-a11y/v1/trigger-options` route.
- `docs/API.md` with the versioned public API and the deprecation policy.
- E2E trigger matrix across every load strategy.

### Changed

- Triggers get `role="button"`, `aria-haspopup`, `aria-controls`, `aria-expanded` or `aria-pressed` automatically, and focus returns to the opener, the previously focused element, the launcher or the page.
- Custom trigger selectors are checked for balanced brackets, parentheses and quotes, and are emitted as one forgiving `:is()` list so one invalid selector no longer disables the others.
- The trigger block wraps itself in a navigation list item inside the Navigation block and no longer narrows its allowed blocks.
- Page footprint budgets raised for the trigger code. See `docs/PHASE4-SPEC.md`.

### Removed

- The `kotlinskidev_a11y_legacy_config` filter and the front-end merge of `features`, `profiles`, `widget`, `theme`, `tokens`, `hideToolbar`, `statementUrl`, `customCss` and the full `strings` into `window.kotlinskidevA11y`, deprecated in v0.2.0. Read them from the panel data (`GET kotlinskidev-a11y/v1/panel-data` or the per-locale JSON file) instead.

### Fixed

- A markup value such as `data-ka11y="constructor"` no longer aborts the loader.
- Trigger buttons never render without an accessible name, and a statement button without a statement URL renders nothing.
- The plugin text domain loads on WordPress 6.4.

### Security

- URL actions cannot reach disabled features, `close`, `toggle`, `reset`, `statement`, `hide` or `show`, and trigger markup is built with escaped values and filtered through `wp_kses`.

## [0.2.0] - 2026-11-25

### Added

- Performance tab with presets Recommended, Compatibility and Custom: load strategy, script position, fetch priority, panel prefetch, Page CSS mode (lazy, linked, inline), device skip and optimizer opt-out. The admin shows the estimated cost per page.
- Where to load: everywhere, only on, or except on, by post, post type, template, role (including `__guest`) and URL pattern.
- Panel data as a versioned JSON file per locale from uploads, with a REST fallback at `kotlinskidev-a11y/v1/panel-data` and a new `loadError` string.
- `kotlinskidev_a11y_cache_invalidated` fires with `translations` after language packs update.
- `kotlinskidev_a11y_legacy_config` filter keeps the moved config fields inline until v0.3.0.
- Admin notice for sites migrated from v0.1 recommending the Recommended preset, dismissible per user.
- Settings schema v2 with a v1 migration and `presets` in `GET /schema`.
- Tests and CI: hostile fixture theme, loading, compat and perf E2E specs, PHPStan level 8, Plugin Check, nightly matrix and Lighthouse comparison. See `docs/TESTING.md`.

### Changed

- Only a loader of at most 2 KB gzip runs on every page. The panel, the features and the page CSS load on first use. Visitors with saved settings still get them before first paint.
- The launcher is server-rendered in a declarative shadow root and shows a loading and an error state.
- `window.kotlinskidevA11y` holds only what the loader needs. The rest arrives with the panel data.
- Document-level custom CSS is printed in the page head. CSS that targets the launcher inside the shadow root applies after the first open.
- The panel dialog returns focus to the opener passed with the open command, and the launcher by default.
- Page footprint budget: bootstrap plus loader at most 3840 B gzip.

### Deprecated

- Reading `features`, `profiles`, `widget`, `theme`, `tokens`, `hideToolbar`, `statementUrl`, `customCss` or the full `strings` from `window.kotlinskidevA11y` at page load. Use `kotlinskidev_a11y_legacy_config` until v0.3.0.

### Removed

- `advanced.loadStrategy`. Existing values migrate to the Custom preset.
- `build/frontend.js` and `frontend.asset.php`.

### Fixed

- Visibility: post ID and post type rules match singular views only, the decision is made once per request, and non-ASCII URL patterns match percent-encoded requests.
- Panel data: invalid locales stay REST-only, the file is written atomically, malformed cache entries are rebuilt, and upload errors fall back to REST.
- Uninstall cleans every site of a multisite network. A missing `build/bootstrap.js` or `build/launcher.css` is reported.
- Bootstrap keeps the early click handler when stored state is corrupt, and the loader shows a built-in message when the load error string is empty.

### Security

- Visibility URL patterns use a linear wildcard matcher with a length cap (no ReDoS).
- `GET /panel-data` returns 404 for locales the site does not use.
- Bootstrap rejects unsafe stored CSS variable values, builds the page CSS link with DOM APIs, and clears the hidden toolbar key on `?ka11y=reset`.
- Loader lookups ignore inherited keys such as `constructor` and `__proto__`. A failed JSON encoding no longer prints a broken inline script.

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
