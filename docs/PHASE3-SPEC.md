# Phase 3 spec: loading and performance, v0.2.0

Status: approved design, ready for milestones. Source of truth for Phase 3. It replaces the Phase 3 section of `ROADMAP.md` where the two differ.

Rules for every milestone: strict TypeScript (no `any`), no comments anywhere (code, docblocks, phpcs ignores), WPCS PHP, no jQuery, all strings through i18n (`__()` in PHP, panel strings from `Strings.php`). The `pl_PL` translations are done in M3.11.

## 0. Targets and measured inputs

| Item | v0.1.3 (measured) | v0.2.0 target | Gate |
| --- | --- | --- | --- |
| JS on every page, visitor without saved state | 13.8 KB gzip (`frontend.js`) | loader at most 2048 B gzip | `bin/check-budget.mjs` |
| Render-blocking CSS, visitor without saved state | `frontend.css`, 1.6 KB gzip | 0 (Page CSS `lazy`) | Playwright `perf.spec.ts` |
| Inline config JSON | 7.9 KB | at most 1536 B | PHPUnit `InlineConfigTest` |
| Inline launcher CSS (shadow) | none, launcher unstyled before JS | at most 1400 B raw | `bin/check-budget.mjs` |
| Panel DOM | built at boot | built on first open | Jest + Playwright |
| OpenDyslexic 115 KB | only when on | unchanged | none |

Chunk size estimates (esbuild minify, gzip, measured on current sources):

| Candidate | Gzip |
| --- | --- |
| store, storage, apply, profiles, theme, hide-toolbar | 2.8 KB |
| panel + dialog + translate + widget CSS (1.8 KB) | 6.0 KB |
| content features | 3.6 KB |
| color features + exclusivity | 1.1 KB |
| orientation features | 2.8 KB |
| shortcut + hash-open | 0.7 KB |
| page CSS (`frontend.css`) | 1.6 KB |

## 1. Bundle architecture

### Decision

Classic-script chunks, injected as `<script>` elements with absolute URLs from config. No esbuild `splitting`, no ESM, no `import()`.

Why, in one line each:

- `import()` cannot carry a CSP nonce, and nonce-only policies without `strict-dynamic` block it. An injected `<script>` can copy the loader's nonce.
- esbuild ESM chunks import siblings by relative URL. Asset CleanUp moves files into `wp-content/cache/asset-cleanup/`, so relative imports break. `import.meta.url` is unreliable for the same reason.
- Optimizers handle `type="module"` inconsistently (delay, combine, strip). Classic scripts are what every optimizer understands.
- Classic scripts work in every browser that runs the widget today, so there is no "no dynamic import" fallback to maintain.

### Chunks

| Name | Entry | Contents | Loaded |
| --- | --- | --- | --- |
| `bootstrap` | `src/ts/bootstrap/index.ts` | recovery URLs, saved-state apply, lazy page CSS, hidden-toolbar flag, early click capture | inline in `<head>`, every page |
| `loader` | `src/ts/loader/index.ts` | command queue, triggers, strategy, device skip, chunk and data loading, retry, launcher states | `<script>` tag, every rendered page |
| `kernel` | `src/ts/frontend/kernel/index.ts` | store, storage, applier and registry, profiles, feature utils, dom, root, root-class, landmarks, any file shared by two chunks | on saved state, on first open, or by strategy |
| `panel` | `src/ts/frontend/chunks/panel.ts` | panel, a11y-dialog, translate, theme, hide-toolbar, feature-groups labels, panel CSS | on first open, prefetch, or by strategy |
| `content` | `src/ts/frontend/chunks/content.ts` | the 11 content features | on first use or saved state |
| `color` | `src/ts/frontend/chunks/color.ts` | the 5 color features, contrast exclusivity | on first use or saved state |
| `orientation` | `src/ts/frontend/chunks/orientation.ts` | the 10 orientation features | on first use or saved state |

Group chunks, not per-feature chunks: three requests at most, and a typical saved-state visitor downloads one 1 to 3.6 KB chunk instead of the 7.5 KB of all features. Per-feature chunks would mean 26 requests of 100 to 900 bytes, where gzip and request overhead dominate.

The groups are the `FEATURE_GROUPS` ids in `src/ts/frontend/feature-groups.ts`. That file stays the single source of the key-to-group map.

Rule: a source file is bundled into exactly one of `loader`, `kernel`, `panel`, `content`, `color`, `orientation`. If a file is imported by two non-kernel chunks, it moves to `KERNEL_FILES`. The build fails on a violation (section 1.3). Known moves: `dom.ts`, `root.ts`, `feature-utils.ts`, `features/color-orientation/root-class.ts`, `features/color-orientation/landmarks.ts`. `panel.ts` must import `findLandmarks` and `focusLandmark` from `./features/color-orientation/landmarks`, not from the group index. Otherwise the panel would bundle every orientation feature.

### 1.1 Runtime handoff (internal, not public)

```ts
export type ChunkName = 'kernel' | 'panel' | 'content' | 'color' | 'orientation';
export type GroupName = 'content' | 'color' | 'orientation';
export type ChunkFactory = (kernel: KernelExports | undefined) => unknown;
export type ChunkRecord = [name: ChunkName, abi: number, factory: ChunkFactory];

export interface ChunkSink {
  push(...records: ChunkRecord[]): number;
}

export interface RuntimeHandoff {
  s: string[];
  c: ChunkRecord[] | ChunkSink;
  e?: (event: MouseEvent) => void;
}

declare global {
  interface Window {
    kotlinskidevA11yRuntime?: RuntimeHandoff;
  }
}
```

- `s`: active feature keys from saved state, written by the bootstrap.
- `c`: chunk records. A chunk pushes into it whether or not the loader has run. The loader drains the array, then replaces `c` with a `ChunkSink` whose `push` registers at once. Script order therefore never matters, which is needed for `eager` (optimizers may reorder or combine tags).
- `e`: the bootstrap's early click listener, so the loader can remove it.
- `RUNTIME_ABI = 1`, a constant in `src/ts/shared/runtime.ts`. The loader ignores a record whose ABI differs and treats that chunk as failed.
- The loader evaluates `kernel` first, then calls every other factory with the kernel exports. A second record with the same name is ignored.

### 1.2 Chunk wrapper (emitted by the build)

Each non-loader chunk is built by esbuild with `format: 'iife'`, `globalName: '__ka11yExports'`. The build then wraps the output text:

```js
(window.kotlinskidevA11yRuntime=window.kotlinskidevA11yRuntime||{s:[],c:[]}).c.push(["panel",1,function(__ka11yKernel){<esbuild output>;return __ka11yExports}]);
```

In non-kernel chunks, a resolve plugin (`ka11y-kernel-external`) maps any import that resolves to a path in `KERNEL_FILES` to a virtual module `module.exports = __ka11yKernel;`. This is the same technique as the existing `wpExternalsPlugin`. The free identifier resolves to the factory parameter.

`src/ts/frontend/kernel/exports.ts` re-exports `*` from every file in `KERNEL_FILES`. Export names must be unique, and the build fails on a duplicate. `kernel/index.ts` re-exports `./exports` and adds `bootKernel`. The kernel factory returns that namespace, and `KernelExports` is `typeof import('./exports') & { bootKernel: typeof bootKernel }`.

The loader is built as a plain `iife` with no wrapper and no kernel external. It must not import any kernel file. The build checks this.

### 1.3 `bin/build.mjs` changes

New helper module `bin/lib-chunks.mjs` exports `KERNEL_FILES`, `kernelExternalPlugin`, `wrapChunk(name, code)`, `assertSingleOwnership(metafiles)`, `gzipSize(buffer)`, `writeManifest(entries)`.

Build steps, in order:

1. Compile SCSS: `page/index.scss` to `frontend.css`, `launcher/index.scss` to `launcher.css` (new), `widget/index.scss` to `widget.css` (panel only now), `admin/index.scss` to `admin.css`. Keep the scope check on `frontend.css`. Add `assertKsesSafeCss(launcherCss)`: throw if the CSS contains `<`, `>` or `&` (reason in section 2).
2. Build `bootstrap.js` (iife, as today).
3. Build `loader.js` (iife). Define `__KA11Y_GROUPS__` as JSON of `{ [featureKey]: GroupName }` generated from `FEATURE_GROUPS`. The build imports the TS file through a one-off esbuild bundle to a data module, or parses it with the same regex approach as `readFeatureKeys`. Coder's choice, but the map must come from `feature-groups.ts`.
4. Build `kernel.js`, `panel.js`, `content.js`, `color.js`, `orientation.js` with the wrapper. `panel.js` gets `__KA11Y_WIDGET_CSS__` = `widget.css`.
5. Run `assertSingleOwnership` over the six metafiles (`inputs` keys under `src/`). Fail with the offending file list.
6. Build `admin.js` and `alt-text.js` as today, still writing `admin.asset.php` and `alt-text.asset.php`.
7. Write `build/manifest.php` and `build/manifest.json` with identical data.

`frontend.js` and `frontend.asset.php` are no longer produced.

Manifest shape (`manifest.json`; `manifest.php` returns the same as a PHP array):

