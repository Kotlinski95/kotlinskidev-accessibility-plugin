# Public API

API version: `1` (`kotlinskidevA11y.api === 1`). Everything in this file is public and follows the deprecation policy below. Anything not listed is internal and may change in any release, including `kotlinskidevA11yRuntime`, `trigger`, `load`, `chunks`, `data` and `hiddenMedia`.

## Quick start

```html
<button data-ka11y="open">Accessibility</button>
<a href="#ka11y/profile:adhdFriendly">Focus mode</a>
```

```text
[kotlinskidev_a11y_button action="open" label="Accessibility"]
```

## Actions

Every surface uses the same vocabulary. Actions are case-sensitive and anything else is dropped silently.

| Action | Effect |
| --- | --- |
| `open` | Show a hidden toolbar, then open the panel. |
| `close` | Close the panel. No effect when it never opened. |
| `toggle` | Open or close the panel. |
| `reset` | Reset every feature and profile and clear saved state. |
| `feature:<key>` | Toggle the feature: off goes to its default level, on goes to off. |
| `feature:<key>:<level>` | Set the level. `0` is off. Levels above the feature's count are clamped. |
| `profile:<key>` | Toggle the profile. |
| `statement` | Go to the accessibility statement URL. |
| `hide` | Hide the launcher for this session and close the panel. |
| `show` | Undo a visitor hide. |

Grammar: `^[a-z][a-zA-Z0-9]*(?::[a-zA-Z0-9_-]+){0,2}$`. A level matches `^(0|[1-9][0-9]?)$`.

- `feature:` and `profile:` actions apply only when the feature or profile is enabled in the settings, from every surface.
- Feature and profile keys are those shown in the admin and returned by `GET kotlinskidev-a11y/v1/trigger-options`.

## Trigger surfaces

| Surface | Example | Actions |
| --- | --- | --- |
| Open hash link | `<a href="#kotlinskidev-a11y">` | `open` |
| Action hash link | `<a href="#ka11y/profile:adhdFriendly">` | all |
| Data attribute | `<button data-ka11y="feature:darkContrast">` | all |
| CSS class | `<button class="ka11y-open">` | `open` |
| Custom selectors | Triggers tab, e.g. `.menu-item-a11y > a` | `toggle`, or the element's own `data-ka11y` |
| Shortcode, block, PHP | see below | all |
| JavaScript | `kotlinskidevA11y.set('darkContrast', 1)` | all |
| Queue | `kotlinskidevA11yQueue.push({ action: 'open' })` | all |
| URL query | `?ka11y=profile:adhdFriendly` | URL allowlist |
| Landing hash | `/page/#ka11y/feature:biggerText:2` | URL allowlist |
| Keyboard shortcut | `Alt+Shift+A` by default | `toggle` |
| Launcher | click on the launcher | `toggle` |

Resolution for a clicked element, first match wins: `data-ka11y`, then `a[href^="#ka11y/"]`, then `a[href="#kotlinskidev-a11y"]`, then `.ka11y-open`, then a custom selector.

Links with a trigger do not change the address bar, so a second click works.

### Automatic ARIA

When the page is ready, triggers get these attributes only where they are missing, so your own markup wins:

| Condition | Added |
| --- | --- |
| `a` element | `role="button"` |
| `open` or `toggle` | `aria-controls="ka11y-root"`, `aria-expanded="false"`, `aria-haspopup="dialog"` |
| `close` | `aria-controls="ka11y-root"` |
| `feature:*` or `profile:*` | `aria-pressed="false"` |

`aria-expanded` and `aria-pressed` then follow the panel and the state, including on elements added later. Elements added after the page is ready get the static attributes only at the next panel or state change, because there is no mutation observer. Space activates `a[role="button"]` triggers.

Focus returns to the element that opened the panel, then to the element focused before it opened, then to the launcher, then to the page when the launcher is hidden.

### URL and hash actions

