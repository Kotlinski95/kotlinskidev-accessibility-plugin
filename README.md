# Kotlinskidev Accessibility

Standalone GPL accessibility widget plugin for WordPress. Visitors adjust content, colors and orientation; settings are managed from the admin page and the REST API.

Requires WordPress 6.4+, PHP 8.1+, Node 20+ (22 in CI).

## Installation

1. Download `kotlinskidev-accessibility.zip` from the latest GitHub Release. Do not download "Source code (zip)": it lacks `vendor/` and `build/` and the plugin will not run.
2. In WordPress open Plugins, Add New, Upload Plugin, choose the zip and activate.

Updates arrive through the Plugins screen like any other plugin. The "Check for updates" link on the plugin row forces an immediate check; otherwise the updater runs about every 12 hours.

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

There is also a block, "Accessibility trigger", for the editor and Navigation menus. The Triggers tab holds the launcher mode (`floating`, `inline`, `hidden`), custom selectors, the URL action allowlist and a snippet generator. Full reference, including the JavaScript API, events and deprecation policy: [docs/API.md](docs/API.md).

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

## Build

```bash
npm install
composer install
npm run build
npm run typecheck
npm run lint
npm test
composer test:unit
vendor/bin/phpcs --standard=phpcs.xml.dist
```

## Release flow

1. Add entries under `[Unreleased]` in `CHANGELOG.md`.
2. Run `npm run release -- --patch` (or `--minor`, `--major`). Add `--dry-run` to preview. It bumps the plugin header, `KOTLINSKIDEV_A11Y_VERSION`, `package.json`, `package-lock.json` and moves `[Unreleased]` under the new dated heading.
   For a prerelease add `--pre beta` or `--pre rc` (for example `npm run release -- --major --pre beta` gives `1.0.0-beta.1`, running `--pre beta` again gives `beta.2`, and a plain `npm run release` on a prerelease gives the stable version).
3. Commit, then tag and push: `git tag vX.Y.Z && git push --follow-tags`.
4. The `Release` workflow builds assets, installs production Composer dependencies, checks versions with `bin/check-version.mjs`, generates `.pot` and JSON translations, packages `kotlinskidev-accessibility.zip` using `.distignore`, writes `kotlinskidev-accessibility.zip.sha256`, attests build provenance, publishes the GitHub release with the `CHANGELOG.md` section as its notes (a tag with a hyphen, such as `v1.0.0-beta.1`, is marked as a pre-release) and fails if the zip or checksum asset is missing.

`npm run check-version` fails unless every version source matches; on tag builds it also compares against `GITHUB_REF_NAME`.

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

Locked paths exit 1 with `Locked by site configuration`. `import` and `reset` ask for confirmation unless you pass `--dry-run` or `--yes`. `--network` is accepted by the synopsis for the network defaults release and currently exits 1.

## Frontend hooks

| Hook | Purpose |
| --- | --- |
| `kotlinskidevA11y.open()`, `close()`, `toggle()`, `set()`, `reset()`, `getState()`, `on()` | JavaScript API, available after the `ka11y:ready` event. |
| `window.kotlinskidevA11yQueue.push( { action } )` | Send an action before any script has loaded. It is replayed in order. |
| `ka11y:ready`, `ka11y:open`, `ka11y:close`, `ka11y:change` | Events on `document`. |

## Filters

| Filter | Purpose |
| --- | --- |
| `kotlinskidev_a11y_capability` | Capability required to manage settings. |
| `kotlinskidev_a11y_should_render` | Decide whether the widget renders on the current request. |
| `kotlinskidev_a11y_current_locale` | Override the locale used for widget strings. |
| `kotlinskidev_a11y_strings` | Adjust the strings sent to the front end. |
| `kotlinskidev_a11y_update_source` | Swap repository, slug, asset pattern or branch for updates. |
| `kotlinskidev_a11y_update_token` | Supply an authentication token for private update sources. |
| `kotlinskidev_a11y_button_html` | Change the markup of a trigger button. The result is filtered again. |
| `kotlinskidev_a11y_trigger_selectors` | Add custom trigger selectors from code. |
| `kotlinskidev_a11y_url_actions` | Narrow the actions allowed from `?ka11y=` and `#ka11y/` URLs. |
| `kotlinskidev_a11y_locale_label` | Change the language name shown in the panel language select. |
| `kotlinskidev_a11y_icons` | Replace icon path data by name. Path data only. |

## Privacy and storage (GDPR)

The widget stores a visitor's choices only on their device, never on the server, and sends nothing to third parties. `storage.mode` selects where:

- `local`: `localStorage`, no expiry unless a TTL is set. Strictly necessary to honor an explicit user preference, as noted on the admin page.
- `cookie`: a first-party cookie with the configured lifetime.
- `none`: nothing persisted; choices reset on reload.

Choose `none` if your legal review requires no storage without consent. Page caches must vary per language.