```json
{
  "abi": 1,
  "scripts": {
    "loader": { "file": "loader.js", "ver": "0123456789ab", "raw": 4200, "gzip": 1900 },
    "kernel": { "file": "kernel.js", "ver": "…", "raw": 0, "gzip": 0 },
    "panel": { "file": "panel.js", "ver": "…", "raw": 0, "gzip": 0 },
    "content": { "file": "content.js", "ver": "…", "raw": 0, "gzip": 0 },
    "color": { "file": "color.js", "ver": "…", "raw": 0, "gzip": 0 },
    "orientation": { "file": "orientation.js", "ver": "…", "raw": 0, "gzip": 0 }
  },
  "styles": {
    "page": { "file": "frontend.css", "ver": "…", "raw": 0, "gzip": 0 },
    "launcher": { "file": "launcher.css", "ver": "…", "raw": 0, "gzip": 0 }
  },
  "inline": {
    "bootstrap": { "file": "bootstrap.js", "ver": "…", "raw": 0, "gzip": 0 }
  }
}
```

- `ver` is the first 12 hex chars of the SHA-1 of the file content. It is used as `?ver=`.
- File names stay stable (no hash in the name). A stale cached HTML page then still finds every file, and all served files come from the same build. Hashed names would 404 after an update until the page cache is purged.
- Cache busting: URL `base + file + '?ver=' + ver`. The `kotlinskidev_a11y_cache_invalidated` `update` reason already tells page caches to purge.

### 1.4 Size budgets

`bin/budgets.json`:

```json
{
  "gzip": {
    "inline.bootstrap": 1024,
    "scripts.loader": 2048,
    "scripts.kernel": 3072,
    "scripts.panel": 7168,
    "scripts.content": 4096,
    "scripts.color": 1536,
    "scripts.orientation": 3584,
    "styles.page": 2048
  },
  "raw": {
    "styles.launcher": 1400
  },
  "sum": {
    "everyPage": { "gzip": 3072, "of": ["inline.bootstrap", "scripts.loader"] }
  }
}
```

`bin/check-budget.mjs`:

- Reads `build/manifest.json` and `bin/budgets.json`.
- Prints one row per entry: name, actual, limit, percent.
- Exits 1 when any value is over its limit or an entry is missing. Exits 2 when the manifest is missing.
- Exports `checkBudget(manifest, budgets): { rows: BudgetRow[]; failed: boolean }` for Jest.
- `package.json` script `"check-budget": "node bin/check-budget.mjs"`.
- CI `js` job: add `npm run check-budget` after `npm run build`.
- `CLAUDE.md` verify command: append `&& npm run check-budget`.

The inline config budget is enforced in PHPUnit (section 9), because it needs PHP to produce.

If the loader goes over 2048 B: first move the key-to-group map out of the loader into the kernel. That costs one extra round trip for saved-state visitors. Then drop the DSD polyfill (old browsers get the launcher only after `panel` loads).

## 2. Pre-interaction UX

### Decision

Declarative shadow DOM, with the launcher CSS inline inside the template.

Why: the launcher must look final before any JS, and only a shadow root isolates it from hostile theme CSS (`button { … !important }`). The same shadow root is reused after JS loads, so nothing restyles, moves or shifts. Light-DOM styles would need an ID-specificity reset war, lose to `!important`, and move the node into a shadow root later. That move is the current behaviour, and it is the source of the pre-JS mismatch.

Support: Chrome and Edge 111+, Safari 16.4+, Firefox 123+. Fallback: where `HTMLTemplateElement.prototype` has no `shadowRootMode`, or `host.shadowRoot` is null after parse (the template was inserted by `innerHTML`, for example by page-transition themes), the loader runs `attachShadow({ mode: 'open' })` and moves `template.content` into it. In those browsers the launcher is invisible until the loader runs (deferred, so at DOMContentLoaded).

### Markup (`Frontend/Markup.php`, `wp_footer`)

```html
<div id="ka11y-root" data-ka11y-position-desktop="bottom-right" data-ka11y-position-tablet="bottom-right" data-ka11y-position-mobile="bottom-right" data-ka11y-size="md" data-ka11y-icon-border="false"><template shadowrootmode="open"><style>LAUNCHER_CSS</style><button type="button" class="ka11y-launcher" aria-label="Open accessibility settings" aria-haspopup="dialog" aria-expanded="false">ICON</button></template></div>
```

Escaping. The output still goes through `wp_kses` with the allow-list extended by `template => array( 'shadowrootmode' => true )` and `style => array()`. `wp_kses` keeps the text content of `<style>`, but it rewrites stray `<`, `>` and `&`. The build therefore guarantees `launcher.css` contains none of them (`assertKsesSafeCss`): no child combinators, no `&` entities. This keeps phpcs clean without ignore comments, which the no-comments rule forbids. `LAUNCHER_CSS` is read from `build/launcher.css`. A missing file prints the template without the `<style>`.

### Launcher CSS (`src/scss/launcher/index.scss`, new)

`@use` order: `../widget/tokens`, `../widget/themes`, `../widget/launcher`, `state`.

- Move `:host`, `:host([hidden])` and `box-sizing` from `widget/index.scss` into `launcher/index.scss`. `widget/index.scss` keeps only `panel` and `toggles`, because tokens and launcher rules are already in the shadow root.
- New partial `src/scss/launcher/_state.scss`:
  - `:host([data-state='loading']) .ka11y-launcher::after`: a 2px ring with `animation: ka11y-spin 0.8s linear infinite`, `animation-delay: 300ms`, `opacity: 0` until the delay ends.
  - `@media (prefers-reduced-motion: reduce)`: static ring, no rotation.
  - `:host([data-state='error']) .ka11y-launcher::after`: a 14px badge showing `!` via `content: '!'`, with background `#b3261e` and white text.
  - No `>`, `<` or `&` anywhere.

### Inline in HTML (exhaustive)

| Where | What | Budget |
| --- | --- | --- |
| `<head>`, `wp_head` priority 1 | bootstrap script plus its prefix `window.kotlinskidevA11y={storage:…,css:…}` | 1024 B gzip for the code |
| `<head>` | `<style id="kotlinskidev-a11y-tokens-inline-css">`: `:root` tokens, device rules, `html[data-ka11y-hidden] #ka11y-root{display:none!important}`, document-level `customCss`; plus the page CSS when Page CSS is `inline` | tokens and device rules at about 700 B, unchanged |
| `<head>` | `<noscript><style>#ka11y-root{display:none!important}</style></noscript>` | 60 B |
| before the loader tag | inline config (section 3) | 1536 B raw |
| `wp_footer` | DSD markup above | launcher CSS 1400 B raw, plus about 450 B of markup and icon |

Everything else is fetched: kernel, panel, feature chunks, page CSS (in `lazy` mode), and the panel data JSON.

Document-level `customCss` moves from JS injection at boot to server output in the tokens style. It applies earlier than before. Shadow-level `customCss` (styling the panel or launcher inside the shadow root) arrives with the panel data and is appended to the shadow root when the panel mounts. Behaviour change: custom CSS that targets `.ka11y-launcher` inside the shadow root applies after first open. Launcher styling should use the `--ka11y-*` tokens. This goes in the CHANGELOG.

No-JS: the `<noscript>` style hides the launcher, which would be inert. The statement shortcode page stays reachable.

`?ka11y=off`: the bootstrap sets `kotlinskidevA11yOff` and also sets `html[data-ka11y-hidden]`, so the inert launcher is hidden too.

## 3. Strings and i18n delivery

### Decision

A static JSON file per locale in uploads, with a public REST GET fallback.

| Option | Verdict |
| --- | --- |
| Static JSON in uploads | Chosen. Served by the web server or CDN, so no WordPress boot. Immune to Asset CleanUp (it is not a script or style). `connect-src 'self'` covers it. Identical for all visitors, so page-cache safe. |
| REST GET only | Fallback only. Each uncached hit boots WordPress (100 to 300 ms), and security plugins often block anonymous REST. |
| Per-locale script | Rejected. It has the same file-generation problem as JSON, plus `script-src` and optimizer exposure. |

### What stays inline vs fetched

Inline config (`window.kotlinskidevA11y`, printed before the loader):

```json
{
  "v": "0.2.0",
  "locale": "en_US",
  "rtl": false,
  "storage": { "mode": "local", "ttlDays": 365, "key": "ka11y" },
  "shortcut": {
    "enabled": true,
    "combo": "Alt+Shift+A",
    "parsed": { "alt": true, "shift": true, "ctrl": false, "meta": false, "key": "a", "code": "KeyA" }
  },
  "load": { "strategy": "interaction", "prefetch": "hover", "pageCss": "lazy", "deviceSkip": true },
  "hiddenMedia": "",
  "chunks": {
    "base": "https://example.test/wp-content/plugins/kotlinskidev-accessibility/build/",
    "ver": { "kernel": "…", "panel": "…", "content": "…", "color": "…", "orientation": "…", "page": "…" }
  },
  "data": [
    "https://example.test/wp-content/uploads/kotlinskidev-a11y/panel-en_US-0123456789ab.json",
    "https://example.test/wp-json/kotlinskidev-a11y/v1/panel-data?locale=en_US&v=0123456789ab"
  ],
  "strings": { "open": "Open accessibility settings", "loadError": "Accessibility tools could not load. Select the button to try again." },
  "advanced": { "excludeSelectors": "#wpadminbar" },
  "assets": { "dyslexicFontUrl": "https://example.test/wp-content/plugins/kotlinskidev-accessibility/assets/fonts/opendyslexic-regular.woff2" }
}
```

- `hiddenMedia` is the comma-joined media queries of devices where `visibility.devices.<d>` is false (same queries as `Assets::device_rules`), or `''`.
- `shortcut.parsed` is computed in PHP (`Frontend\InlineConfig::parse_combo`, a port of `parseCombo`), or `null`. The loader only runs `matchesCombo`.
- `advanced` and `assets` stay inline: saved-state content features (exclusions, dyslexic font) need them before the panel data exists.

