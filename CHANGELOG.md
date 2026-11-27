# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [1.0.3] - 2026-11-27

### Changed

- Read page now reads on hover (after a 300 ms pause) and on keyboard focus instead of on click, so links and buttons navigate normally. New settings `readPage.trigger` (`hover`, `click`, `both`) and `readPage.hoverDelay` (0 to 2000 ms) on the Features tab; `click` keeps the old behavior. On touch, a tap on plain text reads it.

- Size budget raised: orientation chunk 4800 to 5760 B gzip for the hover, focus and touch Read page triggers. Loader, bootstrap and every-page total are unchanged.

### Fixed

- Highlight links now forces dark text, no text shadow and no gradient background on every link and everything inside it, so gradient or white link text and text inside the theme's protected content block stays readable on the yellow highlight. Colors are tunable with `--ka11y-link-highlight-bg` and `--ka11y-link-highlight-fg`.

## [1.0.2] - 2026-11-27

### Added

- Read page voice and speaking speed settings (`readPage.voice`, `readPage.rate`) on the Features tab, with a list of the voices installed on the admin's device. They load with the panel data; `window.kotlinskidevA11yReadPage` still overrides them.
- General tab checkbox "Show the floating accessibility button" and exact launcher sizes in rem (`widget.sizeRem`, `widget.sizesRem.<device>`, 1.5 to 5). The admin preview follows both. Default size and look are unchanged.

### Changed

- Size budgets raised: launcher styles 1510 to 1530 B raw, orientation chunk 4736 to 4800 B gzip. Loader, bootstrap and every-page total are unchanged.
- Regression tests cover opening the panel from `data-ka11y` triggers, the public API and a visitor-hidden toolbar while the launcher is hidden.

## [1.0.1] - 2026-11-27

### Added

- Presence probe for themes: constant `KOTLINSKIDEV_A11Y_API` and `kotlinskidev_a11y_api_version()`, plus an Integrating a theme guide in `docs/API.md`.
- Filter `kotlinskidev_a11y_default_selectors` to set the default dark and light mode selectors from a theme.
- Motion state for scripts: `window.kotlinskidevA11yMotion`, the `kotlinskidev-a11y:motion` event, and `prefers-reduced-motion` queries that report reduce while Stop animations is on. Documented in `docs/API.md`.
- Read page options `window.kotlinskidevA11yReadPage = { voice, rate }` and a visitor `ka11y-voice-pref` key.

### Changed

- Default dark and light selectors are now a neutral set (`html.dark`, `html.dark-mode`, `html[data-theme="dark"]`, `body.dark`, `body.dark-mode` and the `light` equivalents), a superset of the old defaults. Sites that stored the old values keep them.
- Read page strictly prefers on-device voices over remote or Google voices, skips macOS novelty voices, no longer stores the automatic pick, queues long text in large chunks for local voices and sets rate, pitch and volume. It reads in the language of the clicked element.
- Line height also raises block containers whose text sits only in inline children, such as list items with links.
- Letter spacing, font weight, fonts and text alignment out-rank theme `!important` rules.
- Size budget for the orientation chunk raised from 3840 to 4736 B gzip (Read page voice ranking and motion state). Loader, bootstrap and every-page total are unchanged.

### Fixed

- Dark and light contrast no longer make gradient text (`background-clip: text` with a transparent text fill) invisible.

## [1.0.0] - 2026-11-27

First stable release. Adds full control over the panel and launcher look, theme colors and a reorderable feature list, on top of the settings management work from the beta.

### Added

- Feature order: reorder adjustments inside each section on the Features tab with up and down buttons (`panel.order`).
- Language mode (`panel.languageMode`): let visitors choose a language, or follow the page language.
- Panel layout: width (`panel.width`), side (`panel.side`) and offset (`panel.offset`).
- Panel backdrop with color, opacity, blur and close on click (`panel.backdrop*`).
- Panel animation: slide, fade or none, with a duration (`panel.animation`, `panel.animationMs`).
- Launcher shape (circle, rounded, square), its own background and icon colors, and a size per device.
- Dark-mode launcher colors (`widget.bgDark`, `widget.fgDark`). They apply on first paint without JavaScript and follow the dark-mode selector and the system color scheme.
- Theme colors: every color field has a "From theme" choice and the Appearance tab has a Match theme button. Values are stored as `var(--wp--preset--color--<slug>, #fallback)`.
- Panel footer credit line "Developed by Adrian Kotlinski", which can be turned off (`panel.credit`).

### Changed

- Size budgets raised for the new panel and launcher options (panel 9520 B, orientation 3840 B, launcher CSS 1510 B). The loader, bootstrap and every-page total are unchanged.
- Read page aloud picks the best installed voice for the page language, remembers it, and reads long text in short chunks.
- The language select has a custom arrow, themed options and forced-colors support.

### Fixed

- The language list shows each language once.
- The tile grid has no gaps next to the Bigger text and Line height steppers.
- Read page no longer drops its first sentence after a cancel and stops when you leave the page.

## [1.0.0-beta.1] - 2026-11-26

Settings management for sites and networks, plus update channels.

### Added

