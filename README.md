# Kotlinskidev Accessibility

Standalone GPL accessibility widget for WordPress. Visitors open a floating launcher and adjust text, colors and orientation to their needs. Site owners configure everything from Settings > Accessibility, the REST API or WP-CLI.

Current version 1.0.0. License GPL-2.0-or-later. Text domain `kotlinskidev-accessibility`. English and Polish (`pl_PL`) ship in the box.

## Contents

- [Overview](#overview)
- [Requirements](#requirements)
- [Installation and updates](#installation-and-updates)
- [Quick start](#quick-start)
- [Settings reference](#settings-reference)
- [Theme integration](#theme-integration)
- [Colors and theme palette](#colors-and-theme-palette)
- [Languages](#languages)
- [Features and Read page](#features-and-read-page)
- [Panel layout](#panel-layout)
- [Triggers and JavaScript API](#triggers)
- [Hooks, filters and frozen contracts](#hooks-and-frozen-contracts)
- [REST API](#rest-api)
- [WP-CLI](#wp-cli)
- [Performance](#performance)
- [Privacy and storage (GDPR)](#privacy-and-storage-gdpr)
- [Accessibility notes](#accessibility-notes)
- [Managing the plugin](#managing-the-plugin)
- [Development](#development)
- [Release process](#release-process)
- [License](#license)

## Overview

- 26 adjustments in four groups: content (text size, line height, letter spacing, font weight, readable and dyslexia-friendly fonts, text alignment, link highlight, big cursor, text magnifier, cognitive reading), color (dark, light and high contrast, monochrome, saturation), orientation (reading line and mask, Read page, keyboard navigation, hide images, mute sounds, highlight titles and everything, stop animations, skip to content).
- 5 profiles that switch several adjustments at once: vision impaired, seizure safe, ADHD friendly, blindness, epilepsy safe.
- Floating, inline or hidden launcher, plus buttons, links, shortcodes and a block that open the panel from anywhere.
- Settings per device, per language, per role and per URL. Theme-aware colors with dark-mode support.
- A built-in accessibility statement page generator and alt-text helper tools.
- Small footprint: a loader of about 4 KB gzip runs on every page and everything else loads on first use.
- Updates from GitHub Releases with stable and beta channels, rollback, locks, customer access and multisite network defaults.

## Requirements

- WordPress 6.4 or newer, PHP 8.1 or newer.
- Node 20 or newer (22 in CI) and Composer, only for building from source.
- Optional: Polylang, WPML or TranslatePress for language matching, the PHP `intl` extension for native language names.

## Installation and updates

1. Download `kotlinskidev-accessibility.zip` from the latest GitHub Release. Do not download "Source code (zip)": it lacks `vendor/` and `build/` and the plugin will not run.
2. In WordPress open Plugins, Add New, Upload Plugin, choose the zip and activate.
3. Open Settings > Accessibility.

Updates arrive through the Plugins screen like any other plugin. The "Check for updates" link on the plugin row forces an immediate check; otherwise the updater runs about every 12 hours. Details on [channels](#update-channel) (stable or beta, constant `KOTLINSKIDEV_A11Y_UPDATE_CHANNEL`), [rollback](#rolling-back), [turning the updater off](#turning-the-updater-off) and [verifying a download](#verifying-a-release) are below.

## Quick start

1. Activate the plugin. The launcher appears at the bottom right of every page with sensible defaults.
2. General tab: show or hide the floating button, choose its corner per device, size (small, medium, large or an exact rem value), shape and colors.
3. Appearance tab: pick a preset, or press Match theme to take colors from the active theme palette, and set the dark-mode selector if your theme uses one.
4. Languages tab: edit widget labels and set the accessibility statement page.
5. Performance tab: keep the Recommended preset.
6. Purge your page cache if you use one, see [Page caches](#page-caches).

If something goes wrong on a page, `?ka11y=reset` clears saved visitor state and `?ka11y=off` disables the widget for that page view.

## Settings reference

Every setting is a dot path in the `kotlinskidev_a11y_settings` option, defined in `src/php/Settings/Schema.php`. The admin tabs, REST API (`/schema`, `/settings`) and WP-CLI all read the same schema. Values the sanitizer would change are corrected on save. Colors accept `#rgb`, `#rrggbb`, `#rrggbbaa` and the theme reference described under [Colors](#colors-and-theme-palette).

### General tab

| Key | Type | Default | Effect |
| --- | --- | --- | --- |
| `widget.launcher` | enum | `floating` | `floating`, `inline` or `hidden`. The General tab checkbox "Show the floating accessibility button" switches between `floating` and `hidden`; `inline` is chosen on the Triggers tab. Hidden removes only the button: every trigger, the shortcut and the API still open the panel. |
| `widget.position.<device>` | enum | `bottom-right` | Launcher corner for `desktop`, `tablet`, `mobile`: `bottom-right`, `bottom-left`, `top-right`, `top-left`, `middle-right`, `middle-left`. |
| `widget.offsetX.<device>`, `widget.offsetY.<device>` | int 0-500 | `20` | Distance from the screen edge in pixels, per device. |
| `widget.size` | enum | `md` | Launcher size `sm`, `md`, `lg` (40, 52, 64 px). |
| `widget.sizes.<device>` | enum | `inherit` | Size per device: `inherit`, `sm`, `md`, `lg`. |
| `widget.sizeRem` | number 1.5-5 or empty | empty | Exact launcher size in rem (2.5 matches the cookie banner button). Overrides `widget.size` when set; the icon scales with it and the 2.75rem minimum no longer applies. |
| `widget.sizesRem.<device>` | number 1.5-5 or empty | empty | Exact size per device. Wins over `widget.sizes.<device>` and `widget.sizeRem`. |
| `widget.shape` | enum | `circle` | `circle`, `rounded` or `square`. |
| `widget.bg`, `widget.fg` | color | empty | Launcher background and icon color. Empty uses the primary tokens from Appearance. |
| `widget.bgDark`, `widget.fgDark` | color | empty | Launcher colors in dark mode. Empty keeps the light-mode value. |
| `widget.icon` | icon | `universal` | `universal` or the ID of a Media Library attachment. |
| `widget.iconBorder` | bool | `false` | Draws a border around the icon. |

### Features tab

| Key | Type | Default | Effect |
| --- | --- | --- | --- |
| `features.<key>.enabled` | bool | `true` | Shows the adjustment in the panel. Hidden ones stay reachable by triggers and the API. |
| `features.<key>.default` | level 0-10 or `false` | `false` | Level applied for new visitors. `false` and `0` are off. |
| `panel.order` | list | built-in order | Order of adjustments inside each section, set with the up and down buttons. |
| `readPage.voice` | text | empty | Voice for Read page. Empty is automatic; otherwise the exact voice name (the Features tab lists the voices installed on the admin's device). A name the visitor does not have falls back to automatic. |
| `readPage.rate` | number 0.5-2 | `1` | Speaking speed for Read page. |

The 26 keys are: `biggerText`, `lineHeight`, `letterSpacing`, `fontWeight`, `readableFont`, `dyslexicFont`, `textAlign`, `highlightLinks`, `bigCursor`, `textMagnifier`, `cognitiveReading`, `darkContrast`, `lightContrast`, `highContrast`, `monochrome`, `saturation`, `readingLine`, `readingMask`, `readPage`, `keyboardNavigation`, `hideImages`, `muteSounds`, `highlightTitles`, `highlightAll`, `stopAnimations`, `skipToContent`.

### Profiles tab

| Key | Type | Default | Effect |
| --- | --- | --- | --- |
| `profiles.<key>.enabled` | bool | `true` | Shows the profile. Keys: `visionImpaired`, `seizureSafe`, `adhdFriendly`, `blindness`, `epilepsySafe`. |
| `profiles.<key>.features` | list | per profile | Adjustments the profile switches on. |

### Visibility tab

| Key | Type | Default | Effect |
| --- | --- | --- | --- |
| `visibility.devices.<device>` | bool | `true` | Show the widget on desktop, tablet or mobile. |
| `visibility.breakpoints.tablet`, `.mobile` | int 320-4096 | `1024`, `768` | Largest width in pixels that counts as tablet and as mobile. |
| `visibility.mode` | enum | `everywhere` | `everywhere`, `only_on` or `except_on`. |
| `visibility.includePostIds`, `includePostTypes`, `includeTemplates`, `includeRoles`, `includeUrlPatterns` | lists | empty | Where the widget shows when the mode is `only_on`. Role `__guest` means logged-out visitors. |
| `visibility.excludePostIds`, `excludePostTypes`, `excludeTemplates`, `excludeRoles`, `excludeUrlPatterns` | lists | empty | Where it is hidden when the mode is `except_on`. |

### Appearance tab

| Key | Type | Default | Effect |
| --- | --- | --- | --- |
| `panel.preset` | enum | `classic` | `classic`, `brand`, `soft`, `contrast`, `custom`. Fills the color tokens. |
| `theme.mode` | enum | `auto` | `auto`, `light` or `dark` widget theme. |
| `theme.darkSelector`, `theme.lightSelector` | text | `html.dark, html.dark-mode, html[data-theme="dark"], body.dark, body.dark-mode`, and the `light` equivalents | Selectors that tell the widget your site is in dark or light mode. |
| `theme.followPrefersColorScheme` | bool | `true` | In `auto` mode, follow the visitor's system color scheme when no selector matches. |
| `tokens.primary`, `onPrimary` | color | `#0b57d0`, `#ffffff` | Primary color and text on it. |
| `tokens.primaryDark`, `onPrimaryDark` | color | `#7aa7ff`, `#0b1a33` | Same pair in dark mode. |
| `tokens.headerBg`, `onHeader` | color | `#16181d`, `#ffffff` | Panel header. |
| `tokens.canvasLight`, `canvasDark` | color | `#f2f4f7`, `#101114` | Panel background. |
| `tokens.surfaceLight`, `surfaceDark` | color | `#ffffff`, `#1b1b1f` | Cards and tiles. |
| `tokens.textLight`, `textDark` | color | `#1b1b1f`, `#f2f2f2` | Text. |
| `tokens.radius` | length | `12px` | Corner radius. |
| `tokens.zIndex` | int | `2147483000` | Stacking order of the widget. |
| `tokens.fontFamily` | text | `inherit` | Panel font. |
| `panel.columns` | int 2-3 | `3` | Tiles per row. |
| `panel.sections.<name>` | bool | `true` | Show the `profiles`, `content`, `color`, `orientation` and `skip` cards. |
| `panel.languageSwitcher`, `panel.languageMode` | bool, enum | `true`, `choose` | See [Languages](#languages). |
| `panel.credit` | bool | `true` | Footer line "Developed by Adrian Kotlinski". |
| `panel.width`, `panel.side`, `panel.offset` | int 280-640, enum, int 0-200 | `448`, `auto`, `0` | See [Panel layout](#panel-layout). |
| `panel.animation`, `panel.animationMs` | enum, int 0-1000 | `slide`, `220` | Open animation. |
| `panel.backdrop`, `backdropColor`, `backdropOpacity`, `backdropBlur`, `closeOnBackdrop` | bool, color, int 0-100, int 0-20, bool | `false`, `#000000`, `40`, `0`, `true` | Page backdrop behind the open panel. |
| `customCss` | css | empty | Extra CSS printed in the page head. |

### Languages tab

| Key | Type | Default | Effect |
| --- | --- | --- | --- |
| `labels` | map | empty | Overrides for widget strings, per locale. |
| `statement.pageId` | int | `0` | Page used as the accessibility statement. |
| `statement.url` | url | empty | External statement address, used when no page is chosen. |
| `statement.content` | map | empty | Statement HTML per locale for the built-in statement. |

### Behavior tab

| Key | Type | Default | Effect |
| --- | --- | --- | --- |
| `storage.mode` | enum | `local` | `local`, `cookie` or `none`. |
| `storage.ttlDays` | int 1-3650 | `365` | Lifetime of saved choices. |
| `storage.key` | text | `ka11y` | Storage key. Changing it forgets saved visitor choices. |
| `shortcut.enabled`, `shortcut.combo` | bool, text | `true`, `Alt+Shift+A` | Keyboard shortcut that toggles the panel. |
| `hideToolbar.allow`, `hideToolbar.days` | bool, list | `true`, `1, 7, 30` | Let visitors hide the launcher, and the durations offered. |
| `advanced.excludeSelectors` | text | `#wpadminbar` | Elements the page adjustments do not touch. |

### Triggers tab

| Key | Type | Default | Effect |
| --- | --- | --- | --- |
| `widget.launcher` | enum | `floating` | `floating`, `inline` (placed where `widget.mount` points) or `hidden` (only triggers). |
| `widget.mount` | selector | empty | Where the inline launcher is placed. |
| `triggers.selectors` | list, max 10 | empty | CSS selectors that toggle the panel when clicked. |
| `triggers.urlActions` | list | `open`, `feature`, `profile` | Actions allowed from `?ka11y=` and `#ka11y/` URLs. |

### Performance tab

| Key | Type | Default | Effect |
| --- | --- | --- | --- |
| `performance.preset` | enum | `recommended` | `recommended`, `compatibility` or `custom`. |
| `performance.strategy` | enum | `interaction` | `interaction`, `idle`, `defer`, `async`, `eager`. |
| `performance.position` | enum | `footer` | `head` or `footer`. |
| `performance.fetchPriority` | enum | `low` | `low`, `auto`, `high`. |
| `performance.prefetch` | enum | `hover` | `none`, `hover`, `idle`. |
| `performance.pageCss` | enum | `lazy` | `lazy`, `linked`, `inline`. |
| `performance.deviceSkip` | bool | `true` | Skip downloads on devices where the widget is hidden. |
| `performance.optOut` | list | empty | Tell `cloudflare`, `wp-rocket`, `litespeed`, `jetpack-boost`, `asset-cleanup` to leave the widget scripts alone. |

### Maintenance tab

| Key | Type | Default | Effect |
| --- | --- | --- | --- |
| `maintenance.keepDataOnUninstall` | bool | `false` | Keep all plugin data when the plugin is deleted. |

The Maintenance tab also holds the Updates card, the locks list on a network, and the reset tools. The Import and Export tab has no settings of its own. See [Settings screen](#settings-screen).

## Theme integration

Themes feature-detect the plugin with `defined( 'KOTLINSKIDEV_A11Y_API' )` or `kotlinskidev_a11y_api_version()` (both `1`) and `window.kotlinskidevA11y?.api === 1` in the browser. A theme can open the panel with `data-ka11y="open"`, react to `ka11y:*` events and to Stop animations through `html.ka11y-stop-animations`, and set the dark and light selectors with the `kotlinskidev_a11y_default_selectors` filter. Details are in `docs/API.md` under Integrating a theme.

## Colors and theme palette

Every color field has a color picker, a text box and, when the active theme defines a palette, a "From theme" select. Picking a theme color stores `var(--wp--preset--color--<slug>, #fallback)` instead of a plain hex value. The widget then follows the theme when the palette changes, and the hex fallback is used where the theme does not define the color. The admin contrast badges use the fallback hex and say when a result is approximate.

Match theme (Appearance tab) sets the primary color from the palette slug `primary`, then `accent`, then the first palette color, and the dark primary from `primary-dark` when it exists. Check the contrast badges afterwards. A failing pair never blocks saving.

Launcher colors:

- `widget.bg` and `widget.fg` color the launcher in light mode. Leave them empty to use the primary tokens.
- `widget.bgDark` and `widget.fgDark` color it in dark mode. They are printed in the inline token style next to the light values, under the `theme.darkSelector` (and the `prefers-color-scheme: dark` media query when `theme.followPrefersColorScheme` is on and the mode is `auto`). The launcher is therefore correct on first paint with no JavaScript and no flash. With `theme.mode` set to `dark` the dark colors always apply, with `light` they never do.

Example, a champagne gold launcher that stays readable on a dark site:

| Field | Value |
| --- | --- |
| Launcher background | `#7f6010` (white icon passes AA) |
| Launcher icon color | `#ffffff` |
| Launcher background (dark mode) | `#d4af37` |
| Launcher icon color (dark mode) | `#101114` |

## Languages

- The widget language follows the page language. The plugin matches it automatically through Polylang, WPML or TranslatePress, and falls back to `determine_locale()`. Filter `kotlinskidev_a11y_current_locale` overrides the result.
- Known locales come from the multilingual plugin, or from `en_US` plus the installed WordPress language packs. Filter `kotlinskidev_a11y_known_locales` changes the list. Each language appears once in the switcher.
- `panel.languageSwitcher` shows a language select in the panel header when there are two or more locales. It changes the widget language only, never the site, and the choice is remembered in `localStorage` under `<storage key>-locale`.
- `panel.languageMode`: `choose` lets visitors pick a language. `follow` pins the panel to the page locale, hides the choice and clears any saved visitor choice.
- Strings: edit them on the Languages tab (`labels`), through the `kotlinskidev_a11y_strings` filter, or with the shipped `.po` files in `languages/`.

## Features and Read page

Each adjustment is a tile or stepper in the panel, grouped into Content, Color and Orientation. Features exclude each other where they would conflict, for example the contrast modes. Saved choices are restored before first paint.

Read page (feature `readPage`) uses the browser speech synthesis. It reads in the language of the clicked element (nearest `lang` attribute, then the page language). It strictly prefers voices installed on the device (`localService`) in that language over remote or Google voices, then names that look enhanced, premium, natural or neural, then known natural system voices, and avoids macOS novelty voices such as Albert, Zarvox or Fred. Local voices read long text in large chunks, queued up front so there are no gaps; remote voices use short chunks with a pause and resume keep-alive for Chrome's 15 second limit. Rate, pitch and volume are set explicitly. Nothing is sent to a server and the automatically picked voice is not stored.

Set the voice and speed on the Features tab (`readPage.voice`, `readPage.rate`). They travel in the panel data, not the always-loaded inline config. A site owner can still override both before the widget loads, and the override wins over the settings:

```js
window.kotlinskidevA11yReadPage = { voice: 'Zosia (Enhanced)', rate: 0.95 };
```

`voice` is a voice name fragment or `voiceURI` (`auto` or empty keeps the automatic choice). `rate` is clamped to 0.5 to 2. A visitor can pin a voice with `localStorage.setItem('ka11y-voice-pref', 'Zosia')`. On macOS, install the enhanced or premium voice for the language in System Settings, Accessibility, Spoken Content, System Voice, Manage Voices, then restart the browser. Siri voices are not exposed to web pages. Google voices are online and sound robotic, so the plugin skips them whenever a local voice exists.

### Stop animations

`stopAnimations` adds the root class `ka11y-stop-animations`, disables CSS animations, transitions and smooth scrolling, pauses videos, freezes GIFs and publishes the state to scripts: `window.kotlinskidevA11yMotion.stopped` and the `kotlinskidev-a11y:motion` event on `window`. While it is on, `matchMedia('(prefers-reduced-motion: reduce)')` also reports `matches: true` for queries created after it is switched on, and the GSAP global timeline (when `window.gsap` exists) is paused. JavaScript or canvas animations should check the state and listen for the event; see `docs/API.md`.

Features can be switched on from code with `data-ka11y="feature:<key>[:<level>]"`, `#ka11y/feature:<key>` or `kotlinskidevA11y.set()`.

## Panel layout

- Order: adjustments appear in `panel.order` within each section.
- Columns: `panel.columns` 2 or 3, dropping to 2 and then 1 when the panel is narrow.
- Width: `panel.width` 280 to 640 px on desktop.
- Side: `panel.side` is `auto` (docked to the launcher's side), `left` or `right`. `panel.offset` is the gap from the screen edge. Below the mobile breakpoint the panel is a bottom sheet.
- Backdrop: optional dimmed, optionally blurred layer behind the panel with its own color and opacity. `closeOnBackdrop` closes the panel on click. The backdrop does not trap focus.
- Animation: `slide`, `fade` or `none`, with `panel.animationMs` duration. It is skipped when the visitor prefers reduced motion.

## Managing the plugin

Everything an owner or agency needs after installing, in one place:

| Task | Where |
| --- | --- |
| Find, review and reset settings | [Settings screen](#settings-screen) |
| Fix settings in code so nobody can change them | [Locking settings](#locking-settings) |
| Let a customer edit texts and colors only | [Customer access](#customer-access) |
| Script everything from the shell or CI | [WP-CLI](#wp-cli) |
| Set defaults for a whole network | [Multisite network defaults](#multisite-network-defaults) |
| Check the installation is healthy | [Site Health](#site-health) |
| Choose a channel, roll back, switch the updater off | [Update channel](#update-channel), [Rolling back](#rolling-back), [Turning the updater off](#turning-the-updater-off) |
| Verify a download | [Verifying a release](#verifying-a-release) |
| Purge page caches after changes | [Page caches](#page-caches) |
| Keep or delete data when the plugin is removed | [Uninstall](#uninstall) |
| Answer a privacy or consent question | [Privacy and storage (GDPR)](#privacy-and-storage-gdpr) |
| Use triggers and hooks from code | [docs/API.md](docs/API.md) |

## Page caches

Asset URLs are versioned, so browsers fetch new files after an update. The page HTML embeds the widget configuration, so a full-page cache keeps serving the old configuration until it is purged. Purge the page cache after every plugin update and every settings change.

The plugin does not know any cache plugin. It fires one generic action instead:

```php
do_action( 'kotlinskidev_a11y_cache_invalidated', string $reason );
```

`$reason` is `settings` after settings are saved, imported or reset (at most once per request), `update` once after the plugin version changes (checked in the admin and cron only, never on first install), or `translations` after language packs update.

Role-based visibility rules (including `__guest`) only work when the page cache varies by login state. A cache that serves one stored page to everyone shows or hides the widget for the wrong audience.

Hook your cache plugin into it from a small mu-plugin or the theme:

```php
add_action(
	'kotlinskidev_a11y_cache_invalidated',
	static function (): void {
		my_cache_purge();
	}
);
```

`my_cache_purge()` is a placeholder for your cache plugin's purge call. Examples:

```php
add_action( 'kotlinskidev_a11y_cache_invalidated', static fn () => rocket_clean_domain() );
add_action( 'kotlinskidev_a11y_cache_invalidated', static fn () => w3tc_flush_all() );
add_action( 'kotlinskidev_a11y_cache_invalidated', static fn () => do_action( 'litespeed_purge_all' ) );
```

These are WP Rocket, W3 Total Cache and LiteSpeed Cache. For Super Page Cache, call its purge function from the same callback in place of `my_cache_purge()`; its exact hook name is not verified here, so check its documentation. Cloudflare edge caching is left to the cache plugin.

## Triggers

Anything can open the panel or change a feature. Pick the surface that fits:

```html
<button data-ka11y="open">Accessibility</button>
<a href="#ka11y/profile:adhdFriendly">Focus mode</a>
<button class="ka11y-open">Accessibility</button>
```

```text
[kotlinskidev_a11y_button action="feature:darkContrast" label="Dark mode"]
<?php kotlinskidev_a11y_button( array( 'action' => 'open' ) ); ?>
```

There is also a block, "Accessibility trigger", for the editor and Navigation menus. The Triggers tab holds the launcher mode (`floating`, `inline`, `hidden`), custom selectors, the URL action allowlist and a snippet generator. JavaScript API, available after the `ka11y:ready` event: `kotlinskidevA11y.open()`, `close()`, `toggle()`, `set()`, `reset()`, `getState()` and `on()`. Events on `document`: `ka11y:ready`, `ka11y:open`, `ka11y:close` and `ka11y:change`. Actions sent to `window.kotlinskidevA11yQueue` before any script has loaded are replayed in order. Full reference, including actions, events and the deprecation policy: [docs/API.md](docs/API.md).

## Panel appearance

The panel is a non-modal dialog: `role="dialog"` without `aria-modal`, no Tab trap, and clicking the page does not close it. Escape closes it when focus is in the panel or on the launcher. On desktop it is a side panel docked to the launcher's side; below the mobile breakpoint it is a bottom sheet with safe-area insets.

Settings, in the Appearance tab:

| Setting | What it does |
| --- | --- |
| Preset | `classic`, `brand`, `soft`, `contrast` or `custom`. A preset fills the color tokens; the preset name is never sent to the front end. Editing a token switches to `custom`. |
| Color tokens | Primary and on-primary (light and dark), header background and text, canvas and surface for light and dark, text, radius. A live badge shows the contrast ratio and AA pass or fail for each pair. Saving is not blocked by a failing pair. |
| Columns | 2 or 3 tiles per row. The layout drops to 2 and then 1 column when the panel is narrow. |
| Sections | Show or hide the Profiles, Content, Color, Orientation and Skip to content cards. Hidden features stay usable through triggers and the API. |
| Language switcher | Shows a language select in the panel header when the site has two or more known locales. It changes the widget language only, never the site. The choice is saved in `localStorage` under `<storage key>-locale`, which is `ka11y-locale` with the default key. The `ka11y` key is untouched. |

Panel filters:

```php
add_filter( 'kotlinskidev_a11y_locale_label', function ( string $label, string $locale ): string {
	return 'pl_PL' === $locale ? 'Polski' : $label;
}, 10, 2 );

add_filter( 'kotlinskidev_a11y_icons', function ( array $icons ): array {
	$icons['reset'] = 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5';
	return $icons;
} );
```

`kotlinskidev_a11y_locale_label` sets the native language name shown in the select. Without the PHP `intl` extension the label is the locale code, so set it here. `kotlinskidev_a11y_icons` maps an icon name to SVG path data (the `d` attribute only, 24 by 24 grid, stroke style). Names the plugin does not know and values with other characters are dropped.

Upgrading from v0.3.x: the internal shadow classes `.ka11y-toggle`, `.ka11y-profile`, `.ka11y-grid`, `.ka11y-feature`, `.ka11y-section` and `.ka11y-group` are gone. Custom CSS that targets them must use `.ka11y-card`, `.ka11y-tile`, `.ka11y-stepper`, `.ka11y-tiles` and `.ka11y-body` instead, or the public `--ka11y-*` tokens. Do not apply `transform` or `filter` to `#ka11y-root` or `body`: it changes the containing block of the fixed panel.

## Performance

Only a loader of at most 2 KB gzip runs on every page. The panel, the features and the page CSS load on first use. Visitors with saved settings still get them before first paint, whatever the strategy. Settings live in the Performance tab, which also shows the estimated cost per page.

Presets:

- `Recommended`: load on interaction, footer, low fetch priority, prefetch on hover, lazy Page CSS, skip downloads on hidden devices.
- `Compatibility`: load everything at once (`eager`), linked Page CSS, no prefetch, no device skip, and every optimizer opt-out. Use it when an optimizer breaks on-demand loading.
- `Custom`: set each option below yourself.

| Option | Values |
| --- | --- |
| Strategy | `interaction`, `idle`, `defer`, `async`, `eager` |
| Position | `head`, `footer` |
| Fetch priority | `low`, `auto`, `high` |
| Prefetch | `none`, `hover`, `idle` |
| Page CSS | `lazy` (loaded on first use), `linked` (render-blocking `<link>`), `inline` (printed in the page head) |
| Device skip | Skip downloads on devices where the widget is hidden. |
| Optimizer opt-out | Exclude the widget scripts from Cloudflare, WP Rocket, LiteSpeed, Jetpack Boost or Asset CleanUp. |

Visibility mode (Visibility tab): `everywhere`, `only_on` or `except_on`, by post, post type, template, role (`__guest` for logged-out visitors) and URL pattern.

Panel data is served as a versioned JSON file per locale from uploads, with a REST fallback at `kotlinskidev-a11y/v1/panel-data`. Commands such as `open`, `close` and `toggle` sent to `window.kotlinskidevA11yQueue` before any script has loaded are replayed in order.

### Content Security Policy

The launcher is server-rendered in a declarative shadow root and page CSS is applied as a stylesheet, so a strict policy needs `style-src 'unsafe-inline'`, as WordPress core already does. Scripts carry the request nonce when your CSP plugin provides one.

### Sparse settings storage

The site option stores only values that differ from the defaults below it (plugin defaults, then network defaults on multisite). A value you explicitly set equal to today's default is not stored, so it follows future default changes. Pin a value by choosing one that differs from the default.

### Upgrading and downgrading

On upgrade from v0.1, an existing `advanced.loadStrategy` migrates to the Custom preset with the same behaviour, and an admin notice recommends the Recommended preset once, with a per-user dismissal. Purge page caches after upgrading.

Downgrade to v0.1.x is safe. v0.1 ignores the new keys, falls back to the `defer` strategy and still honours the `exclude*` lists. It does not understand `only_on`, so the widget renders everywhere.

## Updates on customer sites

The plugin embeds Plugin Update Checker v5 pointed at the GitHub repository. WordPress checks in the admin and via cron (never on front-end requests). When a newer release exists, the standard update notice appears and installs the `kotlinskidev-accessibility.zip` release asset. "View details" shows the release notes taken from `CHANGELOG.md`.

Every download of the plugin zip is checked against the release's `kotlinskidev-accessibility.zip.sha256` before WordPress unzips it. A mismatch aborts the update with a `kotlinskidev_a11y_checksum_mismatch` error. Releases made before the checksum existed have no `.sha256` file; updates from them still proceed.

### Update channel

The Maintenance tab has an Updates card, visible only to users with the `update_plugins` capability. The channel is one network-wide setting stored with `update_site_option`, separate from the plugin settings, so it is never exported or imported.

- `stable` (default): stable releases only.
- `beta`: also offers `-beta.N` and `-rc.N` pre-releases.

Switching from beta back to stable never downgrades; the site waits for the next stable release that is newer. Changing the channel clears the cached update state.

Precedence: the `KOTLINSKIDEV_A11Y_UPDATE_CHANNEL` constant (`'stable'` or `'beta'`) wins over the saved setting, then the `kotlinskidev_a11y_update_channel` filter runs last.

### Rolling back

The Updates card lists the 3 newest stable releases older than the installed one, never below v0.4.0 (pre-releases too on the beta channel). The list is fetched from the GitHub API only when you press the button and is cached for 12 hours. Roll back asks for confirmation, copies your settings to the `kotlinskidev_a11y_settings_backup` option, downloads the release zip, checks its SHA-256 and installs it. No old zip is kept on the site. A release without a `.sha256` asset is not offered.

To restore the backup after returning to a newer version: `wp option get kotlinskidev_a11y_settings_backup --format=json`, then import it from the Import and Export tab.

### Turning the updater off

Set `define( 'KOTLINSKIDEV_A11Y_DISABLE_UPDATER', true );` in `wp-config.php`, or return `false` from the `kotlinskidev_a11y_enable_updater` filter. The update check, checksum verification, rollback page and the `/update-channel` and `/releases` REST routes are then all off.

## Verifying a release

The release workflow publishes a build provenance attestation for the zip (from `v1.0.0-beta.1` on; older releases have none). With the GitHub CLI:

```bash
gh release download v1.0.0 --repo Kotlinski95/kotlinskidev-accessibility-plugin --pattern 'kotlinskidev-accessibility.zip*'
sha256sum --check kotlinskidev-accessibility.zip.sha256
gh attestation verify kotlinskidev-accessibility.zip --repo Kotlinski95/kotlinskidev-accessibility-plugin
```

The checksum the plugin checks comes from the same release as the zip, so it catches corrupted or swapped downloads but not a compromised GitHub account. The attestation covers that case and is checked out of band, not by the plugin.

## Pointing updates at a private server

Return a different source from the filter, for example from a small mu-plugin or the theme:

```php
add_filter(
	'kotlinskidev_a11y_update_source',
	static fn ( array $source ): array => array_merge(
		$source,
		array( 'repository' => 'https://updates.example.com/kotlinskidev-accessibility/' )
	)
);
add_filter( 'kotlinskidev_a11y_update_token', static fn (): string => 'token-from-your-secret-store' );
```

Source keys: `repository`, `slug`, `asset_pattern`, `branch`. The token is read only from the filter and is never stored by the plugin. `Update\Updater` is a thin class, so it can also be replaced entirely.

## Settings screen

Settings > Accessibility holds every setting in tabs. The save bar shows how many changes are unsaved, and leaving the page with unsaved changes asks first.

- Search settings: type at least 2 characters above the tabs. Matching ignores case and accents and every word must match. Pick a result to jump to its tab and control.
- Review changes: save, import and reset first show a table of Setting, Before and After and apply nothing until you confirm. Nothing changed means nothing to save.
- Reset this tab: the button at the end of each tab resets only that tab's settings, after the same preview. Locked settings are skipped.
- Import and Export: export downloads a versioned file without site URLs or tokens. Import checks the version, previews the result and refuses files made by a newer plugin version.
- Locked and inherited fields: a locked field is disabled with "Locked by site configuration", and on a multisite subsite a field that comes from the network says "Network default".
- Expired session: the admin refreshes its security token once and retries before asking you to reload.

## Locking settings

A locked setting has a fixed value on the site. It cannot be changed from the admin, REST or WP-CLI, and it is skipped by import and reset. Locks are code, so they are version-controlled and survive a database copy. Paths use dots (`widget.position`) and values must be valid for the setting; a lock with an unknown path or a value the sanitizer would change is dropped and reported by Site Health.

```php
define( 'KOTLINSKIDEV_A11Y_LOCKED_SETTINGS', array(
	'widget.position' => 'left',
	'storage.mode'    => 'none',
) );

add_filter( 'kotlinskidev_a11y_locked_settings', static fn ( array $locked ): array => array_merge( $locked, array( 'storage.mode' => 'none' ) ) );
```

The constant wins over the filter, and the filter wins over locks set on the network. `wp ka11y settings get --layer=stored` shows the value hidden under a lock.

## Customer access

By default only users with `manage_options` (filter `kotlinskidev_a11y_capability`) manage the plugin. Give a role the `kotlinskidev_a11y_customize` capability to let it edit only labels, the statement, color tokens, panel options and the light or dark mode:

```bash
wp ka11y access grant editor
wp ka11y access list
wp ka11y access revoke editor
```

Customers see Settings > Accessibility with only the tabs and fields they may edit. They have no Import and Export, Maintenance, custom CSS or performance settings, and the server answers 403 `kotlinskidev_a11y_forbidden_paths` and saves nothing if a request touches anything else. The `kotlinskidev_a11y_customer_capability` filter renames the capability (it must start with `kotlinskidev_a11y_`) and `kotlinskidev_a11y_customer_paths` can only narrow the editable list.

## WP-CLI

Every command validates against the same schema, sanitizer, locks and health checks as the admin screen and the REST API. Pick a site on multisite with the standard `--url`. Run `wp help ka11y settings set` (or any other subcommand) for the full synopsis.

| Command | What it does |
| --- | --- |
| `wp ka11y settings get [<path>] [--layer=effective\|stored\|network\|defaults] [--format=json\|yaml\|var_export]` | Prints one setting, a group such as `widget.position`, or everything. |
| `wp ka11y settings set <path> <value> [--as-json] [--dry-run] [--format=table\|json\|yaml]` | Saves one setting and prints the change. Booleans take `true\|false\|1\|0\|on\|off\|yes\|no`, integers must sit inside their range, enums must be listed, and lists and maps need `--as-json` (WP-CLI reserves `--json`). A value the sanitizer would change exits 1 and prints the cleaned value. |
| `wp ka11y settings import <file> [--dry-run] [--yes]` | Imports a file made by `export`, or `-` for STDIN (at most 262144 B, local paths only). |
| `wp ka11y settings export [--file=<file>] [--force]` | Prints the versioned envelope, or writes it to a file and refuses to overwrite without `--force`. |
| `wp ka11y settings reset [<path>...] [--dry-run] [--yes]` | Resets the given paths, or everything. |
| `wp ka11y doctor [--format=table\|json\|yaml] [--fail-on=critical\|recommended]` | Runs the Site Health checks without any network request. Exits 1 at or above the `--fail-on` level, `critical` by default. |
| `wp ka11y access grant\|revoke <role>` | Adds or removes the customer capability on a role that exists. |
| `wp ka11y access list [--format=table\|json\|yaml]` | Lists the roles that hold the customer capability and its name. |

Locked paths exit 1 with `Locked by site configuration`. `import` and `reset` ask for confirmation unless you pass `--dry-run` or `--yes`. `--network` (multisite only, otherwise exit 1) makes `get`, `set`, `import`, `export` and `reset` act on the network defaults instead of one site; its `--layer` values read the network option (`effective` is defaults plus network defaults, `stored` and `network` are the values the network changed).

## Multisite network defaults

On a multisite network, Network Admin > Settings > Accessibility sets defaults for every site. The page is the normal settings screen with the Maintenance tab showing "Locked on all sites" (one setting path per line) and the Updates card, and it needs the `manage_network_options` capability.

- Layers, lowest to highest: plugin defaults, network defaults, the site's own values, locks. A site stores only values that differ from the layers below it, so a network change reaches every site that did not override that setting. Nothing is copied into new sites, and the plugin does not have to be network activated: network defaults apply to every site where it is active.
- A setting locked on the network is fixed to the network value on every site. Site administrators see it disabled, and `POST /settings` for it answers 409. Locks from `KOTLINSKIDEV_A11Y_LOCKED_SETTINGS` beat the `kotlinskidev_a11y_locked_settings` filter, which beats network locks.
- On a site, reset returns to the network defaults. Site administrators cannot reach the network routes.
- REST: `GET` and `POST /network/settings`, `GET /network/schema`, `GET /network/export`, `POST /network/import` and `POST /network/reset` in the `kotlinskidev-a11y/v1` namespace. They exist only on multisite, need `manage_network_options` and the `wp_rest` nonce, take `dry_run`, and the settings tree carries a `locked` list of paths.
- Saving network defaults fires `kotlinskidev_a11y_cache_invalidated` with `settings` once. Per-site page caches that need purging must hook that action themselves.
- Data lives in the network option `kotlinskidev_a11y_network_settings`; single-site code ignores it.

## Site Health

Tools > Site Health runs these checks, none of which makes a network request, and adds a Kotlinskidev Accessibility section to the Info tab. `wp ka11y doctor` prints the same results and exits 1 when a check is critical.

| Check | Level | Passes when |
| --- | --- | --- |
| Build files | critical | every built file the plugin needs exists |
| Update source | recommended | the updater uses https and last checked in the past 48 hours without an error |
| Optimizer conflicts | recommended | a detected optimizer (WP Rocket, LiteSpeed, Jetpack Boost, Asset CleanUp, Cloudflare) has its opt-out on or the Compatibility preset is used |
| Page cache language | recommended | a multilingual site with a page cache hooks `kotlinskidev_a11y_cache_invalidated` |
| Locked settings | recommended | every lock is valid |
| Panel data store | recommended | the uploads folder is writable |
| Unverified package | recommended | the last update was verified by checksum |

The Info section lists version, channel, locks, customer roles and storage mode, and never the update token.

## Uninstall

Deleting the plugin removes its data. To keep it, turn on "Keep settings when the plugin is deleted" in the Maintenance tab (`maintenance.keepDataOnUninstall`).

Deleted for each site that does not keep data: the settings, installed version, settings backup, hash of the locks and network defaults, panel data options, the stored update state and unverified package flag, the missing-alt-text and release list transients, the customer capability on every role and the uploads folder `kotlinskidev-a11y`. Network data (network defaults, update channel, update state, the update checker's state and the dismissed performance notice user meta) is deleted unless the main site keeps data. On multisite the choice is read per site.

## Privacy and storage (GDPR)

The widget stores a visitor's choices only on their device, never on the server, and sends nothing to third parties. `storage.mode` selects where:

- `local`: `localStorage`, no expiry unless a TTL is set. Strictly necessary to honor an explicit user preference, as noted on the admin page.
- `cookie`: a first-party cookie with the configured lifetime.
- `none`: nothing persisted; choices reset on reload.

The browser keys are `ka11y` (or the configured `storage.key`), `<storage key>-locale`, `<storage key>-hidden` and `ka11y-voice` (the remembered Read page voice). They hold choices only, no personal data, and the widget makes no external requests. On the server the plugin stores the settings option and panel data files in `uploads/kotlinskidev-a11y`, and the server checks GitHub for plugin updates for administrators, without visitor data.

Settings > Privacy > Policy Guide gets a ready-made "Kotlinskidev Accessibility" section describing all of this. No personal data exporter or eraser is needed because nothing is stored per person on the server.

Choose `none` if your legal review requires no storage without consent. Page caches must vary per language.

## Hooks and frozen contracts

### Filters

| Filter | Purpose |
| --- | --- |
| `kotlinskidev_a11y_capability` | Capability required to manage settings. |
| `kotlinskidev_a11y_customer_capability` | Rename the customer capability (must start with `kotlinskidev_a11y_`). |
| `kotlinskidev_a11y_customer_paths` | Narrow the settings paths a customer may edit. |
| `kotlinskidev_a11y_locked_settings` | Add locked settings from code. |
| `kotlinskidev_a11y_should_render` | Decide whether the widget renders on the current request. |
| `kotlinskidev_a11y_current_locale` | Override the locale used for widget strings. |
| `kotlinskidev_a11y_default_locale` | Locale used by the statement shortcode when none is configured. |
| `kotlinskidev_a11y_known_locales` | Change the list of locales the language select offers. |
| `kotlinskidev_a11y_locale_label` | Change the language name shown in the language select. |
| `kotlinskidev_a11y_strings` | Adjust the strings sent to the front end. |
| `kotlinskidev_a11y_icons` | Replace icon path data by name. Path data only. |
| `kotlinskidev_a11y_button_html` | Change the markup of a trigger button. The result is filtered again. |
| `kotlinskidev_a11y_trigger_selectors` | Add custom trigger selectors from code. |
| `kotlinskidev_a11y_default_selectors` | Set the default dark and light mode selectors from a theme. Saved selectors win. |
| `kotlinskidev_a11y_url_actions` | Narrow the actions allowed from `?ka11y=` and `#ka11y/` URLs. |
| `kotlinskidev_a11y_update_source` | Swap repository, slug, asset pattern or branch for updates. |
| `kotlinskidev_a11y_update_token` | Supply an authentication token for private update sources. |
| `kotlinskidev_a11y_update_channel` | Choose `stable` or `beta`. |
| `kotlinskidev_a11y_enable_updater` | Return `false` to turn the updater off. |
| `kotlinskidev_a11y_rollback_releases` | Supply the release list for rollback. |

### Actions

`kotlinskidev_a11y_cache_invalidated` with a `$reason` of `settings`, `update` or `translations`. See [Page caches](#page-caches).

### Frozen contracts

These change only in a major release (see `docs/DEPRECATION.md`):

- Option `kotlinskidev_a11y_settings`, REST namespace `kotlinskidev-a11y/v1`, capability filter `kotlinskidev_a11y_capability`.
- Front-end config `window.kotlinskidevA11y`, host element `#ka11y-root`, open hash `#kotlinskidev-a11y`, storage key `ka11y`.
- Hooks `kotlinskidev_a11y_should_render`, `kotlinskidev_a11y_current_locale`, `kotlinskidev_a11y_strings`, `kotlinskidev_a11y_update_source`, `kotlinskidev_a11y_update_token` and `kotlinskidev_a11y_cache_invalidated`.
- Update slug `kotlinskidev-accessibility` and release asset name `kotlinskidev-accessibility.zip`.

## REST API

Namespace `kotlinskidev-a11y/v1`. Admin routes need the manage capability and the `wp_rest` nonce.

| Route | Purpose |
| --- | --- |
| `GET`, `POST /settings` | Read and save settings. Customers may use these for their own paths. |
| `GET /schema` | Definitions, effective defaults, locks and sources. |
| `GET /export`, `POST /import`, `POST /reset` | Versioned export, import and reset, all with `dry_run`. |
| `GET /panel-data` | Panel payload for one locale. Public, 404 for unused locales. |
| `GET /trigger-options` | Options for the trigger block. |
| `POST /alt-text/<id>` | Save alt text for an attachment. |
| `GET /releases`, `/update-channel` | Rollback list and update channel. Off when the updater is off. |
| `/network/settings`, `/network/schema`, `/network/export`, `/network/import`, `/network/reset` | Multisite network defaults. |

## Performance budgets

`npm run build` writes sizes to the build, and `npm run check-budget` fails when any budget in `bin/budgets.json` is exceeded. Current budgets and measured sizes in bytes (gzip unless noted):

| Budget | Limit | Measured |
| --- | --- | --- |
| `inline.bootstrap` | 1152 | 1040 |
| `scripts.loader` | 4200 | 4198 |
| `scripts.kernel` | 5632 | 5287 |
| `scripts.panel` | 9520 | 9506 |
| `scripts.content` | 4096 | 3992 |
| `scripts.color` | 1536 | 1401 |
| `scripts.orientation` | 4800 | 4736 |
| `scripts.admin` (admin only) | 28541 | 26543 |
| `styles.page` | 2048 | 1522 |
| `data.icons` | 2048 | 1216 |
| `styles.launcher` (raw) | 1530 | 1526 |
| `sum.everyPage` (bootstrap plus loader) | 5250 | 5238 |

The dark-mode launcher colors add no JavaScript and no bytes to the loader or bootstrap: they are a few declarations in the existing inline token style.

For a live comparison, the nightly workflow runs Lighthouse with the widget on and off on the same site, five runs each, and `bin/lh-compare.mjs` fails when LCP or TBT worsen by more than 5 percent (with 100 ms and 50 ms floors) or CLS by more than 0.01. `bin/lh-widget.php` toggles the widget for it.

## Accessibility notes

- The launcher is a real button with an accessible name, a visible 3 px focus ring and a target of at least 44 px.
- The panel is a non-modal dialog: `role="dialog"`, no focus trap, Escape closes it from inside the panel or the launcher, and focus returns to the opener.
- Triggers get `role="button"` and the right `aria-haspopup`, `aria-controls`, `aria-expanded` or `aria-pressed`.
- Dark mode and forced colors (Windows high contrast) have their own styles. The contrast modes also replace gradient text with a solid color so it stays visible. Animations stop for visitors who prefer reduced motion.
- The admin shows contrast ratios for every color pair and warns, without blocking, when AA is not met.
- Run an automated check (axe is part of the e2e suite) and test with a keyboard and a screen reader. A widget does not make a site compliant by itself.

## Development

```bash
npm install
composer install
npm run build
```

| Command | What it does |
| --- | --- |
| `npm run build` | esbuild and dart-sass build into `build/` through `bin/build.mjs`. |
| `npm run typecheck` | Strict TypeScript check. |
| `npm run lint` | ESLint for `src/ts`, `tests/js` and `tests/e2e`. |
| `npm test` | Jest unit tests. |
| `composer run lint` | PHPCS with WordPress Coding Standards (`phpcs.xml.dist`). |
| `composer run test:unit` | PHPUnit unit tests. |
| `npm run check-budget` | Fails when a size budget in `bin/budgets.json` is exceeded. |
| `npm run check-version` | Fails unless every version source matches. |
| `npm run check-scss-scope` | Fails on unscoped state-class selectors in page SCSS. |
| `npm run i18n:pot`, `npm run i18n:json` | Regenerate the `.pot` and the Polish JSON translations. |
| `npm run wp-env:start`, `npm run test:e2e` | Playwright end-to-end tests in wp-env (needs Docker). Multisite: `npm run wp-env:multisite:start` and `npm run test:e2e:multisite`. |

The full verify chain, run from the repository root before any release:

```bash
composer run lint && composer run test:unit && npm run typecheck && npm run lint && npm test && npm run build && npm run check-budget && npm run check-version && npm run check-scss-scope
```

Structure:

```text
kotlinskidev-accessibility.php   plugin header and bootstrap
src/php/                         PSR-4 Kotlinskidev\A11y: Admin, Cache, Cli, Frontend, Health, I18n, Privacy, Rest, Settings, Statement, Triggers, Update
src/ts/                          admin, frontend (loader, kernel, panel, features), shared types
src/scss/                        widget, launcher, admin, page styles
bin/                             build, budgets, version, release and Lighthouse scripts
tests/                           php, js, e2e and fixtures
languages/                       .pot, pl_PL .po, .mo and JSON
docs/                            API, deprecation policy, specs, testing
```

Code style: no comments anywhere (the plugin header is the only exception), PHP prefix `kotlinskidev_a11y`, CSS and state class prefix `ka11y-`.

## Test package

Run `npm run package` to build a ready-to-install zip at `dist/kotlinskidev-accessibility.zip` without tagging anything. It builds the assets, checks the version files, installs production-only Composer dependencies in a temporary folder (your `vendor/` is left alone), applies `.distignore` and verifies the required files. It prints the path, size and SHA-256. Upload it under Plugins > Add New > Upload Plugin on a test site. Add `--skip-build` to reuse the current `build/` folder.

## Release process

1. Add entries under `[Unreleased]` in `CHANGELOG.md`.
2. Run `npm run release -- --patch` (or `--minor`, `--major`). Add `--dry-run` to preview. It bumps the plugin header, `KOTLINSKIDEV_A11Y_VERSION`, `package.json`, `package-lock.json` and moves `[Unreleased]` under the new dated heading. For a prerelease add `--pre beta` or `--pre rc`; running `--pre beta` again gives `beta.2` and a plain `npm run release` on a prerelease gives the stable version.
3. Run `npm run check-version`.
4. Commit, then tag and push: `git tag vX.Y.Z && git push --follow-tags`.
5. The `Release` workflow builds assets, installs production Composer dependencies, checks versions, generates `.pot` and JSON translations, packages `kotlinskidev-accessibility.zip` using `.distignore`, writes `kotlinskidev-accessibility.zip.sha256`, attests build provenance, publishes the GitHub release with the `CHANGELOG.md` section as its notes (a tag with a hyphen, such as `v1.0.0-beta.1`, is a pre-release) and fails if the zip or checksum is missing.

## License

GPL-2.0-or-later. See the plugin header. Security reports: see `SECURITY.md`.