Panel data JSON (`PanelData`), fetched with the panel:

```ts
export interface PanelData {
  hash: string;
  locale: string;
  features: Record<string, FeatureConfig>;
  profiles: Record<string, ProfileConfig>;
  widget: WidgetConfig;
  theme: ThemeConfig;
  tokens: TokensConfig;
  hideToolbar: HideToolbarConfig;
  statementUrl: string;
  customCss: string;
  strings: Record<string, string>;
}
```

`strings` is the full `Strings::for_locale( $locale )` output: defaults, plus `labels[locale]` overrides, plus the `kotlinskidev_a11y_strings` filter. `loadError` is added to `Strings::defaults()` as a new key.

### PHP

`src/php/Frontend/PanelData.php`:

- `payload( string $locale ): array` returns the `PanelData` array.
- `encode( array $payload ): string` uses `wp_json_encode` with `JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE`, without `hash`.
- `hash( string $json ): string` returns the first 12 chars of `sha1( $json . KOTLINSKIDEV_A11Y_VERSION . Schema::VERSION )`.

`src/php/Frontend/PanelDataStore.php`:

- Option `kotlinskidev_a11y_panel_data`, autoload true. Shape: `array<locale, array{hash: string, file: string, inline: array{open: string, loadError: string}, failed_at: int}>`. `file` is `''` when writing failed.
- `entry( string $locale ): array` returns the cached entry or builds it:
  1. Compute the payload and hash.
  2. Write the file. Directory: `wp_upload_dir()['basedir'] . '/kotlinskidev-a11y/'`, created with `wp_mkdir_p`, with an empty `index.php` (`<?php` only).
  3. File: `panel-{locale}-{hash}.json`, where the locale must match the Sanitizer locale pattern. The JSON contains `hash`.
  4. Write with `WP_Filesystem` only when `get_filesystem_method() === 'direct'`, otherwise skip.
  5. Skip writing while `failed_at` is within 3600 s.
- `urls( string $locale ): array{0: string, 1: string}` returns `[ file_url_or_rest, rest ]`:
  - `file_url` = `wp_upload_dir()['baseurl'] . '/kotlinskidev-a11y/' . file`.
  - `rest` = `add_query_arg( array( 'locale' => $locale, 'v' => $hash ), rest_url( 'kotlinskidev-a11y/v1/panel-data' ) )`.
  - If `file === ''`, both entries are the REST URL.
- `invalidate(): void` deletes the option and every `panel-*.json` in the directory (glob, `wp_delete_file`).
- `register(): void`:
  - `add_action( 'kotlinskidev_a11y_cache_invalidated', array( $this, 'invalidate' ) )`.
  - `add_action( 'upgrader_process_complete', array( $this, 'on_upgrade' ), 10, 2 )`. When `$options['type'] === 'translation'`, it runs `do_action( 'kotlinskidev_a11y_cache_invalidated', 'translations' )`. This is a new reason value; README documents it.
- Entries are built only for the locale resolved on a front-end render, never from REST input. This bounds file creation.

`src/php/Rest/PanelDataController.php`: `GET kotlinskidev-a11y/v1/panel-data`.

- `permission_callback` `__return_true`.
- Args: `locale` (required, string, validated against the Sanitizer locale pattern) and `v` (optional, `^[0-9a-f]{12}$`).
- It builds the payload in memory and never writes files.
- Header `Cache-Control: public, max-age=31536000, immutable` when `v` equals the current hash, otherwise `public, max-age=600`.
- Also sends `X-Content-Type-Options: nosniff`.

The `kotlinskidev_a11y_strings` filter runs when an entry is built, not per request. A filter whose output depends on the request must call `do_action( 'kotlinskidev_a11y_cache_invalidated', 'strings' )` when its output changes. Document this in the README hooks table.

### Client

The loader fetches `data[0]` with `fetch(url, { credentials: 'same-origin' })` and expects `res.ok` and JSON. On failure it fetches `data[1]`. If both fail, the data load fails (section 5.6).

Multilingual: the locale is resolved server-side (Polylang, WPML, TranslatePress, `determine_locale`) and inlined. The JSON file is per locale, and page caches already vary by language. Uploads served from a CDN host by an offload plugin answer 404 or fail CORS, and the REST fallback covers that.

## 4. Saved-state path

Visitors with saved state see features applied before first paint, under every strategy.

### Bootstrap (inline, `<head>`, priority 1)

Prefix printed by PHP: `window.kotlinskidevA11y={storage:{…},css:"<url>"|null,hk:"ka11y-hidden"};`. `css` is the page CSS URL with `?ver=` only when Page CSS is `lazy`, otherwise `null`.

Steps:

1. Create `window.kotlinskidevA11yRuntime = { s: [], c: [] }`, unless it exists.
2. `?ka11y=off`: set `kotlinskidevA11yOff = true`, set the attribute `data-ka11y-hidden` on `<html>`, stop.
3. `?ka11y=reset`: clear the cookie and localStorage as today, and continue without state.
4. Hidden toolbar: if `sessionStorage[hk] === '1'` or `Number(localStorage[hk]) > Date.now()`, set `html[data-ka11y-hidden]`.
5. Saved state: parse it as today. If valid, apply classes and vars as today, and set `runtime.s` to the level keys whose value is not `false` and not `0`.
6. If `runtime.s.length > 0` and `css` is set:
   - When `document.readyState === 'loading'`: `document.write('<link rel="stylesheet" id="kotlinskidev-a11y-frontend-css" href="' + css + '">')`. A parser-inserted stylesheet is render-blocking, so there is no flash.
   - Otherwise append a `link` element with the same id (an optimizer delayed the bootstrap; `document.write` after load would wipe the page).
   - The URL is JSON-encoded by PHP and contains no quotes.
7. Early click capture: `document.addEventListener('click', e, true)`. When the target is inside `#ka11y-root`, or is `a[href="#kotlinskidev-a11y"]`, `e` calls `preventDefault()` for anchors and pushes `{ action: 'open', source: 'early' }` onto `window.kotlinskidevA11yQueue` (created if missing). Store `e` as `runtime.e`.
8. Wrap everything in `try/catch`. On error, set `document.documentElement.dataset.ka11y = 'error'` as today.

### Loader on saved state

If `runtime.s.length > 0`, the loader at once, regardless of `load.strategy` and device visibility:

- loads `kernel` and the group chunks of `s` (through the `__KA11Y_GROUPS__` map, deduplicated, in parallel);
- calls `bootKernel`, which restores the store from storage and registers the group features. The applier then runs `on(level)` for JS features (cognitive reading, text magnifier, read page, reading mask and line, dyslexic font, filters, mute, stop animations…).

This runs when the loader executes (defer, at DOMContentLoaded), the same moment `frontend.js` ran in v0.1. Visible CSS state is already applied by the bootstrap.

Device skip does not block saved state. A visitor's saved accessibility needs must not drop silently when the viewport crosses a breakpoint. The cost lands only on visitors who opted in, and `?ka11y=reset` stays available.

### Page CSS setting `performance.pageCss`

| Mode | Server output | Visitor without saved state | Visitor with saved state |
| --- | --- | --- | --- |
| `lazy` (default) | No `<link>`. Bootstrap prefix carries `css`. | Nothing until needed. The kernel's `ensurePageCss()` appends `<link id="kotlinskidev-a11y-frontend-css">` when the panel mounts and whenever the store gets its first `ka11y-*` class. | Bootstrap writes a render-blocking `<link>` before first paint. |
| `linked` | `wp_enqueue_style( 'kotlinskidev-a11y-frontend', …/frontend.css, ver )`, render-blocking, can be combined by optimizers | 1 render-blocking request (v0.1 behaviour) | same |
| `inline` | `frontend.css` contents appended to the tokens inline style in `<head>` | +6 KB HTML, 0 requests | same |

`ensurePageCss()` is a no-op when an element with id `kotlinskidev-a11y-frontend-css` exists or `load.pageCss !== 'lazy'`.

## 5. Load strategies

### 5.1 Script tags

| Strategy | Loader tag | Extra tags | After loader runs (no saved state) |
| --- | --- | --- | --- |
| `interaction` (default) | `defer` | none | Nothing until an intent or command (5.2). Prefetch per `prefetch`. |
| `idle` | `defer` | none | After the `load` event, `requestIdleCallback(warm, { timeout: 3000 })`, or `setTimeout(warm, 1500)` when rIC is missing. |
| `defer` | `defer` | none | `warm()` at once. |
| `async` | `async` | none | `warm()` at once. |
| `eager` | `defer` | `kernel`, `panel`, `content`, `color`, `orientation` enqueued as normal `defer` scripts in the same position | Registers chunks as they arrive. If a chunk is not registered within 10 s of `DOMContentLoaded`, the loader injects it (optimizer removed the tag). |

`warm()` loads `kernel` and `panel` and fetches the panel data. It never builds panel DOM. Under every strategy, the panel DOM is built on the first `open` or `toggle` command.

Handles: `kotlinskidev-a11y-loader` and `kotlinskidev-a11y-{kernel|panel|content|color|orientation}`. None declares a dependency (order-independent by design). The inline config is `wp_add_inline_script( loader, config, 'before' )`.

Position `performance.position` `head|footer`: the `in_footer` arg of every tag above. Default `footer`. `head` with `defer` lets the download start earlier on long pages.

Fetch priority `performance.fetchPriority` `low|auto|high`, default `low`:

- WordPress 6.9 or later (`version_compare( $GLOBALS['wp_version'], '6.9', '>=' )`): pass `'fetchpriority' => $value` in the `wp_register_script` args when the value is not `auto`.
- Older versions: `script_loader_tag` filter for our handles only. It edits the tag with `WP_HTML_Tag_Processor` (`next_tag( 'script' )`, `set_attribute( 'fetchpriority', $value )`). That is attribute-safe, with no regex.
- Injected chunks: `script.fetchPriority = 'high'` when the load was triggered by a user command, `'low'` for prefetch, idle and warm.

### 5.2 Triggers (loader)

Bound only when the widget is visible on the current device, or `deviceSkip` is false. With `deviceSkip`, the loader listens to `matchMedia(hiddenMedia)` `change` and binds when the device becomes visible.

| Trigger | Listener | Effect |
| --- | --- | --- |
| Launcher activation | `click` on host (Enter and Space on the button produce click) | push `{ action: 'toggle', source: 'launcher', opener: launcher }` |
| Launcher intent | `pointerenter` (when `pointerType !== 'touch'`), `focusin`, `touchstart` (`{ passive: true }`) on host, once | `prefetch()` when `load.prefetch === 'hover'` |
| Hash | `hashchange` on window; `location.hash` at boot; capture-phase `click` on `a[href="#kotlinskidev-a11y"]` (preventDefault) | `show()` the hidden toolbar, then push `{ action: 'open', source: 'hash' }` |
| Shortcut | `keydown` on document with `matchesCombo(config.shortcut.parsed, event)` | `preventDefault()`. If the toolbar is not hidden, push `{ action: 'toggle', source: 'shortcut' }`. |
| Prefetch idle | `load.prefetch === 'idle'` and strategy `interaction` | after `load` plus rIC (timeout 3000): `prefetch()` |

- `prefetch()` loads `panel` and `kernel` with low priority and fetches the panel data. It builds no DOM.
- `show()` removes the `data-ka11y-hidden` attribute, sets `host.hidden = false`, and removes `sessionStorage[hk]` and `localStorage[hk]`.
- At install, the loader removes `runtime.e` (the bootstrap capture listener).

### 5.3 Command queue (contract for Phase 4)

```ts
export type CommandSource = 'early' | 'launcher' | 'hash' | 'shortcut' | 'api';

export interface KA11yCommand {
  action: string;
  source?: CommandSource;
  opener?: HTMLElement | null;
}

export interface KA11yQueue {
  push(...commands: KA11yCommand[]): number;
}

declare global {
  interface Window {
    kotlinskidevA11yQueue?: KA11yCommand[] | KA11yQueue;
  }
}
```

- The global is separate from `window.kotlinskidevA11y`, because the inline config assignment would overwrite a queue stored on it.
- Before the loader, anyone may run `(window.kotlinskidevA11yQueue = window.kotlinskidevA11yQueue || []).push({ action: 'open' })`.
- Loader install drains the array in order, then replaces the global with a `KA11yQueue` whose `push` dispatches at once. The pattern is the same as `googletag.cmd`.
- Action grammar: `name` or `name:arg` or `name:arg:arg`, matching `^[a-z][a-zA-Z0-9]*(?::[a-zA-Z0-9_-]+){0,2}$`. Anything else is dropped.
- Phase 3 handles `open`, `close` and `toggle`. Unknown valid actions are dropped silently.
- Phase 4 adds handlers to the loader's `handlers: Record<string, (command: KA11yCommand) => void>` map and adds `kotlinskidevA11y.open()` and the other methods as thin `push` wrappers. Nothing in this shape changes.
- Replay: commands that arrive before `kernel` and `panel` are ready wait in an in-memory FIFO. Each one is applied in order once ready, so `open` then `close` ends closed. Two consecutive `toggle` commands from the same source within 50 ms collapse to one (double-click guard).

### 5.4 Opening flow

On `open` or `toggle` when the panel is not mounted:

1. Set `host.dataset.state = 'loading'`.
2. Run in parallel: `load('kernel')`, `load('panel')`, `fetchData()`, `kernel.ensurePageCss()` (after the kernel).
3. Boot the kernel if not booted.
4. Call `panelExports.mount({ kernel, config: { ...inline, ...data }, data, host, shadow, opener })`. It returns `{ dialog }`.
5. Delete `host.dataset.state`.
6. Replay the queue: `open` calls `dialog.open()`, `close` calls `dialog.close()`, `toggle` calls `dialog.toggle()`. Focus returns to `opener` on close (existing dialog behaviour, with the launcher as default).

### 5.5 Feature on first use

`bootKernel` subscribes to the store. When a level becomes active for a key whose group is not loaded, it calls `options.loadGroup(group)`. The CSS class is already on `<html>` through the applier class sync, so CSS-only effects are instant. The JS part runs when the chunk registers: `kernel.addFeatures` then `applier.sync`.

### 5.6 Failure handling

`load(name)`:

1. Inject `<script src="base+file?ver=X">` with `async = false` and the nonce copied from the loader (`document.currentScript.nonce`, captured at loader evaluation).
2. Resolve when the record registers.
3. `onerror` or 15 s timeout: remove the element, wait 1000 ms, retry once with `&retry=1`.
4. A second failure rejects.
5. Promises are memoized per chunk. A rejected promise is cleared, so the next user command retries.

`fetchData()`: `data[0]`, then `data[1]`, then reject. Memoized the same way.

On a rejected user-initiated open:

- `host.dataset.state = 'error'`;
- the launcher `aria-label` is set to `strings.loadError`;
- `console.warn('[kotlinskidev-a11y]', name)`.

The next launcher click restores `aria-label` to `strings.open`, sets `loading` and retries the whole flow. Prefetch, idle and warm failures are silent; they only clear the memo.

### 5.7 Optimizer opt-out `performance.optOut`

An `enum_list`. Each value maps to attributes added to the bootstrap inline script, the config inline script, the loader tag and the eager chunk tags:

| Value | Attributes |
| --- | --- |
| `cloudflare` | `data-cfasync="false"` |
| `wp-rocket` | `nowprocket` (boolean) |
| `litespeed` | `data-no-optimize="1"`, `data-no-defer="1"`, `data-no-minify="1"` |
| `jetpack-boost` | `data-jetpack-boost="ignore"` |
| `asset-cleanup` | `data-wpacu-skip` (boolean) |

- The map is a PHP const `ScriptAttributes::OPT_OUT`. Adding an optimizer is a one-line change plus the Schema enum.
- Inline scripts get the attributes through the `wp_inline_script_attributes` filter. Match `id` in `kotlinskidev-a11y-bootstrap` and `kotlinskidev-a11y-loader-js-before`.
- Script tags get them through the same `script_loader_tag` plus `WP_HTML_Tag_Processor` path as fetch priority.
- The loader copies only `nonce` and `data-cfasync` onto injected chunks.
- M3.7 must check each attribute name against the optimizer's current docs. Correct the const if a name differs, and record the source URL in the PR description (not in code).

## 6. Where to load

### Visibility modes

New keys (section 7). `Visibility::is_excluded_by_settings()` becomes `is_blocked_by_settings()`:

| `visibility.mode` | Renders when |
| --- | --- |
| `everywhere` | always; lists are ignored but kept |
| `only_on` | any `include*` list matches |
| `except_on` | no `exclude*` list matches |

- Matchers are the existing post ID, post type, role and URL matchers, applied to `include*` or `exclude*`, plus a new template matcher.
- Roles: logged-out visitors match the pseudo-role `__guest`.
- Templates: the current identifiers are:
  - `get_page_template_slug( get_queried_object_id() )` when singular and non-empty (for example `templates/full-width.php`);
  - the block template slug when `$GLOBALS['_wp_current_template_id']` is a string (the part after `//`, for example `single`, `page`, `front-page`).

  A template entry matches when it equals any identifier (case-insensitive).
- The `kotlinskidev_a11y_should_render` filter still wraps the result.
- Role rules depend on the visitor. Page caches normally skip logged-in users, but role rules are not safe for logged-out variants. The admin help text says so.

### Migration of existing options

See section 7.3. Sites with non-empty `exclude*` lists get `except_on`, so behaviour is unchanged.

### Device skip `performance.deviceSkip` (default true)

When the widget is hidden on the current device (`matchMedia(hiddenMedia).matches`), the loader binds no triggers, warms nothing and prefetches nothing. Only the saved-state path runs (section 4). When false, it behaves as if visible (v0.1 behaviour: downloads, but the CSS hides the host). The server output stays identical for every visitor. The decision happens in the browser, so it is cache safe.

## 7. Settings

### 7.1 Schema additions (`Schema::VERSION = 2`)

| Path | Type | Sanitize | Default | Enum or limits |
| --- | --- | --- | --- | --- |
| `performance.preset` | string | enum | `recommended` | `recommended`, `compatibility`, `custom` |
| `performance.strategy` | string | enum | `interaction` | `interaction`, `idle`, `defer`, `async`, `eager` |
| `performance.position` | string | enum | `footer` | `head`, `footer` |
| `performance.fetchPriority` | string | enum | `low` | `low`, `auto`, `high` |
| `performance.prefetch` | string | enum | `hover` | `none`, `hover`, `idle` |
| `performance.pageCss` | string | enum | `lazy` | `lazy`, `linked`, `inline` |
| `performance.deviceSkip` | boolean | bool | `true` | none |
| `performance.optOut` | array | enum_list | `[]` | `cloudflare`, `wp-rocket`, `litespeed`, `jetpack-boost`, `asset-cleanup` |
| `visibility.mode` | string | enum | `everywhere` | `everywhere`, `only_on`, `except_on` |
| `visibility.includePostIds` | array | int_list | `[]` | min 1, max `PHP_INT_MAX` |
| `visibility.includePostTypes` | array | text_list | `[]` | none |
| `visibility.includeTemplates` | array | text_list | `[]` | none |
| `visibility.includeRoles` | array | text_list | `[]` | none |
| `visibility.includeUrlPatterns` | array | text_list | `[]` | none |
| `visibility.excludeTemplates` | array | text_list | `[]` | none |