- Only the actions named in `triggers.urlActions` are accepted (default `open`, `feature`, `profile`). An empty list turns URL actions off. `close`, `toggle`, `reset`, `statement`, `hide` and `show` are never URL actions.
- `feature:<key>` from a URL turns the feature on at its default level, and `profile:<key>` applies the profile. They never turn anything off.
- URL actions are not saved by themselves. The first deliberate change by the visitor saves the full current state, including what the URL applied.
- After applying, the `ka11y` parameter or the `#ka11y/` hash is removed from the address bar, so a reload does not repeat it.
- `?ka11y=reset` and `?ka11y=off` keep their recovery meaning and are not actions.

## JavaScript API

Before the loader runs, send actions through the queue. They replay in order:

```js
window.kotlinskidevA11yQueue = window.kotlinskidevA11yQueue || [];
window.kotlinskidevA11yQueue.push({ action: 'profile:adhdFriendly' });
```

Once `ka11y:ready` has fired, `window.kotlinskidevA11y` has these methods:

| Member | Description |
| --- | --- |
| `api: 1` | API version. |
| `open(opener?: HTMLElement \| null): void` | Open the panel. `opener` receives focus back on close. |
| `close(): void` | Close the panel. |
| `toggle(target?: string, opener?: HTMLElement \| null): void` | Toggle the panel, or any action such as `'feature:darkContrast'`. |
| `set(feature: string, level: number \| boolean): void` | Set a level. `true` is the default level, `false` is 0, numbers are truncated. Non-finite numbers are ignored. |
| `reset(): void` | Reset everything. |
| `getState(): Promise<PublicState>` | Load the kernel (not the panel) and resolve the current state. |
| `on(event, listener): () => void` | Listen to an event. Returns the unsubscribe function. `on('ready', fn)` after ready calls `fn` on the next microtask. |

```ts
interface PublicState {
  api: 1;
  open: boolean;
  profile: string | null;
  features: Record<string, number>;
}
```

`features` lists only active features. A feature that is on without levels reports `1`.

```js
kotlinskidevA11y.on('ready', () => kotlinskidevA11y.set('darkContrast', true));
```

Unknown or disabled keys resolve without effect and without an event.

## Motion state

While the Stop animations feature is on, pages can react to it from script. The first-party widget publishes three things:

| Signal | Description |
| --- | --- |
| `html.ka11y-stop-animations` | Root class. CSS animations, transitions and smooth scrolling are already disabled for all page elements. |
| `window.kotlinskidevA11yMotion` | `{ stopped: boolean }`. Absent until the feature has been switched on once, so treat absent as not stopped. |
| `kotlinskidev-a11y:motion` | `CustomEvent` on `window`, `detail: { stopped: boolean }`, fired when the feature turns on and off. |

While stopped, `window.matchMedia('(prefers-reduced-motion: reduce)')` and `(prefers-reduced-motion)` report `matches: true` and `(prefers-reduced-motion: no-preference)` reports `false`, for queries created while it is on. Code that already re-reads the query on use honors it with no change. A media query list created earlier does not fire `change`, so also listen for the event.

```js
const isStopped = () =>
  document.documentElement.classList.contains('ka11y-stop-animations') ||
  window.kotlinskidevA11yMotion?.stopped === true;

window.addEventListener('kotlinskidev-a11y:motion', (event) => {
  if (event.detail.stopped) cancelAnimationFrame(frame);
  else frame = requestAnimationFrame(tick);
});
```

For a `requestAnimationFrame` canvas, cancel the frame and draw the final static frame on stop, and resume on the opposite event. When `window.gsap` exists its global timeline is paused and resumed for you.

## Read page options

The Features tab stores `readPage.voice` (empty is automatic, otherwise the exact voice name) `readPage.rate` (0.5 to 2, default 1), `readPage.trigger` (`hover`, `click` or `both`, default `hover`) and `readPage.hoverDelay` (0 to 2000 ms, default 300). With `hover`, text is read after the pointer rests on it for the delay and on keyboard focus; clicking never speaks and links navigate normally; on touch, a tap on non-interactive text reads it. They are delivered in the lazy panel data, not the inline config, and are fetched when Read page turns on.

