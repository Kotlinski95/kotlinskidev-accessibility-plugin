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
| `hidden` | No launcher button. Use triggers or the keyboard shortcut. |

The keyboard shortcut is configurable and works in every mode when enabled. The admin warns when `hidden` is chosen and the home page has no trigger.

## PHP hooks

| Hook | Type | Purpose |
| --- | --- | --- |
| `kotlinskidev_a11y_trigger_selectors` | filter | `array $selectors` in, array out. Add custom trigger selectors. Each goes through the same sanitizer as the setting. |
| `kotlinskidev_a11y_url_actions` | filter | `array $names` in, array out. Narrow the URL allowlist. The result is intersected with `open`, `feature` and `profile` and with the setting, so it never widens it. |
| `kotlinskidev_a11y_button_html` | filter | `string $html, array $args` in, string out. Change trigger markup. The result is filtered through `wp_kses` again. |
| `kotlinskidev_a11y_capability` | filter | Capability required to manage settings. |
| `kotlinskidev_a11y_should_render` | filter | Decide whether the widget renders on the request. |
| `kotlinskidev_a11y_current_locale` | filter | Override the locale used for strings. |
| `kotlinskidev_a11y_strings` | filter | Adjust the strings sent to the front end. |
| `kotlinskidev_a11y_cache_invalidated` | action | `string $reason`: `settings`, `update` or `translations`. |

Update hooks are described in the README.

## REST routes

Namespace `kotlinskidev-a11y/v1`.

| Route | Method | Access | Purpose |
| --- | --- | --- | --- |
| `/settings` | GET, POST | settings capability | Read and save settings. |
| `/schema` | GET | settings capability | Settings schema, presets and defaults. |
| `/export` | GET | settings capability | Export settings. |
| `/import` | POST | settings capability | Import settings. |
| `/reset` | POST | settings capability | Reset settings. |
| `/panel-data` | GET | public | Panel data for `locale`, with optional version `v`. |
| `/trigger-options` | GET | `edit_posts` | Enabled `features` and `profiles` keys, used by the block editor. |

`/trigger-options` returns `{ "features": string[], "profiles": string[] }`.

## Security notes

- Never build trigger markup by concatenating untrusted text. Use the PHP functions or the shortcode, which escape.
- Custom selectors are used only in selector APIs, never printed into CSS or HTML. Selectors such as `html`, `body` and `*` are rejected.
- A page script that stops propagation on a capture listener registered on `document` before the plugin can block triggers.
- URL actions can only enable enabled features and are never saved by themselves.

## Deprecation policy

- Additive changes (a new action, event, method or field) ship in any minor release and do not change `api`.
- A breaking change to anything in this file changes `api` and ships in a minor release at the earliest.
- The previous behaviour stays for one more minor release, with one `console.warn('[kotlinskidev-a11y] deprecated: ...')` per page view per item, a `Deprecated` entry in `CHANGELOG.md` and a note here. It is removed in the next minor.
- The settings option name, the REST namespace, the `window.kotlinskidevA11y` global, the `#ka11y-root` host, the `#kotlinskidev-a11y` hash and the hook names above change only in a major release.

## API changelog

| Plugin version | API | Change |
| --- | --- | --- |
| 0.3.0 | 1 | Action vocabulary, trigger surfaces, JavaScript API, events, shortcode, block, PHP functions and the new filters. Removed the v0.2 `kotlinskidev_a11y_legacy_config` filter. |