Removed: `advanced.loadStrategy`. Delete `loadStrategyLabel` from `src/ts/admin/labels.ts` and the select from `panels/behavior.ts`.

### 7.2 Presets

`Schema::PERFORMANCE_PRESETS`:

| Key | `recommended` | `compatibility` |
| --- | --- | --- |
| strategy | `interaction` | `eager` |
| position | `footer` | `footer` |
| fetchPriority | `low` | `auto` |
| prefetch | `hover` | `none` |
| pageCss | `lazy` | `linked` |
| deviceSkip | `true` | `false` |
| optOut | `[]` | all five values |

`custom` stores whatever the fields hold.

`Schema::apply_performance_preset( array $tree ): array`: when `performance.preset` is not `custom`, it overwrites the seven keys with the preset row. It is called at the end of `Sanitizer::sanitize()` and in `Repository::get()` after the merge, so preset rows can change in later releases without a migration.

REST schema impact (additive only): `GET /schema` adds `'presets' => Schema::performance_presets()`. New definitions appear automatically. `SchemaPayload` in `src/ts/admin/types.ts` gets `presets: Record<string, Record<string, unknown>>`.

### 7.3 Migration v1 to v2 (`Repository::migrations()[1]`)

Input: the stored array (only when stored `schemaVersion` is below 2).

1. If `isset( $stored['advanced']['loadStrategy'] )`:
   - `$stored['performance'] = array( 'preset' => 'custom', 'strategy' => in_array( $legacy, array( 'defer', 'idle' ), true ) ? $legacy : 'defer', 'position' => 'footer', 'fetchPriority' => 'auto', 'prefetch' => 'hover', 'pageCss' => 'linked', 'deviceSkip' => true, 'optOut' => array() )`;
   - then `unset( $stored['advanced']['loadStrategy'] )`.

   The behaviour matches v0.1 (JS loaded at load or idle, CSS render-blocking). Only `deviceSkip` is a pure saving.
2. `$stored['visibility']['mode']` = `except_on` if any of `excludePostIds`, `excludePostTypes`, `excludeRoles` or `excludeUrlPatterns` is a non-empty array, otherwise `everywhere`.
3. Return `$stored`. The existing loop sets `schemaVersion` to 2.

An option that was never saved has no `advanced.loadStrategy`, so it gets the Recommended defaults.

Upgrade notice (`src/php/Admin/PerformanceNotice.php`): on `admin_notices`, for users with the plugin capability, when `performance.preset === 'custom'`, `strategy` is `defer` or `idle`, `pageCss === 'linked'`, and user meta `kotlinskidev_a11y_perf_notice_dismissed` is empty. It shows a dismissible notice: "Accessibility: switch to the Recommended performance preset to load less JavaScript on every page." with a link to `options-general.php?page=kotlinskidev-accessibility#performance`. Dismissal is a nonce-checked `admin-post.php?action=kotlinskidev_a11y_dismiss_perf_notice` that sets the user meta.

Downgrade to v0.1.x is safe. v0.1 ignores the unknown keys, falls back to `loadStrategy` `defer`, and still honours the `exclude*` lists. `only_on` is not understood, so the widget renders everywhere. The README states this.

### 7.4 Admin Performance tab

New panel `src/ts/admin/panels/performance.ts`, tab `{ id: 'performance', label: __('Performance') }`, inserted after `behavior` in `panelSpecs()`. It uses only the existing field kinds:

1. Fieldset "Preset": `createSelectField` `performance.preset`. Help: "Recommended loads the least JavaScript. Compatibility loads everything at once for sites whose optimizers break on-demand loading. Custom lets you set each option."
2. Fieldset "Loading": selects `performance.strategy`, `performance.position`, `performance.fetchPriority`, `performance.prefetch`.
3. Fieldset "Styles": select `performance.pageCss`.
4. Fieldset "Devices": toggle `performance.deviceSkip`, label "Skip downloads on devices where the widget is hidden".
5. Fieldset "Optimizers": `createChecklistField` `performance.optOut`, label "Exclude the widget scripts from".
6. Fieldset "Cost per page": readout (7.5).

Preset behaviour:

- `state.subscribe` watches `performance.preset`. When it changes to `recommended` or `compatibility`, the panel writes that preset's seven values from `ctx.schema.presets` into the state, then calls `ctx.reload()`.
- When any of the seven keys changes while the preset is not `custom`, and the values no longer equal the preset row, the panel sets `performance.preset` to `custom`.
- The server enforces presets anyway.

Labels: add `presetLabel`, `strategyLabel`, `positionLabel`, `fetchPriorityLabel`, `prefetchLabel`, `pageCssLabel`, `optOutLabel` and `visibilityModeLabel` to `labels.ts`, all through `__()`.

Visibility tab:

- New select `visibility.mode` at the top.
- Fieldset "Only on" (`include*` five lists) is hidden unless the mode is `only_on`.
- Fieldset "Except on" (the existing four lists plus `excludeTemplates`) is hidden unless the mode is `except_on`.
- A mode change calls `ctx.reload()`.
- Template help: "Template slugs such as single, page or front-page, or a page template file such as templates/full-width.php."
- Roles help mentions `__guest` and the page-cache caveat.

### 7.5 Cost per page readout

Data: `SettingsPage::config()` adds:

```php
'cost' => array(
	'manifest'  => Manifest::data(),
	'panelData' => strlen( gzencode( PanelData::encode( payload( get_locale() ) ) ) ),
	'config'    => strlen( InlineConfig::script( current settings ) ),
)
```

When `gzencode` is missing, use `strlen(json) / 3` rounded.

Pure function in `src/ts/admin/cost.ts`:

```ts
export interface CostRow {
  scenario: 'everyPage' | 'firstOpen' | 'savedState';
  requests: number;
  gzipBytes: number;
  htmlBytes: number;
  renderBlocking: boolean;
}

export const costPerPage = (cost: AdminCost, performance: PerformanceSettings): CostRow[] => [];
```

Rules (`g(x)` = manifest gzip of x; `avgGroup` = mean of the content, color and orientation gzip sizes):

- `everyPage`:
  - requests `1` (loader) plus `5` if eager plus `1` if `pageCss === 'linked'`;
  - gzip `g(loader)`, plus kernel, panel and the three groups if eager, plus `g(page)` if linked;
  - html = config raw + `g(bootstrap)`, plus page raw if `pageCss === 'inline'`;
  - `renderBlocking` = `pageCss === 'linked'`.
- `firstOpen` (added on first open): eager gives `0` requests and the data size. Otherwise kernel and panel are counted only when the strategy is `interaction`, or prefetch is not `none`; the data is always counted, and page CSS is added when lazy.
- `savedState` (added for a visitor with saved state): kernel plus `avgGroup`, plus page CSS when lazy. That stylesheet is render-blocking for this scenario: `renderBlocking: pageCss !== 'inline'`.

Render as a `<table>` with caption "Estimated cost per page view", header columns Scenario, Requests, Transfer (KB, one decimal), Inline HTML (KB) and Blocks rendering (Yes or No). It re-renders on every `state.subscribe` call. All labels go through `__()`.

## 8. Frozen contracts

Unchanged in this phase:

- Option `kotlinskidev_a11y_settings`, REST namespace `kotlinskidev-a11y/v1` (new route `/panel-data` is additive), capability filter.
- `#ka11y-root` (still the host, now with a DSD template), open hash `#kotlinskidev-a11y`, storage key `ka11y` and the `SavedState` format, `?ka11y=reset|off`, `window.kotlinskidevA11yOff`.
- Filters and actions: `kotlinskidev_a11y_should_render`, `kotlinskidev_a11y_current_locale`, `kotlinskidev_a11y_strings` (runs at entry build time), `kotlinskidev_a11y_update_source`, `kotlinskidev_a11y_update_token`, `kotlinskidev_a11y_cache_invalidated` (new reasons `translations` and `strings`, additive).
- Update slug, release asset name.

`window.kotlinskidevA11y` fields:

| Field | v0.2.0 |
| --- | --- |
| `v`, `locale`, `rtl`, `storage`, `shortcut` (`enabled`, `combo`; `parsed` added), `advanced`, `assets` | inline, unchanged |
| `strings` | inline, partial (`open`, `loadError`), filled with the full map after the panel data loads |
| `features`, `profiles`, `widget`, `theme`, `tokens`, `hideToolbar`, `statementUrl`, `customCss` | moved to the panel data, merged back after load |
| `load`, `hiddenMedia`, `chunks`, `data` | new, internal, may change without notice |

Compat shim for one minor (removed in v0.3.0):

1. After the panel data loads, the kernel `attachData` runs `Object.assign(window.kotlinskidevA11y, movedFields)`. `strings` is merged key by key.
2. New filter `kotlinskidev_a11y_legacy_config` (bool, default false). When true, `InlineConfig` also inlines every moved field and the full `strings` map, exactly as v0.1, and skips the 1536 B budget. It is for sites with third-party code that reads those fields at load.
3. CHANGELOG `Deprecated` entry, and a README note.

Phase 4 public API: out of scope. The only contract is `window.kotlinskidevA11yQueue` (5.3), and Phase 4 extends its handler map.

## 9. Test plan

### 9.1 PHPUnit (`tests/php`, Brain Monkey)

