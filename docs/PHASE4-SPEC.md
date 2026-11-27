# Phase 4 spec: triggers and public API, v0.3.0

Status: draft for owner review. Source of truth for Phase 4 once approved. It replaces the Phase 4 section of `ROADMAP.md` where the two differ. Phase 4b (a theme quick-actions block) is out of scope, but every contract it uses is defined here.

Rules for every milestone: strict TypeScript (no `any`), no comments anywhere (code, docblocks, phpcs ignores), WPCS PHP, no jQuery, no React import (the block editor script uses the `wp.*` globals), all strings through i18n. The `pl_PL` translations are done in M4.9.

## Open decisions for the owner

| # | Decision | Recommendation |
| --- | --- | --- |
| D1 | Budget: raise `everyPage` from 3840 to 4352 B gzip (+512), `scripts.loader` from 3072 to 3328, `inline.bootstrap` from 1024 to 1152, `scripts.kernel` from 4608 to 5632 (section 9). | Approve. Every trigger kind needs one listener before interaction, and the bytes stay under a third of v0.1's 13.8 KB. |
| D2 | URL and landing-hash actions are "not saved". Strict reading: never written to storage. Practical reading: the URL itself never saves; the first deliberate change by the visitor saves the full current state, URL-applied features included. | Practical reading (6.4). Strict needs per-key class and var bookkeeping in the store and costs about 400 B in the kernel for an edge case. |
| D3 | Remove the v0.2 compat shim now (`mergeLegacyConfig` and the `kotlinskidev_a11y_legacy_config` filter), as PHASE3-SPEC section 8 promised for v0.3.0. | Remove in M4.9. It frees about 120 B in the kernel. Keep one CHANGELOG `Removed` line. |
| D4 | PHP template function: echo or return. | `kotlinskidev_a11y_button( array $args = array() ): void` echoes; `kotlinskidev_a11y_get_button( array $args = array() ): string` returns. Themes then pass WPCS without an `echo` of unescaped output. |
| D5 | `.ka11y-open` is the only class trigger. A second class `.ka11y-toggle` is not added, because `.ka11y-toggle` is already a panel class inside the shadow root. | Keep only `.ka11y-open`. Other actions use `data-ka11y`. |
| D6 | Block in Navigation: core does not let third-party blocks into `core/navigation` without an editor filter. | Add the block to Navigation's `allowedBlocks` through the `blocks.registerBlockType` JS filter in the editor script, verified on minimum and latest WordPress in M4.6. If it fails on the minimum version, ship the block outside Navigation and document the shortcode in a Custom HTML item. |

## 0. Goals and non-goals

Goals:

1. One action vocabulary for every trigger surface, parsed and validated in one place.
2. Any element on the page can open, close or toggle the panel, or switch a feature or profile, with correct ARIA and keyboard behaviour, before and after the loader runs.
3. A versioned JavaScript API and DOM events that themes and third-party code can rely on.
4. Launcher modes `floating`, `inline` and `hidden`, so the site can drop the floating button and use its own triggers.
5. A shortcode, a block and a PHP function that print the same safe trigger markup.
6. An admin snippet generator, so customers never hand-write a trigger.
7. No regression in the Phase 3 performance targets beyond the budget change in D1.

Non-goals:

- UI parity and modality change (Phase 5). The panel stays `aria-modal="true"` in v0.3.0.
- A theme quick-actions block (Phase 4b).
- Server-side state, analytics or tracking of trigger use.
- New features or profiles. The vocabulary covers the existing 26 feature keys and 5 profile keys.
- A REST API for visitors. REST stays admin-only plus `/panel-data`.

## 1. Frozen contracts

These must not change in Phase 4. Every item below has a test that already exists or is added in section 11.

| Contract | Value |
| --- | --- |
| Option | `kotlinskidev_a11y_settings` |
| REST | namespace `kotlinskidev-a11y/v1`, routes unchanged, no new visitor route |
| Capability filter | `kotlinskidev_a11y_capability` |
| Config global | `window.kotlinskidevA11y`, fields from PHASE3-SPEC section 8 kept; Phase 4 fields are additive |
| Host | `#ka11y-root`, still printed on every rendered page in every launcher mode |
| Open hash | `#kotlinskidev-a11y`, behaviour unchanged: shows a hidden toolbar, then opens |
| Storage | key `ka11y`, `SavedState` format, hidden-toolbar key `ka11y-hidden` |
| Recovery | `?ka11y=reset` and `?ka11y=off`, handled by the bootstrap before anything else |
| Off flag | `window.kotlinskidevA11yOff` |
| Queue | `window.kotlinskidevA11yQueue`, `KA11yCommand`, `KA11yQueue`, drain-then-replace install, the action regex, FIFO replay, the 50 ms double-toggle guard |
| Root attributes | `html[data-ka11y-hidden]`, `html[data-ka11y="error"]`, host `data-ka11y-position-*`, `data-ka11y-size`, `data-ka11y-icon-border`, `data-state` |
| Hooks | `kotlinskidev_a11y_should_render`, `kotlinskidev_a11y_current_locale`, `kotlinskidev_a11y_strings`, `kotlinskidev_a11y_update_source`, `kotlinskidev_a11y_update_token`, `kotlinskidev_a11y_cache_invalidated` |
| Shortcode | `[kotlinskidev_a11y_statement]` unchanged |
| Update | slug `kotlinskidev-accessibility`, asset `kotlinskidev-accessibility.zip` |

Additive changes allowed by this spec:

- `CommandSource` gains `'trigger'` and `'url'`. Existing members keep their meaning.
- The loader's handler map gains entries. Unknown valid actions are still dropped silently.
- `window.kotlinskidevA11y` gains API methods and the fields in 5.4.
- New hooks listed in 8.4.

## 2. Action vocabulary

### 2.1 Grammar

The queue regex stays the outer gate:

```text
^[a-z][a-zA-Z0-9]*(?::[a-zA-Z0-9_-]+){0,2}$
```

Inside it, the only accepted actions are:

| Action | Arguments | Effect |
| --- | --- | --- |
| `open` | none | Show a hidden toolbar, then open the panel. |
| `close` | none | Close the panel. No-op when it never opened. |
| `toggle` | none | Open or close the panel. |
| `reset` | none | Reset every feature and profile, clear saved state. Panel stays as it is. |
| `feature:<key>` | key | Toggle the feature: off goes to its default level (`features.<key>.default`, or 1 when that is 0 or false); on goes to off. |
| `feature:<key>:<level>` | key, level | Set the level. `level` matches `^(0|[1-9][0-9]?)$`. 0 is off. Values above `levelCountOf(key)` are clamped to it. |
| `profile:<key>` | key | Toggle the profile through `Profiles.toggle`. |
| `statement` | none | Navigate to `statementUrl` from the panel data. |
| `hide` | none | Hide the launcher for this session (same as the panel's "hide for session"), and close the panel. |
| `show` | none | Undo a visitor hide (`showToolbar`). |
| `trigger` | none | Internal. Resolve the action from `command.opener` (section 3.1). Not documented in `docs/API.md`. |

Rules:

- `<key>` for features must be one of `Schema::FEATURE_KEYS` and for profiles one of `Schema::profile_keys()`. Lookups use `Object.hasOwn` on a frozen object or a `Set`, never `in`, so `feature:__proto__` and `feature:constructor` are rejected.
- A feature or profile action is applied only when the panel data says the key is enabled (`data.features[key].enabled === true`, `data.profiles[key].enabled === true`). This holds for every source, not only URL actions. Disabled keys are dropped silently.
- Anything else that passes the regex is dropped silently, as in Phase 3.
- Actions are case-sensitive. `Open` fails the regex.

### 2.2 Shared parser

New file `src/ts/shared/actions.ts`, imported by the loader and the kernel:

```ts
export type DialogActionName = 'open' | 'close' | 'toggle';

export type ActionName = DialogActionName | 'reset' | 'feature' | 'profile' | 'statement' | 'hide' | 'show' | 'trigger';

export interface ParsedAction {
  name: ActionName;
  key: string | null;
  level: number | null;
}

export const ACTION_PATTERN: RegExp;

export const parseAction: (action: string) => ParsedAction | null;

export const isDialogAction: (name: ActionName) => name is DialogActionName;
```

- `parseAction` returns `null` for anything outside 2.1. It checks the shape only. Key membership and enabled state are checked in the kernel against the panel data (5.2), because the inline config does not carry the feature list.
- `ACTION_PATTERN` moves here from `loader/queue.ts`. `queue.ts` imports it.
- The loader uses only `parseAction(...)?.name` and `isDialogAction`. Feature and profile handling is not in the loader.

PHP mirror: `src/php/Frontend/Actions.php`:

```php
final class Actions {
	public const PATTERN = '/^[a-z][a-zA-Z0-9]*(?::[a-zA-Z0-9_-]+){0,2}$/';
	public const SIMPLE  = array( 'open', 'close', 'toggle', 'reset', 'statement', 'hide', 'show' );
	public const URL     = array( 'open', 'feature', 'profile' );

	public static function parse( string $action ): ?array;
	public static function is_allowed( string $action, array $settings ): bool;
}
```

- `parse` returns `array{name: string, key: ?string, level: ?int}` or `null`, with the same rules as the TS parser. `trigger` is not accepted in PHP.
- `is_allowed` adds the key and enabled checks against `$settings`.
- A shared fixture `tests/fixtures/actions.json` (valid and invalid strings with expected results) is read by both Jest and PHPUnit, so the two parsers cannot drift.

## 3. Trigger surfaces

### 3.1 Resolution

One function decides the action for a clicked element, `resolveTrigger(element, config)` in `src/ts/loader/triggers.ts`:

1. `data-ka11y` attribute, when the element is not `document.documentElement`. The value is the action.
2. `a[href^="#ka11y/"]`: the part after `#ka11y/`, after `decodeURIComponent` in a `try`.
3. `a[href="#kotlinskidev-a11y"]`: `open`.
4. Class `ka11y-open`: `open`.
5. Match of the custom selector list (`config.triggers.s`): `toggle`.
6. Otherwise `null`.

The first match wins. The result goes through `parseAction`. A `null` result means the click is not ours: no `preventDefault`, no push.

The trigger selector is:

```text
[data-ka11y]:not(html),a[href^="#ka11y/"],a[href="#kotlinskidev-a11y"],.ka11y-open
```

plus `,` and `config.triggers.s` when that is not empty. The `:not(html)` part is required: the bootstrap sets `html[data-ka11y="error"]` on failure, and without it every click on the page would match.

### 3.2 Surfaces

| Surface | Example | Source | Full vocabulary | Saved |
| --- | --- | --- | --- | --- |
| Open hash link | `<a href="#kotlinskidev-a11y">` | `hash` | `open` only | n/a |
| Action hash link | `<a href="#ka11y/profile:adhdFriendly">` | `trigger` | yes | yes |
| Landing hash | visit `/page/#ka11y/feature:biggerText:2` | `url` | URL allowlist | no (D2) |
| URL query | `?ka11y=profile:adhdFriendly` | `url` | URL allowlist | no (D2) |
| CSS class | `<button class="ka11y-open">` | `trigger` | `open` only | n/a |
| Custom selectors | setting `triggers.selectors`, e.g. `.menu-item-a11y > a` | `trigger` | `toggle` only, unless the element also has `data-ka11y` | n/a |
| Data attribute | `<button data-ka11y="feature:darkContrast">` | `trigger` | yes | yes |
| JS API | `kotlinskidevA11y.set('darkContrast', 1)` | `api` | yes | yes |
| Queue | `kotlinskidevA11yQueue.push({ action: 'open' })` | `api` unless given | yes | yes |
| Shortcode | `[kotlinskidev_a11y_button action="open" label="Accessibility"]` | `trigger` | yes | yes |
| Block | Accessibility trigger | `trigger` | yes | yes |
| PHP | `kotlinskidev_a11y_button( array( 'action' => 'open' ) )` | `trigger` | yes | yes |
| Shortcut | `Alt+Shift+A` | `shortcut` | `toggle` | n/a |
| Launcher | host click | `launcher` | `toggle` | n/a |

### 3.3 Hash

- Click on `a[href^="#ka11y/"]`: handled by the delegated listener (4.1) with `preventDefault`, so the hash never changes and a second click works. Source `trigger`.
- `location.hash` at loader boot, and `hashchange`: when the hash starts with `#ka11y/`, the action goes through the URL allowlist (3.4) with source `url`. After the push, `history.replaceState(null, '', location.pathname + location.search)` removes the hash, so a reload does not re-apply it.
- `#kotlinskidev-a11y` keeps the exact Phase 3 behaviour (frozen). The hash is not removed.

### 3.4 URL query `?ka11y=<action>`

- The bootstrap already reads `ka11y`. `off` and `reset` keep their Phase 3 meaning and are never pushed as commands.
- Any other value: the bootstrap pushes `{ action: value, source: 'url' }` to the queue. The value goes through the queue regex like any command.
- The loader drops a `url` command unless `parseAction(action).name` is in `config.triggers.u` (default `["open","feature","profile"]`, setting `triggers.urlActions`, 7.1). `close`, `toggle`, `reset`, `statement`, `hide`, `show` and `trigger` are never URL actions.
- From a `url` source, `feature:<key>` means "turn on at the default level", never "toggle off". `profile:<key>` means "apply", never "clear".
- Enabled-only (2.1) applies as for every source.
- After the push, the loader removes the `ka11y` parameter with `history.replaceState`, keeping every other parameter and the hash.
- Not saved: see 5.3.

### 3.5 Shortcode, block and PHP function

All three call one renderer, `Kotlinskidev\A11y\Triggers\Button::render( array $args ): string`.

Arguments:

| Arg | Type | Default | Rule |
| --- | --- | --- | --- |
| `action` | string | `open` | `Actions::is_allowed`, else render `''` |
| `label` | string | per action from `Strings` (`triggerOpen`, `triggerClose`, `triggerToggle`, `triggerReset`, `triggerStatement`, `triggerHide`, `triggerShow`; feature and profile use their panel label) | plain text, at most 100 chars after `sanitize_text_field`, printed with `esc_html` |
| `element` | `button` or `link` | `button` | enum, else `button` |
| `class` | string | `''` | split on spaces, each token through `sanitize_html_class`, empty tokens dropped, at most 10 |
| `show_icon` | bool | false | prints the launcher SVG with `aria-hidden="true"` before the label |

Output for `element="button"`:

```html
<button type="button" class="ka11y-trigger EXTRA" data-ka11y="ACTION" ARIA>ICON LABEL</button>
```

Output for `element="link"`:

```html
<a href="#ka11y/ACTION" class="ka11y-trigger EXTRA" data-ka11y="ACTION" role="button" ARIA>ICON LABEL</a>
```

`ARIA` by action:

| Action | Attributes |
| --- | --- |
| `open`, `toggle` | `aria-controls="ka11y-root" aria-expanded="false" aria-haspopup="dialog"` |
| `close` | `aria-controls="ka11y-root"` |
| `feature:*`, `profile:*` | `aria-pressed="false"` |
| others | none |

`statement` with a known `statementUrl` renders a plain `<a href="URL" class="ka11y-trigger EXTRA">` with no `data-ka11y` and no `role`, so it works without JS.

Every value is escaped with `esc_attr` or `esc_html` while the string is built, and the final string goes through `wp_kses` with an allowlist of exactly the elements and attributes above plus the launcher SVG allowlist from `Markup`.

The renderer returns `''` when `Visibility::should_render()` is false, so a trigger never appears on a page without a panel.

Shortcode: `[kotlinskidev_a11y_button]`, class `Triggers\ButtonShortcode`, `shortcode_atts` with the args above, `show_icon` accepts `1`, `true`, `yes`.

Block: `kotlinskidev-a11y/trigger`, `src/blocks/trigger/block.json`, `apiVersion` 3, dynamic (`render` callback to `Button::render`, `save` returns `null`). Attributes `action` (string, default `open`), `label` (string), `element` (enum), `showIcon` (bool). Supports `color`, `typography`, `spacing`, `className`, `__experimentalBorder`. The wrapper classes from `get_block_wrapper_attributes()` are merged into `class`. Editor script `src/ts/blocks/trigger/index.ts`, built to `build/blocks/trigger.js`, uses `wp.blocks`, `wp.blockEditor`, `wp.components`, `wp.element.createElement` and `wp.i18n` globals only. Inspector: action select (dialog actions, `reset`, `statement`, `hide`, `show`, then enabled features and profiles from `wp.apiFetch` of `/schema`), level select for features with more than one level, label text, element radio, icon toggle. The preview is the same markup built with `createElement`. Navigation support per D6.

PHP functions in `src/php/functions.php`, loaded from the main plugin file after the autoloader, each wrapped in `function_exists`:

```php
function kotlinskidev_a11y_button( array $args = array() ): void
function kotlinskidev_a11y_get_button( array $args = array() ): string
```

`kotlinskidev_a11y_button` echoes `kotlinskidev_a11y_get_button( $args )`. The string is already kses-filtered, so the echo needs no extra escaping at the call site, and phpcs is satisfied by `wp_kses` inside the renderer.

No-JS: the `<noscript>` style in `Assets::NOSCRIPT` becomes `#ka11y-root,.ka11y-trigger{display:none!important}`. Device rules that hide `#ka11y-root` on a device also hide `.ka11y-trigger`.

## 4. Where the code lives

### 4.1 Delegated click: the bootstrap

There is exactly one capture-phase `click` listener for triggers on the page: `runtime.e` in `src/ts/bootstrap/index.ts`. It is installed in `<head>` and stays for the page lifetime. The loader no longer removes it.

Listener logic:

1. `target = event.target.closest(SELECTOR)`, where `SELECTOR` is the 3.1 trigger selector plus `,#ka11y-root`, plus `config.t` from the bootstrap prefix when set. Wrap `closest` in `try` so a broken custom selector cannot throw on every click; on error, retry with the built-in selector only.
2. No target: return.
3. Target is `#ka11y-root`: when `window.kotlinskidevA11yQueue` is missing or an array (loader not installed), push `{ action: 'open', source: 'early' }` as today. Otherwise return; the loader's host listener handles it.
4. Otherwise: when the target is an `a` element, or has `data-ka11y`, call `preventDefault()`. Push `{ action: 'trigger', source: 'trigger', opener: target }`.

The bootstrap does no parsing. It never reads the action text, so it adds no validation bytes.

URL query: after the recovery branch, when `recovery` is a non-empty string other than `off` and `reset`, push `{ action: recovery, source: 'url' }`.

Bootstrap prefix gains `t`: the combined custom selector string, or omitted when empty.

### 4.2 Loader

`src/ts/loader/*` gains only:

- `trigger` handler: `resolveTrigger(command.opener, config)`, then re-dispatch the resolved action with `source: 'trigger'` and the same `opener`.
- Source filter: drop `url` commands whose name is not in `config.triggers.u` (3.4), then remove the `ka11y` parameter or `#ka11y/` hash.
- Routing: dialog actions go to the existing panel flow (`open.ts`). `hide`, `show` and `statement` are handled in the loader (`showToolbar` already exists; `hide` mirrors it; `statement` calls `chunks.fetchData()` and `location.assign(data.statementUrl)` when the URL protocol is `http:` or `https:`). `reset`, `feature` and `profile` go to `ensureKernel().then((kernel) => kernel.run(command))`.
- Before `open` and `toggle` from any source except `launcher`, call `showToolbar` when `html[data-ka11y-hidden]` is set (same as the hash today).
- Device gate: dialog actions are dropped while `config.hiddenMedia` matches, because the host is `display:none` there.
- Hash: extend `onHashChange` for `#ka11y/` (3.3). Remove `onDocumentClick` (the bootstrap now handles open-hash clicks). This saves bytes.
- Space on link triggers: the existing `keydown` listener also handles `event.key === ' '` when `event.target` is an `a[role="button"]` that matches the trigger selector: `preventDefault()`, then `target.click()`.
- ARIA scan at `onReady` (4.4).
- Launcher mode `inline` (6.2).
- API methods and the `ka11y:ready` event (section 5.4, 5.5).

Everything else is in the kernel or panel chunk.

### 4.3 Kernel and panel

- `src/ts/frontend/kernel/commands.ts` (new): `run(command)` for `reset`, `feature`, `profile`; the enabled check; level clamping; `url` semantics; the save suspension (5.3); public state (5.4); `ka11y:change` events; `aria-pressed` sync on triggers.
- `KernelApi` gains `run(command: KA11yCommand): Promise<void>` and `state(): PublicState`. `run` awaits the panel data through a `getData` option passed by the loader to `bootKernel` (the loader's memoized `chunks.fetchData`), then calls `attachData` when profiles are not yet attached.
- Panel chunk: `ka11y:open` and `ka11y:close` events and `aria-expanded` sync from the existing dialog `onChange` in `panel.ts`; focus return fallback in `a11y-dialog.ts` (4.5).

### 4.4 ARIA wiring

At loader `onReady`, for every element matching the trigger selector (not the host):

| Condition | Set when missing |
| --- | --- |
| `a` element | `role="button"` |
| resolved action is `open` or `toggle` | `aria-controls="ka11y-root"`, `aria-expanded="false"`, `aria-haspopup="dialog"` |
| resolved action is `close` | `aria-controls="ka11y-root"` |
| resolved action is `feature:*` or `profile:*` | `aria-pressed="false"` |

- Attributes already present are never overwritten, so server output and hand-written ARIA win.
- `aria-controls` points to `ka11y-root`, the light-DOM host. An id inside the shadow root cannot be referenced from the light DOM.
- Elements added after `onReady` get their attributes on the next sync below, not immediately. This is documented in `docs/API.md`; there is no MutationObserver.
- Panel `onChange(open)`: every trigger whose resolved action is `open` or `toggle` gets `aria-expanded="<open>"`. The query runs at each change, so late triggers are covered.
- Kernel store change: every `feature:<key>` trigger gets `aria-pressed` from `isLevelActive(levels[key])`; a `feature:<key>:<level>` trigger gets `true` only when the level equals that number; `profile:<key>` gets `profile === key`.

### 4.5 Focus

- `Dialog.open(opener)`: `returnTarget = opener ?? (document.activeElement in the light DOM, when it is not body) ?? launcher`.
- `Dialog.close()`: focus `returnTarget` when it is connected and not inside a `[hidden]` or `display:none` subtree, else the launcher when it is visible, else `document.body` with `tabindex="-1"` set and removed after focus.
- Trigger commands always carry `opener`. API calls accept an optional opener.
- Shortcut with the launcher hidden: the element focused before opening gets focus back.

## 5. JavaScript API and events

### 5.1 Shape

Installed by the loader in `onReady`, right after `installQueue`, as own properties of `window.kotlinskidevA11y`:

```ts
export type PublicFeatureLevel = number;

export interface PublicState {
  api: 1;
  open: boolean;
  profile: string | null;
  features: Record<string, PublicFeatureLevel>;
}

export type ApiEventName = 'ready' | 'open' | 'close' | 'change';

export interface KotlinskidevA11yApi {
  api: 1;
  open(opener?: HTMLElement | null): void;
  close(): void;
  toggle(target?: string, opener?: HTMLElement | null): void;
  set(feature: string, level: number | boolean): void;
  reset(): void;
  getState(): Promise<PublicState>;
  on(event: ApiEventName, listener: (detail: unknown) => void): () => void;
}
```

- `open`, `close`, `reset`: push the action with `source: 'api'`.
- `toggle()` toggles the panel. `toggle('feature:darkContrast')` and `toggle('profile:adhdFriendly')` push that action. Any other string is pushed as is and dropped by the queue if invalid.
- `set(feature, level)`: `true` maps to the feature's default level, `false` to 0, a number to `feature:<key>:<n>` after `Math.trunc`. Non-finite numbers are dropped.
- `getState()`: `ensureKernel().then((kernel) => kernel.state())`. It loads the kernel but never the panel. `features` holds only active keys, with `true` reported as 1. `open` reads the panel flow's state.
- `on(name, listener)`: `addEventListener('ka11y:' + name)` on `document`, listener receives `event.detail`. Returns an unsubscribe function. When the loader has already fired `ready`, `on('ready', fn)` calls `fn` on the next microtask.
- Methods are thin `push` wrappers. Before the loader runs, the documented way is the queue (5.3 of PHASE3-SPEC).
- `api` is the integer API version.

### 5.2 Kernel semantics

- `feature`: `store.setLevel(key, level)`. When a profile owns the key, the existing profile ownership rules in `profiles.ts` apply.
- `profile`: `profiles.toggle(key)`; from `url`, `profiles.apply(key)` when not active.
- `reset`: `store.reset()`, then `storage.save` of the empty state, which clears it as the panel's reset button does today.
- Commands for keys that are unknown or disabled resolve without effect and without an event.

### 5.3 Not saved (D2, recommended reading)

- The kernel has a flag `suspended`. A `url` command that changes state sets it before mutating.
- While `suspended`, `onStateSave` does nothing.
- The first state change from any other source (`trigger`, `api`, `shortcut`, `launcher`, panel UI) clears `suspended` and then saves the full current state.
- A reload after only URL actions shows the page without them, because nothing was saved and the parameter was removed from the address bar.

### 5.4 Config fields added to `window.kotlinskidevA11y`

| Field | Type | Where |
| --- | --- | --- |
| `triggers` | `{ s: string; u: string[] }` | inline config |
| `launcher` | `{ mode: 'floating' \| 'inline' \| 'hidden'; mount: string }` | inline config |
| `api`, methods of 5.1 | | loader, at `onReady` |

`s` is the combined custom selector string (7.2), `u` the URL allowlist. Both are omitted when they equal the defaults, to save inline bytes: the loader falls back to `''` and `["open","feature","profile"]`.

### 5.5 Events

All are `CustomEvent` dispatched on `document`, `bubbles: false`, `cancelable: false`.

| Event | Fired by | When | `detail` |
| --- | --- | --- | --- |
| `ka11y:ready` | loader | once, after the API is installed | `{ api: 1, version: string }` |
| `ka11y:open` | panel chunk | dialog opened | `{ source: CommandSource \| 'panel' }` |
| `ka11y:close` | panel chunk | dialog closed | `{ source: CommandSource \| 'panel' }` |
| `ka11y:change` | kernel | after each store commit that changed `levels` or `profile` | `{ state: PublicState; source: CommandSource \| 'panel' \| 'restore' }` |

- `restore` is the source of the change that restores saved state at kernel boot.
- Listener errors are isolated by the browser's event dispatch and do not stop other listeners.
- No event is fired for dropped commands.

## 6. Launcher modes

### 6.1 Setting

`widget.launcher`: `floating` (default, Phase 3 behaviour), `inline`, `hidden`. `widget.mount`: a CSS selector, used only by `inline`.

### 6.2 Behaviour

| Mode | Server markup | Loader | Shortcut | Panel |
| --- | --- | --- | --- | --- |
| `floating` | unchanged | unchanged | per `shortcut.enabled` | unchanged |
| `inline` | host gets `data-ka11y-launcher="inline"` | at `onReady`, `document.querySelector(mount)`; when found, `append(host)` into it (the shadow root moves with it); when not found or the selector throws, set the attribute to `floating` and warn once in the console | per setting | fixed position as today, anchored to the viewport, not the mount |
| `hidden` | host gets `data-ka11y-launcher="hidden"`; the launcher button gets the `hidden` attribute | unchanged | stays on per `shortcut.enabled` | unchanged, focus per 4.5 |

- Launcher CSS (`src/scss/launcher/_state.scss`) adds `:host([data-ka11y-launcher='inline'])` with `position: static` and no offsets, and `:host([data-ka11y-launcher='hidden']) .ka11y-launcher { display: none; }`. The `styles.launcher` raw budget stays 1400; if the rules do not fit, shorten existing rules first.
- `inline` causes a layout shift inside the mount at DOMContentLoaded. The admin help text says to reserve 48 px in the mount, or to use `hidden` plus a shortcode or block for zero shift.
- The visitor's "hide toolbar" (`data-ka11y-hidden`) is separate from `hidden` mode. In `hidden` mode the visitor hide still disables the shortcut, as in Phase 3, and any `open` trigger shows it again (4.2).
- `hidden` with the shortcut off and no trigger leaves the panel unreachable. The admin warns (8.2).

## 7. Settings schema v3

### 7.1 Additions (`Schema::VERSION = 3`)

| Path | Type | Sanitize | Default | Extra |
| --- | --- | --- | --- | --- |
| `widget.launcher` | string | `enum` | `floating` | enum `floating`, `inline`, `hidden` |
| `widget.mount` | string | `selector` | `''` | |
| `triggers.selectors` | array | `selector_list` | `array()` | `max` 10 |
| `triggers.urlActions` | array | `enum_list` | `array( 'open', 'feature', 'profile' )` | enum `Actions::URL` |

`triggers.urlActions` set to an empty array disables URL and landing-hash actions. `?ka11y=reset|off` are unaffected.

### 7.2 Sanitizer

New sanitize types in `Settings/Sanitizer.php`:

- `selector`: string; `trim`; at most 200 chars; must match `^[A-Za-z0-9 _#.:,>+~*=\[\]"'()^$|-]+$`; must not contain `<`, `{`, `}`, `;`, `@`, `\`, `/*`; must not be `html`, `body`, `*`, or a selector list containing one of those as a whole item. Failing values fall back to the default (`''`).
- `selector_list`: array of strings, each through `selector`, invalid items dropped, duplicates dropped, at most `max` items. The joined string (`implode( ',', $items )`) must be at most 400 chars; items past the limit are dropped.

The browser is the final judge: the loader and bootstrap wrap every `querySelector`, `querySelectorAll` and `closest` call that uses a setting in `try`, as in 4.1.

Custom selectors are only ever used in selector APIs. They are never printed into CSS, HTML or attribute values.

### 7.3 Migration v2 to v3

`Repository::migrations()[2]` returns the stored array unchanged. Defaults fill the new paths in `merge`. The migration exists so the version chain stays explicit and is tested.

Rollback: v0.2.0 reads a v3 option without error, because `merge` keeps only paths that exist in its defaults and `schemaVersion` 3 is above its loop. M4.2 adds a `RepositoryTest` fixture with a v3 option run through a copy of the v0.2.0 `merge` rules to prove it.

### 7.4 Inline config budget

`InlineConfigTest` asserts the 1536 B raw budget with 10 maximum-length selectors plus a non-default `urlActions`. If that fails, the 400 char cap in 7.2 is lowered until it passes, and the cap is written into the help text.

## 8. Admin

### 8.1 Triggers tab

New panel `src/ts/admin/panels/triggers.ts`, registered after Behavior. Sections:

1. Launcher: mode radio, mount selector field (shown for `inline`), help text from 6.2.
2. Custom selectors: list field, one selector per row, client check with `document.querySelector` in `try` and an inline error per row.
3. URL actions: three checkboxes (`open`, `feature`, `profile`), help text that URL actions are never saved by themselves and cannot enable disabled features.
4. Snippet generator (8.3).

### 8.2 No-trigger warning

Shown on the Triggers tab and as a dismissible notice on the settings screen when `widget.launcher` is `hidden`:

- The admin fetches `home_url( '/' )` with `fetch(url, { credentials: 'omit' })`, parses it with `DOMParser`, and runs the full trigger selector (3.1 plus custom selectors) on the result.
- Nothing found and `shortcut.enabled` true: warning "No accessibility trigger was found on the home page. Visitors can open the panel only with the keyboard shortcut."
- Nothing found and `shortcut.enabled` false: error "No accessibility trigger was found on the home page, and the keyboard shortcut is off. Visitors cannot open the panel."
- A fetch failure shows "The home page could not be checked." and no error.
- The check runs on tab open and after save. It never blocks saving.

### 8.3 Snippet generator

Inputs: action (select built from 2.1 with enabled features and profiles from the current form state), level (for multi-level features), label, element (`button`, `link`), extra class.

Outputs, each in a read-only `<textarea>` with a copy button (`navigator.clipboard.writeText`, fallback `select()` plus `document.execCommand('copy')`), and a status message in an `aria-live="polite"` region:

| Output | Example |
| --- | --- |
| HTML | `<button type="button" data-ka11y="profile:adhdFriendly">Focus mode</button>` |
| Link | `<a href="#ka11y/profile:adhdFriendly">Focus mode</a>` |
| Shortcode | `[kotlinskidev_a11y_button action="profile:adhdFriendly" label="Focus mode"]` |
| PHP | `<?php kotlinskidev_a11y_button( array( 'action' => 'profile:adhdFriendly', 'label' => 'Focus mode' ) ); ?>` |
| JavaScript | `kotlinskidevA11y.toggle('profile:adhdFriendly');` |
| URL | `https://example.com/?ka11y=profile:adhdFriendly` (only for URL-allowed actions) |

- Values in the generated code are escaped for their target: HTML attribute and text escaping for HTML and link, `"` and `]` stripped from shortcode labels, `'` escaped for PHP and JS strings, `encodeURIComponent` for the URL.
- The textareas are filled with `.value`, never `innerHTML`.
- Preview: the HTML output is rendered with `createElement` and `setAttribute` in a preview box, using the site's button class when the theme exposes one in `wp-element-button`. Clicking the preview does nothing.

### 8.4 New hooks

| Hook | Type | Args | Use |
| --- | --- | --- | --- |
| `kotlinskidev_a11y_button_html` | filter | `string $html, array $args` | Change trigger markup. The result goes through the same `wp_kses` allowlist again. |
| `kotlinskidev_a11y_trigger_selectors` | filter | `array $selectors` | Add selectors from code. Each item goes through the `selector` sanitizer. |
| `kotlinskidev_a11y_url_actions` | filter | `array $names` | Narrow the URL allowlist. The result is intersected with `Actions::URL`, so it can never widen it. |

## 9. Size budget

Today: `everyPage` 3837 of 3840 B gzip, so there is no headroom. The bytes Phase 4 must add before interaction:

| Item | Lives in | Estimate (gzip) |
| --- | --- | --- |
| Generic trigger selector, `trigger` push, host-skip check, URL push, `t` prefix | bootstrap | 90 to 120 |
| `trigger` handler, `resolveTrigger`, source filter, routing, URL cleanup | loader | 170 to 220 |
| `hide`, `statement`, `#ka11y/` hash, Space on links, ARIA scan, inline mount | loader | 130 to 170 |
| API methods, `ready` event | loader | 110 to 140 |
| Removed `onDocumentClick` and `runtime.e` removal | loader | minus 40 to 60 |
| Total | | 460 to 590 |

Decision (D1):

- `inline.bootstrap` 1024 to 1152, `scripts.loader` 3072 to 3328, `everyPage` 3840 to 4352. The sum rule stays the gate.
- `scripts.kernel` 4608 to 5632, for `commands.ts` (about 700 B) and public state. D3 frees about 120 B.
- `scripts.panel` stays 7168; events, `aria-expanded` sync and the focus fallback must fit. If they do not, raise it by at most 256 and record why in the CHANGELOG.
- Justified because every trigger kind needs a listener before the first interaction, and the only alternative is site-specific glue code. 4352 B is 31 percent of v0.1's 13.8 KB.

Hard rules:

- Feature, profile and reset logic, `getState` data, `aria-pressed` and `ka11y:change` never go into the loader or the bootstrap. They load with the kernel.
- No MutationObserver, no polling, no second document click listener.
- If the measured `everyPage` after M4.3 is over 4352: first move API sugar (`set` mapping, `toggle(target)`) into the kernel behind a pushed command, then drop the ARIA scan for `.ka11y-open` and custom selectors (server-rendered triggers already carry ARIA). Do not raise the budget again without an owner decision.
- `bin/check-budget.mjs` output for every milestone from M4.3 on goes into the milestone report.

## 10. Security

| Threat | Rule |
| --- | --- |
| Crafted links switching on features, or enabling disabled ones | URL and landing-hash actions only from `triggers.urlActions`, never `reset`, `hide`, `show`, `close`, `toggle`, `statement`; every feature or profile command from any source requires `enabled === true` in the panel data; URL actions are not saved by themselves (5.3) and are removed from the address bar. |
| Prototype pollution through keys | `Object.hasOwn` and `Set` lookups only; `feature:__proto__`, `feature:constructor`, `profile:toString` are in the shared fixture as rejected. |
| HTML injection through shortcode or block attributes | `action` validated by `Actions::is_allowed` before use; `label` plain text with `esc_html`; class tokens through `sanitize_html_class`; `element` enum; every attribute through `esc_attr`; final `wp_kses` with a fixed allowlist; the block is dynamic, so no stored markup; the filter output is re-kses-filtered. |
| Script injection through `data-ka11y` or the hash | Values are only parsed as action strings by `parseAction`; they are never written to the DOM as HTML, never used as selectors, never used as URLs. |
| CSS injection through custom selectors | Selectors pass the sanitizer, are only used in selector APIs inside `try`, and are never printed into CSS or HTML. |
| Open redirect through `statement` | Only `statementUrl` from the server-sanitized panel data, only `http:` or `https:`. |
| Click hijacking of unrelated elements | `preventDefault` only for anchors that match our selector and for elements with `data-ka11y`; never for `html[data-ka11y]`; class and custom-selector buttons are not prevented. |
| Admin snippet XSS | Outputs set through `.value` and `textContent`; preview built with `createElement`; no `innerHTML`. |
| CSP | No inline handlers in any output or snippet; no `eval`; existing nonce handling unchanged. |
| Third-party code calling the API | Allowed by design. The API can do what a visitor can do on the panel, nothing more. Documented in `docs/API.md`. |

`kd-web:security-reviewer` reviews M4.3, M4.6 and M4.7 before merge.

## 11. Test plan

### 11.1 PHPUnit (`tests/php`)

| File | Cases |
| --- | --- |
| `Frontend/ActionsTest.php` | every row of `tests/fixtures/actions.json`; `is_allowed` with disabled feature and profile; URL allowlist constant |
| `Settings/SchemaTest.php` | version 3; new definitions and defaults |
| `Settings/SanitizerTest.php` | `selector` accepts class, id, attribute, combinators; rejects `<`, `{`, `;`, `@`, backslash, comments, `html`, `body`, `*`, 201 chars; `selector_list` dedupe, max 10, 400 char cap; `urlActions` enum |
| `Settings/RepositoryTest.php` | migration 2 to 3 is identity; v1 to v3 chain; v3 option read with v0.2.0 merge rules keeps v0.2 keys |
| `Frontend/InlineConfigTest.php` | `triggers` and `launcher` fields; omitted when default; 1536 B budget with maximum selectors |
| `Frontend/AssetsTest.php` | bootstrap prefix `t`; noscript hides `.ka11y-trigger`; device rules hide `.ka11y-trigger` |
| `Frontend/MarkupTest.php` | `data-ka11y-launcher` per mode; `hidden` attribute on the button in `hidden` mode; kses keeps both |
| `Triggers/ButtonTest.php` | output per action and element; ARIA per action; invalid action renders `''`; label escaping with `<script>`, quotes, 101 chars; class tokens; `show_icon`; not rendered when `should_render` is false; statement link; filter output re-filtered |
| `Triggers/ButtonShortcodeTest.php` | attribute mapping, `show_icon` truthy strings |
| `Triggers/BlockTest.php` | registration from `block.json`; render callback uses wrapper attributes; unknown attributes ignored |
| `FunctionsTest.php` | `kotlinskidev_a11y_get_button` returns, `kotlinskidev_a11y_button` echoes the same string |

### 11.2 Jest (`tests/js`)

| File | Cases |
| --- | --- |
| `shared/actions.test.ts` | shared fixture; levels `0`, `10`, `01`, `100`; `trigger` accepted |
| `bootstrap.test.ts` | delegated listener for each selector kind; `html[data-ka11y="error"]` click ignored; host click pushes `early` only before install; anchor and `data-ka11y` prevented, class not prevented; broken `t` selector falls back; `?ka11y=feature:x` pushed with `url`; `off` and `reset` not pushed |
| `loader/triggers.test.ts` | `resolveTrigger` order; `#ka11y/` at boot and on `hashchange` with URL rules and hash cleanup; open hash unchanged; Space on `a[role=button]` clicks once, Space on a plain link does nothing; ARIA scan sets missing attributes only; device gate drops dialog actions |
| `loader/queue.test.ts` | Phase 3 cases unchanged; `url` filtered by `u`; replay order across dialog and kernel actions |
| `loader/api.test.ts` | methods push with `api` source; `set` mapping; `toggle(target)`; `getState` loads kernel only; `on` and unsubscribe; late `on('ready')`; `ka11y:ready` once |
| `loader/launcher.test.ts` | `inline` moves the host and keeps the shadow root; missing mount falls back to `floating`; throwing selector falls back |
| `kernel/commands.test.ts` | feature toggle, set, clamp, disabled dropped, unknown dropped; profile toggle and URL apply; reset clears storage; `suspended` save semantics; `ka11y:change` detail and sources including `restore`; `aria-pressed` sync for key, key with level, profile |
| `panel.test.ts` | `ka11y:open` and `ka11y:close`; `aria-expanded` sync on light-DOM triggers |
| `a11y-dialog.test.ts` | focus return to opener, to the pre-open active element, to a visible launcher, to body when the launcher is hidden |
| `admin/snippets.test.ts` | each output for each action; escaping of `"`, `'`, `]`, `<` in labels; URL output only for URL-allowed actions |
| `admin/trigger-check.test.ts` | warning, error and fetch-failure states from fixture HTML |

### 11.3 Playwright (`tests/e2e/triggers.spec.ts`)

Fixture page created in `global-setup.ts` (or a fixture mu-plugin), with `widget.launcher = hidden`:

1. `<a href="#kotlinskidev-a11y">`
2. `<a href="#ka11y/profile:adhdFriendly">`
3. `<button class="ka11y-open">`
4. `<button data-ka11y="feature:darkContrast">`
5. `<a href="/statement" data-ka11y="toggle">` (link with real href, gets `role` and Space)
6. a custom-selector element (`.fixture-a11y-menu > a`) configured in settings
7. `[kotlinskidev_a11y_button action="open"]`
8. the block with `action="feature:biggerText:2"`
9. `kotlinskidev_a11y_button( array( 'action' => 'toggle' ) )` printed by the fixture theme in the footer
10. `<button id="api-open">` whose click runs `kotlinskidevA11y.open(this)`

Matrix: every case runs under each `performance.strategy` (`interaction`, `idle`, `defer`, `async`, `eager`), with the launcher hidden. `@smoke` runs `interaction` and `eager` only.

Per case:

- Mouse click and keyboard activation (Enter; Space for buttons and `role=button` links) produce the expected effect.
- Dialog triggers: `aria-expanded` is `true` while open and `false` after close; Escape returns focus to the trigger.
- Feature and profile triggers: `aria-pressed` matches; the root class appears; the state survives reload.
- No console errors, no serious axe issues on the page and on the open panel.

Extra cases:

- Pre-loader: `page.route` holds `loader.js` for 2 s, click cases 2, 4 and 7; each applies once after release.
- `?ka11y=profile:adhdFriendly` applies the profile, removes the parameter, and is gone after reload; after a following manual change in the panel, both are saved (D2).
- `?ka11y=feature:<disabled key>` does nothing; `?ka11y=reset` and `?ka11y=off` behave as in v0.2.
- `#ka11y/feature:biggerText:2` on landing applies level 2 and clears the hash.
- `widget.launcher = inline` with a mount in the fixture footer: the launcher renders inside it and opens the panel.
- `hidden` mode with the shortcut: `Alt+Shift+A` opens, closing returns focus to the previously focused element.
- Admin: Triggers tab saves all four settings; the snippet generator copies each output; the no-trigger warning shows for a page without triggers.

Manual, once before release: VoiceOver (Safari) and NVDA (Firefox) script covering cases 3, 4, 5 and 8: role, name, expanded or pressed state announced, focus return.

## 12. `docs/API.md` outline

1. Version and stability: `kotlinskidevA11y.api === 1`; what is public (this file) and what is internal (`trigger`, `load`, `chunks`, `data`, `hiddenMedia`, `kotlinskidevA11yRuntime`).
2. Quick start: one HTML button, one link, one shortcode.
3. Actions: grammar, table from 2.1, feature keys with level counts, profile keys, enabled-only rule.
4. Trigger surfaces: table from 3.2, resolution order from 3.1, ARIA added automatically and when it is not (late elements).
5. URL and hash actions: allowlist, not-saved rule, cleanup, `reset` and `off`.
6. JavaScript API: before load (queue), after load (methods), each method with types and examples.
7. Events: names, timing, `detail` types, a `ka11y:change` example.
8. Shortcode, block and PHP function: arguments, output, escaping guarantees.
9. Launcher modes and the keyboard shortcut.
10. PHP hooks: the three new filters plus the existing documented ones.
11. Security notes for integrators.
12. Deprecation policy.
13. Changelog of the API (per plugin version).

Deprecation policy:

- Additive changes (new action, event, method, field) ship in any minor release and do not bump `api`.
- A breaking change to anything in `docs/API.md` bumps `api` and ships in a minor release at the earliest.
- The previous behaviour stays for one more minor release, with one `console.warn('[kotlinskidev-a11y] deprecated: …')` per page view per item, a CHANGELOG `Deprecated` entry and a note in `docs/API.md`. It is removed in the next minor.
- Frozen contracts in section 1 are never changed without a major release.

## 13. Milestones

Agent names come from the kit: `kd-core:coder` (Sonnet), `kd-core:maker` (Haiku, every edit specified), `kd-core:thinker` (review only), `kd-web:security-reviewer`, `kd-web:accessibility-reviewer`. Each milestone runs the verify command plus the listed checks before handoff. Run one e2e suite against one wp-env at a time.

### M4.1 Shared action parser (kd-core:coder)

Depends on: none.

Files:
- `src/ts/shared/actions.ts`
- `src/ts/shared/types.ts` (`CommandSource` gains `trigger`, `url`; `PublicState`, `KotlinskidevA11yApi`, `ApiEventName`)
- `src/ts/loader/queue.ts` (import `ACTION_PATTERN`)
- `src/php/Frontend/Actions.php`
- `tests/fixtures/actions.json`
- `tests/js/shared/actions.test.ts`, `tests/php/Frontend/ActionsTest.php`

Acceptance: both test files pass on the shared fixture; Phase 3 `queue.test.ts` unchanged and green; `scripts.loader` gzip does not grow by more than 10 B.

Rollback: revert. Nothing consumes the new code yet.

### M4.2 Settings v3, sanitizer, migration, inline config (kd-core:coder)

Depends on: M4.1.

Files:
- `src/php/Settings/Schema.php`, `Sanitizer.php`, `Repository.php`
- `src/php/Frontend/InlineConfig.php`, `Assets.php` (prefix `t`, noscript, device rules)
- `tests/php/Settings/SchemaTest.php`, `SanitizerTest.php`, `RepositoryTest.php`
- `tests/php/Frontend/InlineConfigTest.php`, `AssetsTest.php`

Acceptance: 11.1 cases for these files; `composer run lint`, `composer run analyse`, `composer run test:unit` green; `GET /schema` in wp-env lists the four new definitions; inline config still at most 1536 B with maximum selectors.

Rollback: revert. A stored v3 option keeps working on v0.2.0 (7.3).

### M4.3 Bootstrap and loader triggers, API, budgets (kd-core:coder, then kd-core:thinker and kd-web:security-reviewer)

Depends on: M4.1, M4.2.

Files:
- `src/ts/bootstrap/index.ts`
- `src/ts/loader/index.ts`, `triggers.ts`, `queue.ts`, `open.ts`
- `src/ts/loader/api.ts` (new), `src/ts/loader/launcher.ts` (new, inline mount)
- `bin/budgets.json` (values from section 9 only)
- `tests/js/bootstrap.test.ts`, `tests/js/loader/triggers.test.ts`, `queue.test.ts`, `api.test.ts`, `launcher.test.ts`

Acceptance: 11.2 cases for these files; `npm run check-budget` green with the new limits and the measured numbers in the report; the Phase 3 loading e2e (`loading.spec.ts`) green under every strategy; `@smoke` green.

Kernel actions (`feature`, `profile`, `reset`) are routed to `kernel.run` behind an optional check (`typeof kernel.run === 'function'`), so this milestone works before M4.4 lands.

Rollback: revert. The bootstrap and loader are self-contained; the Phase 3 queue contract is unchanged.

### M4.4 Kernel commands, public state, change events, ARIA pressed (kd-core:coder)

Depends on: M4.3.

Files:
- `src/ts/frontend/kernel/commands.ts` (new)
- `src/ts/frontend/kernel/index.ts` (`run`, `state`, `getData` option, `suspended`)
- `src/ts/frontend/kernel/exports.ts` (only if a new shared helper must be exported)
- `tests/js/kernel/commands.test.ts`, `tests/js/kernel.test.ts`

Acceptance: 11.2 kernel cases; `scripts.kernel` at most 5632; manual check in wp-env that `?ka11y=profile:adhdFriendly` applies and is not saved.

Rollback: revert. The loader's optional check keeps dialog actions working.

### M4.5 Panel events, ARIA expanded, focus fallback, launcher modes markup (kd-core:coder, then kd-web:accessibility-reviewer)

Depends on: M4.3.

Files:
- `src/ts/frontend/panel.ts`, `src/ts/frontend/a11y-dialog.ts`, `src/ts/frontend/chunks/panel.ts`
- `src/php/Frontend/Markup.php`
- `src/scss/launcher/_state.scss`
- `tests/js/panel.test.ts`, `tests/js/a11y-dialog.test.ts`, `tests/php/Frontend/MarkupTest.php`

Acceptance: 11.1 and 11.2 cases for these files; `styles.launcher` at most 1400 raw; `scripts.panel` at most 7168 (or 7424 with a CHANGELOG reason); existing `panel.spec.ts` green.

Rollback: revert. `floating` mode is the default, so sites without the setting see no change.

### M4.6 Button renderer, shortcode, block, PHP functions (kd-core:coder, then kd-web:security-reviewer)

Depends on: M4.1, M4.2.

Files:
- `src/php/Triggers/Button.php`, `ButtonShortcode.php`, `Block.php` (new)
- `src/php/functions.php` (new), `kotlinskidev-accessibility.php` (require it), `src/php/Plugin.php` (register)
- `src/blocks/trigger/block.json`, `src/ts/blocks/trigger/index.ts` (new)
- `bin/build.mjs` (editor entry, copy `block.json`)
- `src/php/I18n/Strings.php` (trigger default labels)
- `tests/php/Triggers/ButtonTest.php`, `ButtonShortcodeTest.php`, `BlockTest.php`, `tests/php/FunctionsTest.php`

Acceptance: 11.1 cases; block inserts and renders in the editor in wp-env on minimum and latest WordPress; Navigation insertion per D6 verified or the documented fallback taken; Plugin Check has no new errors.

Rollback: revert. The shortcode and block simply stop rendering; saved block markup stays in posts as a dynamic block comment and renders nothing.

### M4.7 Admin Triggers tab, snippet generator, no-trigger warning (kd-core:coder, then kd-web:security-reviewer)

Depends on: M4.2, M4.6.

Files:
- `src/ts/admin/panels/triggers.ts` (new), `src/ts/admin/snippets.ts` (new), `src/ts/admin/trigger-check.ts` (new)
- `src/ts/admin/tabs.ts`, `src/ts/admin/app.ts` (register the tab)
- `src/scss/admin/_triggers.scss` (new), `src/scss/admin/index.scss`
- `src/php/Admin/SettingsPage.php` (localized `home_url`, strings)
- `tests/js/admin/snippets.test.ts`, `tests/js/admin/trigger-check.test.ts`

Acceptance: 11.2 admin cases; the Triggers tab saves and reloads all four settings; `admin.spec.ts` gains the three admin cases from 11.3 and is green.

Rollback: revert. Settings remain editable through REST and import.

### M4.8 E2E trigger matrix (kd-core:coder, then kd-core:thinker review)

Depends on: M4.3 to M4.7.

Files:
- `tests/e2e/triggers.spec.ts` (new)
- `tests/e2e/global-setup.ts`, `tests/e2e/fixtures/*` (fixture page, theme footer call, settings)
- `docs/TESTING.md` (new spec and its run time)

Acceptance: 11.3 passes on chromium; `@smoke` subset stays under 90 s; nightly runs the full matrix on WebKit and Firefox; manual screen reader script done and recorded in the PR.

Rollback: revert the spec file.

### M4.9 Docs, compat shim removal, translations (kd-core:coder for the shim, kd-core:maker for docs and strings)

Depends on: M4.8.

Files:
- `docs/API.md` (new, outline in section 12)
- `README.md` (triggers, launcher modes, shortcode, block, PHP function)
- `docs/ROADMAP.md` (Phase 4 status)
- `src/ts/frontend/kernel/index.ts` (remove `mergeLegacyConfig`), `src/php/Frontend/InlineConfig.php` (remove `kotlinskidev_a11y_legacy_config`) and their tests, per D3
- `languages/*` via `npm run i18n:pot`, `npm run i18n:json`, `bin/fix-i18n-json.mjs`; `pl_PL` strings for every new admin and front string
- `CHANGELOG.md` `[Unreleased]`

Acceptance: verify command green; `npm run check-budget` green; `docs/API.md` lists every public name in sections 2, 3 and 5 and nothing internal.

Rollback: revert the shim removal commit alone if a site reports breakage; the docs stay.

### M4.10 Release v0.3.0 (kd-core:maker)

Depends on: M4.9.

Steps: `npm run release`, `npm run check-version`, commit `chore: release v0.3.0`, tag `v0.3.0`, push only when the owner asks. No AI trailers.

Acceptance: the release workflow attaches `kotlinskidev-accessibility.zip`; the updater offers v0.3.0 on a v0.2.0 wp-env site; settings and visitor state survive the update.

Rollback: publish v0.3.1 from the v0.2.0 tree with a version bump; option v3 stays readable (7.3).

Parallel work: M4.4 and M4.5 can run in parallel after M4.3 (separate file sets). M4.6 can run in parallel with M4.3.

## 14. Risks

| Risk | Mitigation |
| --- | --- |
| Budget overrun after M4.3 | Section 9 fallback order; no further raise without the owner. |
| A permanent capture listener in `<head>` conflicts with page code that stops propagation | Capture phase on `document` runs before page handlers on targets; documented that `stopImmediatePropagation` on a `document` capture listener registered earlier can block triggers. |
| `preventDefault` on `data-ka11y` links when the loader fails | A failed mount clears its memoized promise (Phase 3 5.6), so the next click retries. Integrators who need a no-JS fallback use a link with a real `href` and no `data-ka11y`, or the `statement` action. |
| Custom selectors matching too much | Sanitizer bans `html`, `body`, `*`; admin preview counts matches on the home page and warns above 20. |
| `inline` mode layout shift | Help text; `hidden` plus a trigger is the zero-shift option. |
| URL actions used for nuisance links | Allowlist setting, not saved, enabled-only, removed from the address bar. Owners can turn URL actions off. |
| Navigation block support differs by WordPress version | D6 fallback. |
| Third-party code relying on the v0.2 compat shim | D3 removal is a separate commit and was announced in v0.2.0. |