- Settings tools: search, change preview before save, import, reset (all or per tab), locked fields and a Maintenance tab.
- Versioned export files. Files from a newer plugin are refused, older files are migrated.
- Layered settings: plugin defaults, network defaults, site values and locks (`KOTLINSKIDEV_A11Y_LOCKED_SETTINGS`).
- Customer capability `kotlinskidev_a11y_customize` for editing only labels, statement, colors, panel options and mode.
- WP-CLI commands `wp ka11y settings`, `doctor` and `access`.
- Multisite network defaults page and REST routes.
- Site Health checks and a debug section.
- Stable and beta update channels, rollback to the 3 newest older releases, and SHA-256 checks of update zips.
- Privacy policy text and an uninstall choice to keep data.

### Changed

- The site option stores only values that differ from the defaults.
- Release workflow publishes a checksum and build attestation, and marks beta tags as pre-releases.

### Fixed

- The panel data cache is cleared when the plugin version changes.
- Saving keeps locked values, and importing a file without a version is handled correctly.
- The language switcher shows shipped translations for locales without a language pack.

### Security

- Update zips are verified before unzipping. A package without a checksum is flagged.

## [0.4.1] - 2026-11-26

Fixes the panel failing to load after an update.

### Fixed

- After a plugin update the panel could show "Accessibility tools could not load" because the old panel data file was kept. It is now refreshed.

## [0.4.0] - 2026-11-25

Redesigned panel and an Appearance tab.

### Added

- Appearance tab with style presets, color tokens with a live contrast check, tile columns and section toggles.
- Panel language switcher that remembers the choice.
- Built-in icon set.

### Changed

- New panel: header, section cards, icon tiles, steppers and a skip-to-content select. Side panel on desktop, bottom sheet on mobile.
- Escape closes the panel only when focus is inside it or on the launcher.
- Some internal shadow classes were removed. Update custom CSS that used them.

### Fixed

- Dark mode pressed tiles and focus ring meet the 3:1 contrast minimum.
- The panel host no longer breaks fixed positioning.

## [0.3.0] - 2026-11-25

Triggers and a public API.

### Added

- Open the panel from `data-ka11y` attributes, `#ka11y/<action>` links, the `.ka11y-open` class, custom selectors and `?ka11y=` URLs.
- JavaScript API `kotlinskidevA11y` with events.
- Trigger button shortcode `[kotlinskidev_a11y_button]`, a block and PHP functions.
- Launcher modes: floating, inline and hidden.
- Triggers tab with a snippet generator and a check for sites without a trigger.

### Changed

- Triggers get the right ARIA attributes, and focus returns to the opener.
- Custom trigger selectors are validated, and one bad selector no longer breaks the rest.

### Removed

- The v0.2 compatibility filter `kotlinskidev_a11y_legacy_config`.

### Fixed

- A value such as `data-ka11y="constructor"` no longer stops the loader.
- Trigger buttons always have an accessible name.
- The text domain loads on WordPress 6.4.

## [0.2.0] - 2026-11-25

Faster pages. Only a small loader runs everywhere.

### Added

- Performance tab with presets, load strategy and cost estimate.
- Where to load rules by post, post type, template, role and URL.
- Panel data as a cached JSON file per language.

### Changed

- The panel, features and page CSS load on first use. Visitors with saved settings still get them before first paint.
- The launcher is rendered on the server inside a shadow root.

### Deprecated

- Reading settings from `window.kotlinskidevA11y` at page load.

### Removed

- The `advanced.loadStrategy` setting.

### Fixed

- Visibility rules match correctly for posts, post types and non-ASCII URLs.
- Uninstall cleans every site of a multisite network.

### Security

- URL patterns are matched without ReDoS risk, and unsafe stored values are rejected.

## [0.1.3] - 2026-11-24

Page cache support.

### Added

- Action `kotlinskidev_a11y_cache_invalidated` for page cache purging.
- README install and page cache sections.

## [0.1.2] - 2026-11-24

Fixes freezing overlays and adds recovery URLs.

### Added

- Recovery URLs `?ka11y=reset` and `?ka11y=off`.
- Admin notice when `vendor/` or `build/` is missing.

### Fixed

- Reading mask, reading line and the ADHD profile no longer freeze the page.
- The reading mask appears only after the first pointer move.

## [0.1.1] - 2026-11-24

First usable release.

### Added

- Settings schema, REST controller and import and export.
- Page-language aware strings for Polylang, WPML and TranslatePress, with Polish included.
- Widget with content, color and orientation features, profiles, shortcut `Alt+Shift+A` and hide toolbar.
- Admin settings page with alt-text tools and an accessibility statement.
- Updates from GitHub Releases.
- CI and a tag-triggered release workflow.

[Unreleased]: https://github.com/Kotlinski95/kotlinskidev-accessibility-plugin/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Kotlinski95/kotlinskidev-accessibility-plugin/compare/v1.0.0-beta.1...v1.0.0
[1.0.0-beta.1]: https://github.com/Kotlinski95/kotlinskidev-accessibility-plugin/compare/v0.4.1...v1.0.0-beta.1
[0.4.1]: https://github.com/Kotlinski95/kotlinskidev-accessibility-plugin/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/Kotlinski95/kotlinskidev-accessibility-plugin/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/Kotlinski95/kotlinskidev-accessibility-plugin/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Kotlinski95/kotlinskidev-accessibility-plugin/compare/v0.1.3...v0.2.0
[0.1.3]: https://github.com/Kotlinski95/kotlinskidev-accessibility-plugin/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/Kotlinski95/kotlinskidev-accessibility-plugin/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/Kotlinski95/kotlinskidev-accessibility-plugin/releases/tag/v0.1.1