`window.kotlinskidevA11yReadPage = { voice?: string, rate?: number, trigger?: 'hover' | 'click' | 'both', hoverDelay?: number }`, set before the widget loads, stays supported as an override and wins over the settings. `voice` is a name fragment or `voiceURI` (`auto` keeps the automatic choice) and `rate` is clamped to 0.5 to 2.

## Events

All events are `CustomEvent`s on `document`, not cancelable, and do not bubble. Listener errors are isolated by the browser.

| Event | When | `detail` |
| --- | --- | --- |
| `ka11y:ready` | Once, after the API is installed. | `{ api: 1, version: string }` |
| `ka11y:open` | The panel opened. | `{ source: 'panel' }` |
| `ka11y:close` | The panel closed. | `{ source: 'panel' }` |
| `ka11y:change` | After a change of any level or of the profile. | `{ state: PublicState, source: string }` |

For `ka11y:change`, `source` is the surface that caused it: `trigger`, `api`, `url`, `shortcut`, `launcher`, `hash`, `early`, `panel` (the panel's own controls) or `restore` (saved state applied at start).

```js
document.addEventListener('ka11y:change', (event) => {
  console.log(event.detail.state.features.biggerText ?? 0, event.detail.source);
});
```

## Shortcode, block and PHP functions

All three share one renderer and one set of arguments.

| Argument | Default | Rule |
| --- | --- | --- |
| `action` | `open` | Any action above. An invalid or disabled action renders nothing. |
| `label` | per action | Plain text, at most 100 characters. Defaults to the panel label of the feature or profile, or to a translated default. |
| `element` | `button` | `button` or `link`. |
| `class` | empty | Space-separated class names, at most 10. |
| `show_icon` | `false` | Adds the launcher icon with `aria-hidden="true"`. Shortcode accepts `1`, `true`, `yes`. |

```text
[kotlinskidev_a11y_button action="profile:adhdFriendly" label="Focus mode" element="link" show_icon="yes"]
```

```php
kotlinskidev_a11y_button( array( 'action' => 'open', 'label' => 'Accessibility' ) );
$html = kotlinskidev_a11y_get_button( array( 'action' => 'feature:biggerText:2' ) );
```

- `kotlinskidev_a11y_button( array $args = array() ): void` prints the trigger. `kotlinskidev_a11y_get_button( array $args = array() ): string` returns it.
- The block is `kotlinskidev-a11y/trigger`, "Accessibility trigger". Attributes: `action`, `label`, `element`, `showIcon`. Colour, typography, spacing and border supports apply. Inside a Navigation block it renders as a menu item.
- Output is escaped while it is built and filtered through `wp_kses`, so it is safe to print as is.
- A `statement` trigger with a statement URL renders a plain link and works without JavaScript. Without a URL it renders nothing.
- Nothing renders on pages where the widget is not rendered.
- Triggers are hidden when JavaScript is off.

## Launcher modes and shortcut

| Mode | Behaviour |
| --- | --- |
| `floating` | Fixed launcher, the default. |
| `inline` | The launcher moves into the element matched by the mount selector. When nothing matches it stays floating. Reserve about 48 px in the mount to avoid layout shift. |
| `hidden` | No launcher button (the General tab checkbox "Show the floating accessibility button" is off). The panel host and the loader stay active, so every `data-ka11y` trigger, link, the keyboard shortcut and `kotlinskidevA11y.open()` still open the panel. |

The keyboard shortcut is configurable and works in every mode when enabled. The admin warns when `hidden` is chosen and the home page has no trigger.

## PHP hooks

| Hook | Type | Purpose |
| --- | --- | --- |
| `kotlinskidev_a11y_default_selectors` | filter | `array{darkSelector: string, lightSelector: string}` in, array out. Default dark and light mode selectors of the schema. Applies only to sites that never saved a selector. Empty or invalid values fall back to the plugin defaults. |
| `kotlinskidev_a11y_trigger_selectors` | filter | `array $selectors` in, array out. Add custom trigger selectors. Each goes through the same sanitizer as the setting. |
| `kotlinskidev_a11y_url_actions` | filter | `array $names` in, array out. Narrow the URL allowlist. The result is intersected with `open`, `feature` and `profile` and with the setting, so it never widens it. |
| `kotlinskidev_a11y_button_html` | filter | `string $html, array $args` in, string out. Change trigger markup. The result is filtered through `wp_kses` again. |
| `kotlinskidev_a11y_capability` | filter | Capability required to manage settings. |
| `kotlinskidev_a11y_should_render` | filter | Decide whether the widget renders on the request. |
| `kotlinskidev_a11y_current_locale` | filter | Override the locale used for strings. |
| `kotlinskidev_a11y_strings` | filter | Adjust the strings sent to the front end. |
| `kotlinskidev_a11y_locale_label` | filter | `string $label, string $locale` in, string out. Native language name in the panel language select. Defaults to the `intl` display name, else the locale code. |
| `kotlinskidev_a11y_icons` | filter | `array $icons` (name to SVG path data) in, array out. Only known names whose value is path data (`^[MmZzLlHhVvCcSsQqTtAa0-9eE.,+\s-]{1,1500}$`) are kept. Markup is never accepted. |
| `kotlinskidev_a11y_customer_capability` | filter | `string $capability` in (default `kotlinskidev_a11y_customize`), string out. Must start with `kotlinskidev_a11y_`. |
| `kotlinskidev_a11y_customer_paths` | filter | `array $paths` in, array out. Settings path prefixes a customer may edit. Can only narrow the default list. |
| `kotlinskidev_a11y_locked_settings` | filter | `array $locked` (path to value) in, array out. Fixed settings. `KOTLINSKIDEV_A11Y_LOCKED_SETTINGS` wins over it. |
| `kotlinskidev_a11y_known_locales` | filter | `array $locales` in, array out. Locales offered by the language switcher. |
| `kotlinskidev_a11y_default_locale` | filter | `string $locale` in, string out. Locale of the statement shortcode when none matches. |
| `kotlinskidev_a11y_update_channel` | filter | `string $channel` (`stable` or `beta`) in, string out. Runs after the constant. |
| `kotlinskidev_a11y_enable_updater` | filter | `bool $enabled` in, bool out. `false` turns off the update check, checksum verification, rollback and update routes. |
| `kotlinskidev_a11y_update_source` | filter | `array $source` in, array out. Keys `repository`, `slug`, `asset_pattern`, `branch`. |
| `kotlinskidev_a11y_update_token` | filter | `string $token` in, string out. Token for private update sources; never stored. |
| `kotlinskidev_a11y_rollback_releases` | filter | `array $releases` in, array out. Each item has `version`, `package` and `sha256_url` on one https host; replaces the GitHub list. |
| `kotlinskidev_a11y_cache_invalidated` | action | `string $reason`: `settings`, `update` or `translations`. |

Update behaviour is described in the README.

## Constants

Set in `wp-config.php` before the plugin loads.

| Constant | Value | Effect |
| --- | --- | --- |
| `KOTLINSKIDEV_A11Y_LOCKED_SETTINGS` | `array` of setting path to value | Fixes those settings on the site. Invalid entries are dropped and reported by Site Health. |
| `KOTLINSKIDEV_A11Y_UPDATE_CHANNEL` | `'stable'` or `'beta'` | Fixes the update channel; the admin control is disabled. |
| `KOTLINSKIDEV_A11Y_DISABLE_UPDATER` | `true` | Turns off the update check, checksum verification, rollback and update routes. |

| Constant | Value | Effect |
| --- | --- | --- |
| `KOTLINSKIDEV_A11Y_API` | `1` | Defined by the plugin, read-only. Presence probe: `defined( 'KOTLINSKIDEV_A11Y_API' )`. |

`kotlinskidev_a11y_api_version(): int` returns the same value and is defined beside `kotlinskidev_a11y_get_button()`.

The plugin also defines `KOTLINSKIDEV_A11Y_VERSION`, `KOTLINSKIDEV_A11Y_FILE`, `KOTLINSKIDEV_A11Y_DIR` and `KOTLINSKIDEV_A11Y_URL`, which are read-only and not part of the API.

## Integrating a theme

A theme or another plugin can work with the widget without a hard dependency.

**Presence probe.** Check `defined( 'KOTLINSKIDEV_A11Y_API' )` or `function_exists( 'kotlinskidev_a11y_api_version' )`, then compare `kotlinskidev_a11y_api_version()` with the version you were written against. Both are PHP only and cost nothing on the front end. In the browser, feature-detect `window.kotlinskidevA11y?.api === 1`.

```php
if ( function_exists( 'kotlinskidev_a11y_api_version' ) && kotlinskidev_a11y_api_version() >= 1 ) {
	kotlinskidev_a11y_button( array( 'action' => 'open', 'label' => 'Accessibility' ) );
}
```

**Theme contract.** A theme must not reach into `#ka11y-root` (it is a shadow host). Use these instead:

| Item | Kind | Description |
| --- | --- | --- |
| `html.ka11y-floating-hidden` | class | Add it to `<html>` to hide the floating trigger. The trigger fades out with a 0.2 s opacity and visibility transition and is removed from the tab order. An open panel is not hidden. Triggers made with `data-ka11y`, the shortcode or the block are not affected. Remove the class to show it again. |
| `--ka11y-offset-bottom` | custom property | Distance from the viewport bottom, read from `:root` (or any ancestor of `#ka11y-root`). Applies to `bottom-*` positions. Default: the configured vertical offset (20px). |
| `--ka11y-offset-inline-end` | custom property | Distance from the horizontal edge the trigger sits on (right for `*-right`, left for `*-left`). Default: the configured horizontal offset (20px). |
| `window.kotlinskidevA11y.api` | probe | `1`. See below. |

The transition is switched off while `prefers-reduced-motion: reduce` matches and while `html.ka11y-stop-animations` is set. The safe-area inset is still added to both offsets.

```css
:root { --ka11y-offset-bottom: 5rem; }
```

```js
document.documentElement.classList.toggle('ka11y-floating-hidden', nearFooter);
```

**Probe timing.** `window.kotlinskidevA11y.api === 1` is defined by the inline bootstrap script printed in `<head>`, so it is available to any theme script, before DOM ready and before any plugin chunk loads, under every loading strategy. Only `api` is guaranteed at that point. `open`, `toggle`, `getState` and the other methods appear when `ka11y:ready` fires (on interaction under the default strategy), so before that push to `window.kotlinskidevA11yQueue` instead of calling them.

**Actions.** Put `data-ka11y="<action>"` on any element, see [Actions](#actions). No script of your own is needed.

**JavaScript.** `window.kotlinskidevA11y` exposes `api`, `version`, `open`, `toggle` and the other members listed under [JavaScript API](#javascript-api). Before it is ready, push to `window.kotlinskidevA11yQueue`.

**Events.** `ka11y:ready`, `ka11y:open`, `ka11y:close` and `ka11y:change` on `document`, see [Events](#events).

**Motion.** Respect Stop animations through `html.ka11y-stop-animations`, the `kotlinskidev-a11y:motion` event on `window` (`detail.stopped`) and `window.kotlinskidevA11yMotion`, see [Motion state](#motion-state).

**Dark and light mode.** The widget follows `theme.darkSelector` and `theme.lightSelector`, matched against `html` and `body`. The defaults match `html.dark`, `html.dark-mode`, `html[data-theme="dark"]`, `body.dark`, `body.dark-mode` and the `light` equivalents. A theme with another convention sets its own without touching saved settings:

```php
add_filter(
	'kotlinskidev_a11y_default_selectors',
	static fn ( array $selectors ): array => array(
		'darkSelector'  => 'html.theme-night',
		'lightSelector' => 'html.theme-day',
	)
);
```

A site that saved its own selectors keeps them. Sites that stored the former defaults (`html.dark-mode, body.dark-mode` and `html.light-mode, body.light-mode`) behave exactly as before.

**Palette.** Color fields accept `var(--wp--preset--color--<slug>, #fallback)`. The admin reads the palette from `wp_get_global_settings( array( 'color', 'palette' ) )`, so a block theme only needs to define its palette in `theme.json`.

**REST.** `GET kotlinskidev-a11y/v1/trigger-options` (capability `edit_posts`) returns `{ "features": string[], "profiles": string[] }` for editor controls that offer triggers.

**PHP.** `kotlinskidev_a11y_button()`, `kotlinskidev_a11y_get_button()`, `kotlinskidev_a11y_api_version()`, the shortcode and the block, see [Shortcode, block and PHP functions](#shortcode-block-and-php-functions). Filters are listed under [PHP hooks](#php-hooks).

## WP-CLI

`wp ka11y settings get|set|import|export|reset`, `wp ka11y doctor` and `wp ka11y access grant|revoke|list`. Synopsis, flags and exit codes are in the README. Output formats `table`, `json` and `yaml` are stable.

## REST routes

Namespace `kotlinskidev-a11y/v1`.

| Route | Method | Access | Purpose |
| --- | --- | --- | --- |
| `/settings` | GET, POST | settings capability, or the customer capability for its editable subtree | Read and save settings. `dry_run` previews and returns `changes`. Locked paths answer 409, bodies over 262144 B answer 413. |
| `/schema` | GET | settings capability or customer capability | Settings schema, presets, defaults, `effectiveDefaults`, `locked` and `sources`. |
| `/export` | GET | settings capability | Export settings. |
| `/import` | POST | settings capability | Import settings; takes `dry_run`. Refuses files from a newer plugin version with 409. |
| `/reset` | POST | settings capability | Reset all settings, or only `paths`; takes `dry_run`. |
| `/panel-data` | GET | public | Panel data for `locale` (required, must be a locale the site uses, otherwise 404), with optional version `v`. The panel language switcher fetches it with another locale. The payload now also holds `panel`, `layout`, `locales` and `icons`. |
| `/trigger-options` | GET | `edit_posts` | Enabled `features` and `profiles` keys, used by the block editor. |
| `/alt-text/<id>` | POST | `upload_files` and `edit_post` | Save the alt text of one attachment. |
| `/update-channel` | GET, POST | `update_plugins` and nonce | Read or set the update channel. POST answers 409 when a constant fixes it. Not registered when the updater is off. |
| `/releases` | GET | `update_plugins` and nonce | Stable releases older than the installed one that can be rolled back to. Not registered when the updater is off. |
| `/network/settings` | GET, POST | `manage_network_options` and nonce | Network defaults and locks. Multisite only. |
| `/network/schema` | GET | `manage_network_options` and nonce | Schema for the network page. |
| `/network/export` | GET | `manage_network_options` and nonce | Export network defaults. |
| `/network/import` | POST | `manage_network_options` and nonce | Import network defaults. |
| `/network/reset` | POST | `manage_network_options` and nonce | Reset network defaults. |

`/trigger-options` returns `{ "features": string[], "profiles": string[] }`.

## Panel behaviour changes in 0.4.0

- The panel dialog is non-modal. `aria-modal` is not set, Tab is not trapped, and Escape is handled only when focus is inside the panel or on the launcher.
- No new events and no change to `PublicState`. The panel calls the same store methods, so `ka11y:open`, `ka11y:close` and `ka11y:change` (`source: 'panel'`) fire as before.
- The language switcher changes only the widget language. It stores the choice in `localStorage` under `<storage.key>-locale` and fires no event.

## Security notes

- Never build trigger markup by concatenating untrusted text. Use the PHP functions or the shortcode, which escape.
- Custom selectors are used only in selector APIs, never printed into CSS or HTML. Selectors such as `html`, `body` and `*` are rejected.
- A page script that stops propagation on a capture listener registered on `document` before the plugin can block triggers.
- URL actions can only enable enabled features and are never saved by themselves.
- Updates are verified twice. The `.sha256` asset guards against a damaged download. The `.sig` asset is an Ed25519 detached signature over the zip, checked with `sodium_crypto_sign_verify_detached()` against a public key built into the plugin, so a tampered release cannot pass by shipping its own checksum. The package URL must be the pinned `https://github.com/<owner>/<repo>/releases/download/v<version>/kotlinskidev-accessibility.zip` path: no query, fragment, `..`, userinfo or port. Releases from 1.1.0 on must carry a valid signature; a missing, malformed or wrong signature discards the download. Older releases without a `.sig` still install after the checksum check, but a signature that is present and wrong always blocks.
- `performance.pageCss` defaults to `lazy`: the page stylesheet loads only when a feature needs it and adds nothing to the HTML. `inline` prints the whole page stylesheet in every page's `<head>` (about 6.9 KB raw, 1.6 KB gzip at the time of writing) and cannot be cached between pages, so use it only when a strict CSP or a no-extra-request rule demands it; `linked` is the cacheable alternative.

## Deprecation policy

The full policy for every surface, and the list of current deprecations, is in [DEPRECATION.md](DEPRECATION.md).

- Additive changes (a new action, event, method or field) ship in any minor release and do not change `api`.
- A breaking change to anything in this file changes `api` and ships in a minor release at the earliest.
- The previous behaviour stays for one more minor release, with one `console.warn('[kotlinskidev-a11y] deprecated: ...')` per page view per item, a `Deprecated` entry in `CHANGELOG.md` and a note here. It is removed in the next minor.
- The settings option name, the REST namespace, the `window.kotlinskidevA11y` global, the `#ka11y-root` host, the `#kotlinskidev-a11y` hash and the hook names above change only in a major release.

## API changelog

| Plugin version | API | Change |
| --- | --- | --- |
| 0.3.0 | 1 | Action vocabulary, trigger surfaces, JavaScript API, events, shortcode, block, PHP functions and the new filters. Removed the v0.2 `kotlinskidev_a11y_legacy_config` filter. |
| 0.4.0 | 1 | No API change. New filters `kotlinskidev_a11y_locale_label` and `kotlinskidev_a11y_icons`, additive `/panel-data` payload, non-modal panel. |
| 1.0.0 | 1 | No change to the JavaScript API, events or actions. Added settings management: dry runs, locks, customer capability, network routes, update routes, WP-CLI, the constants `KOTLINSKIDEV_A11Y_LOCKED_SETTINGS`, `KOTLINSKIDEV_A11Y_UPDATE_CHANNEL` and `KOTLINSKIDEV_A11Y_DISABLE_UPDATER`, and the filters `kotlinskidev_a11y_customer_capability`, `_customer_paths`, `_locked_settings`, `_known_locales`, `_default_locale`, `_update_channel`, `_enable_updater` and `_rollback_releases`. |
| 1.0.1 | 1 | No change to the JavaScript API, events or actions. Added the presence probe `KOTLINSKIDEV_A11Y_API` and `kotlinskidev_a11y_api_version()`, the filter `kotlinskidev_a11y_default_selectors` and neutral default dark and light selectors. |
| 1.1.0 | 1 | No change to the JavaScript API, events or actions. Added the theme contract: class `ka11y-floating-hidden`, custom properties `--ka11y-offset-bottom` and `--ka11y-offset-inline-end`, and `window.kotlinskidevA11y.api` defined at page load. |