| File | Cases |
| --- | --- |
| `Settings/SchemaTest.php` | version 2; every new key with default and enum; `advanced.loadStrategy` absent; `performance_presets()` rows equal 7.2; `apply_performance_preset` overwrites for recommended and compatibility, keeps custom |
| `Settings/SanitizerTest.php` | invalid enums fall back; `optOut` drops unknown and duplicate values; preset recommended with a posted `strategy: eager` saves `interaction` |
| `Settings/RepositoryTest.php` | v1 with `loadStrategy` `idle` becomes custom/idle/linked/auto/hover/deviceSkip true; v1 `defer` becomes custom/defer; v1 with no `advanced` gets defaults; non-empty `excludeRoles` gives `except_on`; empty lists give `everywhere`; `schemaVersion` 2; `get()` applies the preset row |
| `Rest/SettingsControllerTest.php` | `/schema` includes `presets` |
| `Rest/PanelDataControllerTest.php` | public permission; invalid locale 400; matching `v` gets an immutable header; other `v` gets max-age 600; payload keys equal `PanelData`; no filesystem write is called |
| `Frontend/PanelDataTest.php` | payload contains full strings with label overrides; hash is stable for equal input and changes with labels, version or schema |
| `Frontend/PanelDataStoreTest.php` | entry built once and cached in the option; file name pattern; non-direct filesystem gives REST URLs for both; `failed_at` backoff; `invalidate` deletes the option and files; translation upgrade fires the action with `translations` |
| `Frontend/VisibilityTest.php` | each mode times each matcher; `__guest`; block template slug; page template slug; filter still wins |
| `Frontend/InlineConfigTest.php` | exact keys; `parse_combo` cases (`Alt+Shift+A`, `Ctrl+1`, invalid gives null); `hiddenMedia` for each device combination; `strlen(script) <= 1536` with default settings, locale `pl_PL` and an 80-char plugin URL; the legacy filter inlines moved fields |
| `Frontend/AssetsTest.php` | per strategy: handles enqueued, `strategy` arg, `in_footer` from position; eager registers 5 chunk handles; pageCss linked enqueues the style, inline appends to the tokens CSS, lazy does neither and the bootstrap prefix has `css`; fetchpriority arg on 6.9 and the tag filter on 6.4 |
| `Frontend/ScriptAttributesTest.php` | each opt-out value adds exact attributes to our tags only; foreign handles untouched; fetchpriority set via `WP_HTML_Tag_Processor` |
| `Frontend/MarkupTest.php` | DSD template present; `shadowrootmode="open"`; `<style>` contains `build/launcher.css`; a label with `"<>` is escaped; a missing launcher.css omits the style; `wp_kses` output keeps the CSS byte-identical |
| `Admin/PerformanceNoticeTest.php` | shown for migrated custom/defer/linked; hidden when dismissed, for recommended, and without the capability |
| `Frontend/ManifestTest.php` | reads `tests/php/fixtures/build/manifest.php`; missing manifest falls back to `KOTLINSKIDEV_A11Y_VERSION` versions and zero sizes |

Fixture: replace `tests/php/fixtures/build/frontend.asset.php` with `manifest.php` and `launcher.css`.

### 9.2 Jest (`tests/js`, jsdom)

New folder `tests/js/loader/`:

| File | Cases |
| --- | --- |
| `queue.test.ts` | pre-loader array drained in order; push after install dispatches; invalid actions dropped; unknown valid actions ignored; open then close replays closed; double toggle within 50 ms collapses |
| `triggers.test.ts` | click on host queues toggle; pointerenter, focusin and touchstart prefetch once with `hover`; none with `none`; hash at boot and on hashchange opens and shows the hidden toolbar; anchor click prevented; shortcut matches `parsed`; shortcut ignored when hidden; bootstrap listener `runtime.e` removed |
| `strategy.test.ts` | use fake timers and stub rIC. interaction: no chunk injected at boot. idle: injected after load plus rIC, and setTimeout fallback without rIC. defer and async: injected at once. eager: no injection when records arrive, injection after 10 s when missing. Warm never builds panel DOM. |
| `device.test.ts` | hidden device: no listeners and no injection; saved state on a hidden device still loads kernel and group; a media change to visible binds triggers; `deviceSkip` false binds anyway |
| `chunks.test.ts` | a script element gets absolute `base + file + ?ver`; the nonce is copied; priority high for a user action and low for prefetch; an ABI mismatch counts as failure; onerror retries once with `&retry=1` after 1000 ms; a second error rejects and the launcher gets `data-state="error"` and the loadError label; the next click retries and succeeds; 15 s timeout counts as error; duplicate records ignored; script order independence (panel record before kernel) |
| `data.test.ts` | primary ok; primary 404 then fallback ok; both fail rejects; memo cleared after reject |
| `dsd.test.ts` | without `shadowRoot`, template content moves into an attached open shadow root; with an existing shadowRoot nothing changes |

Updated:

- `tests/js/bootstrap.test.ts`: `runtime.s` keys; `document.write` path while loading (spy); link append when not loading; no css when `css` is null; hidden flag from session and local storage; `off` sets the hidden attribute; early click queues open.
- New `tests/js/kernel.test.ts` replaces `frontend-boot.test.ts`: boot restores the store; first activation of a key in an unloaded group calls `loadGroup` once; `ensurePageCss` is idempotent and lazy-only; `attachData` merges legacy fields.
- `tests/js/panel.test.ts`: mounts into an existing shadow root with a launcher; no second launcher.
- New `tests/js/check-budget.test.ts`: over-limit fails; missing entry fails; sum rule.
- New `tests/js/admin/cost.test.ts`: the rows of 7.5 for recommended, compatibility, and custom inline.
- `tests/js/admin/helpers.ts`: definitions for the new keys; drop `advanced.loadStrategy`.

### 9.3 Playwright (`tests/e2e`)

Support: `tests/e2e/support/perf.ts` with these helpers:

- `pluginRequests(page)`: requests whose URL contains `/kotlinskidev-accessibility/` or `/kotlinskidev-a11y/`;
- `seedSavedState(page, levels)`: `addInitScript` writing the `ka11y` localStorage entry;
- `firstPaintSnapshot(page)`: `addInitScript` that records `documentElement.className` and whether `#kotlinskidev-a11y-frontend-css` exists and has loaded, on the first `requestAnimationFrame`.

New `tests/e2e/loading.spec.ts` covers strategy (5) times saved state (none, or `readingLine` plus `biggerText:2`) times fixture (stock, hostile), 20 tests. Each test:

1. Set `performance.preset: custom` and the strategy through the settings client.
2. Load `/`. Assert the plugin requests before interaction:
   - interaction without state: only `loader.js`;
   - eager: all 6 scripts;
   - with state: `kernel.js`, `content.js`, `orientation.js` and `frontend.css`, no `panel.js`.
3. With state: assert the first-paint snapshot has the classes and a loaded stylesheet; assert the reading line is active after DOMContentLoaded.
4. Hover the launcher: with `hover`, `panel.js` is requested and no `.ka11y-panel` exists.
5. Click: the panel becomes visible within 5 s; toggling `highContrast` loads `color.js`; the page invariants pass.

Tag `@smoke` on: interaction times both states times stock, eager times none times stock, interaction times state times hostile.

Also in `loading.spec.ts`:

- Open triggers before the loader runs (`@smoke`): `page.route` holds `loader.js` for 2 s. Then click the launcher, visit `/#kotlinskidev-a11y`, and push `kotlinskidevA11yQueue.push({action:'open'})` in an init script. Each must open the panel once the loader is released. The shortcut is tested after the loader runs, before any chunk loads.
- Failure (`@smoke`): route `panel.js` to 404. Click: the host gets `data-state="error"` and the launcher label equals the loadError string. Unroute, click: the panel opens.
- Data fallback: route the uploads JSON to 404. The panel opens through `/wp-json/.../panel-data`.
- Device skip: mobile viewport with `visibility.devices.mobile=false`. No plugin scripts beyond `loader.js`. With saved `readingLine`, `kernel.js` and `orientation.js` load and the feature is active.
- No-JS (`@smoke`): context `javaScriptEnabled: false`. The host is not visible and no console errors appear.
- Page CSS modes: `linked` has a `<link>` in the HTML; `inline` has no `frontend.css` request and the state CSS is present; `lazy` has no stylesheet until open.

New `tests/e2e/compat.spec.ts`:

- Asset CleanUp simulation: mu-plugin `ka11y-fixture-moved.php`, cookie `ka11y_fixture_moved=1`. It copies `build/loader.js` to `wp-content/uploads/ka11y-moved/loader.js` when the copy is missing or stale, and filters `script_loader_src` for `kotlinskidev-a11y-loader` to that URL. Assert the panel opens and every chunk request goes to the plugin `build/` URL.
- Strict CSP: mu-plugin `ka11y-fixture-csp.php`, cookie `ka11y_fixture_csp=nonce|strict`. It sends `script-src 'nonce-{n}' 'self'` (`nonce`) or `script-src 'nonce-{n}' 'strict-dynamic'` (`strict`), plus `style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'`. It adds the nonce through `wp_script_attributes` and `wp_inline_script_attributes`. Assert zero `securitypolicyviolation` events (listener added in an init script), panel opens, and a saved state applies. Tag `@smoke` on `strict`.
- Optimizer attributes: preset compatibility; assert the attributes on the bootstrap, config and loader tags in the HTML.
- Both mu-plugins do nothing outside `WP_ENVIRONMENT_TYPE` `local`, like the existing switch.

New `tests/e2e/perf.spec.ts`:

- Widget off: `visibility.mode=only_on` with `includePostIds=[999999]`. Widget on: Recommended.
- Five runs each on `/` (stock), with CPU throttling 4x through CDP `Emulation.setCPUThrottlingRate`.
- In-page `PerformanceObserver` measures CLS (`layout-shift` without recent input), LCP (`largest-contentful-paint`) and the long-task total over 50 ms (TBT proxy) until `load` plus 2 s.
- Median deltas, on minus off: CLS ≤ 0.005, LCP ≤ 50 ms, long-task total ≤ 30 ms.
- Render-blocking check: no plugin stylesheet in the HTML `<head>` for Recommended.
- Tag `@smoke` on one run per side, with assertions on CLS and requests only.

Nightly Lighthouse:

- Add devDependency `@lhci/cli` and `lighthouserc.cjs` at the root, with 3 runs per URL against wp-env: `/` with the widget off, `/` Recommended, `/` with saved state seeded through a puppeteer script.
- Assertions: `cumulative-layout-shift` ≤ 0.01; `render-blocking-resources` has no plugin URL in Recommended; an LCP and TBT delta ≤ 5 percent between off and on, done by a small `bin/lh-compare.mjs` reading the JSON results.
- Runs in `nightly.yml` only.

`docs/TESTING.md`: add the new specs, the three mu-plugins and the `@smoke` additions.

## 10. Milestones

The tier column says which agent does the work: coder = Sonnet, maker = Haiku with every edit specified, thinker = Sonnet review only. Each milestone runs the verify command plus the listed checks before handoff.

### M3.1 Settings schema v2, presets, migration (coder)

Depends on: none.

Files:
- `src/php/Settings/Schema.php`
- `src/php/Settings/Sanitizer.php`
- `src/php/Settings/Repository.php`
- `src/php/Rest/SettingsController.php`
- `tests/php/Settings/SchemaTest.php`
- `tests/php/Settings/SanitizerTest.php`
- `tests/php/Settings/RepositoryTest.php`
- `tests/php/Rest/SettingsControllerTest.php`

Acceptance:
- the 9.1 cases for these files pass;
- `composer run lint`, `composer run analyse` and `composer run test:unit` are green;
- `GET /schema` in wp-env lists the new definitions and `presets`.

Assets keep reading `advanced.loadStrategy ?? 'defer'` until M3.7, so the front end must keep working: `performance.strategy` `idle` maps to the idle loader, anything else to defer.

Rollback: revert the commit. Stored v2 options keep working on v0.1.3 (7.3).

### M3.2 Visibility modes (coder)

Depends on: M3.1.

Files:
- `src/php/Frontend/Visibility.php`
- `tests/php/Frontend/VisibilityTest.php`
- `src/ts/admin/panels/visibility.ts`
- `src/ts/admin/labels.ts`
- `tests/js/admin/helpers.ts`
- `tests/js/admin/form-renderer.test.ts`

Acceptance:
- the Visibility cases in 9.1 pass;
- the admin shows the mode select, the fieldset swap works, and saving round-trips;
- the existing e2e `settings-effects.spec.ts` passes.

Rollback: revert. Data stays compatible.

### M3.3 Panel data and REST fallback (coder)

Depends on: M3.1.

Files:
- `src/php/Frontend/PanelData.php`
- `src/php/Frontend/PanelDataStore.php`
- `src/php/Rest/PanelDataController.php`
- `src/php/Plugin.php`
- `src/php/I18n/Strings.php` (add `loadError`)
- `uninstall.php` (delete the option and the uploads folder)
- `tests/php/Frontend/PanelDataTest.php`
- `tests/php/Frontend/PanelDataStoreTest.php`
- `tests/php/Rest/PanelDataControllerTest.php`

Nine files is allowed: two are one-line edits.

Acceptance:
- the 9.1 cases pass;
- in wp-env, the first page view creates `uploads/kotlinskidev-a11y/panel-en_US-*.json`;
- saving settings deletes it;
- `curl` on the REST URL returns the same JSON with the immutable header.

Rollback: revert. The leftover uploads folder is harmless.

### M3.4 TypeScript chunk split (coder)

Depends on: none. It can run in parallel with M3.1 to M3.3.

Files:
- `src/ts/shared/types.ts` (`InlineConfig`, `PanelData`, `RuntimeHandoff`, `ChunkRecord`, `KA11yCommand`, `KA11yQueue`)
- `src/ts/shared/runtime.ts` (`RUNTIME_ABI`, `isChunkRecord`)
- `src/ts/frontend/kernel/exports.ts`
- `src/ts/frontend/kernel/index.ts` (`bootKernel`, `KernelApi`)
- `src/ts/frontend/chunks/panel.ts` (`mount`)
- `src/ts/frontend/chunks/content.ts`, `src/ts/frontend/chunks/color.ts`, `src/ts/frontend/chunks/orientation.ts` (each exports `features` and an optional `init(kernel)`; color's `init` binds exclusivity)
- `src/ts/frontend/panel.ts` (landmarks import path, and `resolveLauncher` must reuse the DSD launcher)
- `src/ts/frontend/hide-toolbar.ts` (toggle `html[data-ka11y-hidden]` as well as `host.hidden`; read the flag from the attribute)

Delete `src/ts/frontend/index.ts` in M3.8, not here.

Interfaces:

```ts
export interface KernelBootOptions {
  config: InlineConfig;
  groupOf(key: string): GroupName | null;
  loadGroup(name: GroupName): Promise<void>;
}

export interface KernelApi {
  store: Store;
  addFeatures(chunk: FeatureChunk): void;
  attachData(data: PanelData): void;
  profiles(): Profiles | null;
  ensurePageCss(): void;
}

export interface FeatureChunk {
  features: readonly FeatureModule[];
  init?(kernel: KernelApi): void;
}

export interface PanelMountOptions {
  kernel: KernelApi;
  config: KotlinskidevA11yConfig;
  data: PanelData;
  host: HTMLElement;
  shadow: ShadowRoot;
}

export interface PanelChunk {
  mount(options: PanelMountOptions): { dialog: Dialog };
}
```

`mount` calls `injectShadowStyles` (panel CSS plus `data.customCss`), `createThemeResolver`, `createHideToolbar` and `createPanel`, with `profiles` from `kernel.profiles()` (created by `attachData`).

Acceptance:
- `tests/js/kernel.test.ts` and the updated `panel.test.ts`, `hide-toolbar.test.ts` and `contrast-exclusivity.test.ts` pass;
- `npm run typecheck` is green;
- the old `frontend/index.ts` still builds, so the site keeps working.

Rollback: revert.

### M3.5 Build pipeline, manifest, launcher CSS split, budgets (coder, then thinker review)

Depends on: M3.4.

Files:
- `bin/build.mjs`
- `bin/lib-chunks.mjs`
- `bin/check-budget.mjs`
- `bin/budgets.json`
- `src/scss/launcher/index.scss`
- `src/scss/launcher/_state.scss`
- `src/scss/widget/index.scss`
- `package.json`
- `tests/js/check-budget.test.ts`

Also a one-line edit to the CI `js` job and to the `CLAUDE.md` verify command.

Keep emitting legacy `frontend.js` until M3.8, so the site works between milestones. It is excluded from budgets.

Acceptance:
- `npm run build` emits the 6 chunks, `launcher.css` and both manifests;
- `npm run check-budget` passes;
- deliberately importing an orientation feature from `panel.ts` makes the build fail with the ownership error;
- a `>` in `_state.scss` makes the build fail;
- every wrapped chunk starts with `(window.kotlinskidevA11yRuntime=`.

Thinker: review the wrapper and the external plugin for global leaks, and check that the kernel namespace has no duplicate names.

Rollback: revert. The legacy bundle is still produced, so nothing breaks.

### M3.6 Loader (coder)

Depends on: M3.4 (types). It may run in parallel with M3.5.

Files:
- `src/ts/loader/index.ts`
- `src/ts/loader/queue.ts`
- `src/ts/loader/triggers.ts`
- `src/ts/loader/chunks.ts` (`load`, `fetchData`, retry, nonce)
- `src/ts/loader/device.ts`
- `tests/js/loader/queue.test.ts`, `tests/js/loader/triggers.test.ts`, `tests/js/loader/chunks.test.ts`

Add `strategy.test.ts`, `device.test.ts`, `data.test.ts` and `dsd.test.ts` too. Test files beyond the 8 are allowed in this milestone.

The loader imports only `src/ts/loader/*`, `src/ts/shared/*`, `frontend/hash-open.ts` (`OPEN_HASH`) and `frontend/shortcut.ts` (`matchesCombo`). Move `OPEN_HASH` and `matchesCombo` into `src/ts/shared/` if the ownership check flags them.

Acceptance:
- all 9.2 loader cases pass;
- after build, `scripts.loader` gzip is at most 2048.

Rollback: revert. Nothing enqueues it yet.

### M3.7 PHP front end: manifest, inline config, strategies, attributes (coder, then thinker review)

Depends on: M3.1, M3.3, M3.5.

Files:
- `src/php/Frontend/Manifest.php`
- `src/php/Frontend/InlineConfig.php`
- `src/php/Frontend/ScriptAttributes.php`
- `src/php/Frontend/Assets.php`
- `tests/php/Frontend/ManifestTest.php`
- `tests/php/Frontend/InlineConfigTest.php`
- `tests/php/Frontend/ScriptAttributesTest.php`
- `tests/php/Frontend/AssetsTest.php`

Also add the fixture `tests/php/fixtures/build/manifest.php`.

`Assets` behaviour:
- enqueue the loader per 5.1 and the eager chunks;
- the Page CSS modes per 4;
- the bootstrap prefix with `css` and `hk`;
- the `<noscript>` style;
- the `html[data-ka11y-hidden]` rule and document `customCss` appended to the tokens CSS;
- the legacy filter.

Remove every `frontend.js` reference.

Acceptance:
- the 9.1 cases pass;
- in wp-env, view source on `/` under Recommended shows one plugin script tag (`loader.js`, with `defer` and `fetchpriority="low"`), no plugin stylesheet `<link>`, and an inline config of at most 1536 B.

The panel works once M3.8 lands. Merge M3.7 and M3.8 in the same PR.

Thinker: review escaping in the inline output and the attribute filters for foreign handles.

Rollback: revert M3.7 and M3.8 together.

### M3.8 DSD markup, bootstrap, wiring, legacy removal (coder)

Depends on: M3.5, M3.6, M3.7.

Files:
- `src/php/Frontend/Markup.php`
- `tests/php/Frontend/MarkupTest.php`
- `src/ts/bootstrap/index.ts`
- `tests/js/bootstrap.test.ts`
- `src/ts/frontend/index.ts` (delete)
- `tests/js/frontend-boot.test.ts` (delete)
- `bin/build.mjs` (stop emitting `frontend.js`)
- `tests/e2e/support/fixtures.ts` (launcher locator unchanged; add `waitForPanel` with a 5 s timeout)

Acceptance:
- the full existing e2e suite is green under Recommended (`npx playwright test`);
- before any click, the launcher renders in the shadow root with JS disabled for chunks (route `kernel.js` and `panel.js` to abort), a screenshot equals the post-load launcher, and CLS is 0;
- `?ka11y=off` hides the launcher.

Rollback: revert M3.7 and M3.8 together. v0.1.3 behaviour returns.

### M3.9 Admin Performance tab and cost readout (coder)

Depends on: M3.1, M3.5.

Files:
- `src/ts/admin/panels/performance.ts`
- `src/ts/admin/cost.ts`
- `src/ts/admin/form-renderer.ts`
- `src/ts/admin/labels.ts`
- `src/ts/admin/panels/behavior.ts`
- `src/ts/admin/types.ts`
- `src/php/Admin/SettingsPage.php` (`cost` config)
- `tests/js/admin/cost.test.ts`

Acceptance:
- `cost.test.ts` passes;
- picking Compatibility fills the fields and the readout updates; editing a field flips the preset to Custom;
- saving under Recommended with a hand-posted `strategy: eager` stores `interaction`;
- the `admin.spec.ts` e2e is extended with the preset flow.

Rollback: revert. Settings stay valid.

### M3.10 Upgrade notice (coder)

Depends on: M3.1.

Files:
- `src/php/Admin/PerformanceNotice.php`
- `src/php/Plugin.php`
- `tests/php/Admin/PerformanceNoticeTest.php`

Acceptance:
- the 9.1 cases pass;
- in wp-env, a v1 option fixture imported through WP-CLI shows the notice, and dismissal persists.

Rollback: revert.

### M3.11 E2E matrix, compat fixtures, perf gates (coder, then thinker review)

Depends on: M3.8, M3.9.

Files:
- `tests/e2e/loading.spec.ts`
- `tests/e2e/compat.spec.ts`
- `tests/e2e/perf.spec.ts`
- `tests/e2e/support/perf.ts`
- `tests/e2e/fixtures/mu-plugins/ka11y-fixture-moved.php`
- `tests/e2e/fixtures/mu-plugins/ka11y-fixture-csp.php`
- `docs/TESTING.md`
- `.github/workflows/nightly.yml` (Lighthouse job, `lighthouserc.cjs`, `bin/lh-compare.mjs`)

Lighthouse may be split into M3.11b if over 8 files.

Acceptance:
- the full suite and the `@smoke` suite are green in CI;
- reverting the M3.8 `document.write` path makes the first-paint test fail;
- routing `panel.js` to 404 shows the error state.

Thinker: review flake risk (timeouts, network routing) and whether each assertion proves the spec claim.

Rollback: revert the tests only.

### M3.12 Docs, translations, release (maker)

Depends on: all above.

Files:
- `README.md` (Performance settings, presets, Page CSS modes, opt-out list, `kotlinskidev_a11y_legacy_config`, new invalidation reasons, CSP requirement `style-src 'unsafe-inline'` as for WordPress core, downgrade note)
- `CHANGELOG.md` (draft below)
- `docs/ROADMAP.md` (Phase 3 done, link this spec)
- `languages/kotlinskidev-accessibility-pl_PL.po` (new strings; the thinker writes the Polish text first, then the maker applies it)
- `npm run i18n:pot`, `npm run i18n:json`
- `npm run release -- --minor`, then `npm run check-version`

Acceptance:
- `npm run check-version` is green;
- the pot contains `loadError` and every Performance label;
- `pl_PL` has no untranslated new strings.

Rollback: revert the release commit before tagging.

Dependency order: M3.1 and M3.4 start in parallel. Then M3.2, M3.3 and M3.5, then M3.6, then M3.7 and M3.8 together (one PR), then M3.9 and M3.10, then M3.11, then M3.12.

## 11. CHANGELOG draft (v0.2.0)

```markdown
## [0.2.0] - YYYY-MM-DD

### Added

- Performance tab with presets Recommended, Compatibility and Custom: load strategy (interaction, idle, defer, async, eager), script position, fetch priority, panel prefetch, Page CSS mode (lazy, linked, inline), skipping downloads on hidden devices, and optimizer opt-out attributes. The admin shows the estimated cost per page.
- Where to load: everywhere, only on, or except on, by post, post type, template, role (including `__guest`) and URL pattern.
- `kotlinskidevA11yQueue` command queue: `open`, `close` and `toggle` work before any script has loaded and are replayed in order.
- Panel data is served as a versioned JSON file per locale from uploads, with a REST fallback at `kotlinskidev-a11y/v1/panel-data`.
- `kotlinskidev_a11y_cache_invalidated` fires with `translations` after language packs update.

### Changed

- Only a loader of at most 2 KB gzip runs on every page. The panel, the features and the page CSS load on first use. Visitors with saved settings still get them before first paint.
- The launcher is server-rendered in a declarative shadow root, so it looks final before any JavaScript runs. It shows a loading and an error state.
- `window.kotlinskidevA11y` holds only what the loader needs. The other fields are filled in after the panel data loads.
- Document-level custom CSS is printed in the page head instead of being injected by JavaScript.

### Deprecated

- Reading `features`, `profiles`, `widget`, `theme`, `tokens`, `hideToolbar`, `statementUrl`, `customCss` or the full `strings` from `window.kotlinskidevA11y` at page load. Return `true` from `kotlinskidev_a11y_legacy_config` to keep them inline until v0.3.0.

### Removed

- `advanced.loadStrategy`. Existing values migrate to the Custom preset with the same behaviour.
- `build/frontend.js`.
```

## 12. Risks

| Risk | Mitigation |
| --- | --- |
| FOUC for saved-state visitors when an optimizer delays or defers the inline bootstrap | Opt-out attributes in Compatibility. The bootstrap falls back from `document.write` to an appended link after parse. The e2e first-paint test runs on every strategy. |
| Double load (eager tags plus loader injection, or an optimizer duplicating tags) | The runtime ignores a second record with the same name. In eager the loader injects only after a 10 s miss. Chunks have no top-level side effects beyond the push. |
| Optimizers deferring, delaying, combining or deleting the loader | Classic script with no dependencies, order-independent queue, opt-out attributes, and an early click capture in the bootstrap so clicks before the loader are not lost. |
| Optimizers or offload plugins rewriting uploads URLs, or JSON blocked | REST fallback URL in config. Failed file writes switch config to REST for an hour. |
| CSP blocking injected chunks | No `import()`; the nonce is copied; strict-dynamic and nonce-plus-self are both tested. Inline styles need `style-src 'unsafe-inline'`, as WordPress core already does; documented. |
| Old browsers without DSD, or templates inserted by `innerHTML` | The loader attaches the shadow root and moves the template content. The launcher appears at DOMContentLoaded. Covered by Jest `dsd.test.ts`. |
| Stale page cache after an update (old inline config, new chunks) | Stable file names, additive config fields, ABI check with a visible error state, and the existing `update` invalidation reason. |
| `wp_kses` mangling launcher CSS | The build rejects `<`, `>` and `&` in `launcher.css`. A PHPUnit test checks the CSS survives byte-identical. |
| Request-dependent `kotlinskidev_a11y_strings` filters frozen into the cached JSON | Documented; the filter author fires the invalidation action. |
| First click latency under `interaction` on slow networks | Hover, focus and touch prefetch by default, and a loading ring after 300 ms. The `idle` and `defer` strategies are one setting away. |
| Loader over 2 KB gzip | CI budget; the fallback order is in 1.4. |
| Role-based visibility with page caches serving logged-out HTML | Admin help text; render decisions per role are documented as unsafe for cached logged-out pages. |
| Migrated sites keep v0.1 behaviour and gain little | Dismissible admin notice that recommends the Recommended preset. |
| Template slug detection differs between block and classic themes | Both identifiers are matched; PHPUnit covers both; the help text lists examples. |

## Open questions for the owner

1. Migration of the stored `advanced.loadStrategy = 'defer'`. It was the default, so it cannot be told apart from a deliberate choice. This spec keeps v0.1 behaviour (Custom, defer, linked CSS) and shows a notice. Moving every existing site straight to Recommended is the alternative. Confirm which one you want.
