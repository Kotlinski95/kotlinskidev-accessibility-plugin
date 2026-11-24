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

`$reason` is `settings` after settings are saved, imported or reset (at most once per request), or `update` once after the plugin version changes (checked in the admin and cron only, never on first install).

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
3. Commit, then tag and push: `git tag vX.Y.Z && git push --follow-tags`.
4. The `Release` workflow builds assets, installs production Composer dependencies, checks versions with `bin/check-version.mjs`, generates `.pot` and JSON translations, packages `kotlinskidev-accessibility.zip` using `.distignore`, publishes the GitHub release and fails if the zip asset is missing.

`npm run check-version` fails unless every version source matches; on tag builds it also compares against `GITHUB_REF_NAME`.

## Updates on customer sites

The plugin embeds Plugin Update Checker v5 pointed at the GitHub repository. WordPress checks in the admin and via cron (never on front-end requests). When a newer release exists, the standard update notice appears and installs the `kotlinskidev-accessibility.zip` release asset.

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

## Filters

| Filter | Purpose |
| --- | --- |
| `kotlinskidev_a11y_capability` | Capability required to manage settings. |
| `kotlinskidev_a11y_should_render` | Decide whether the widget renders on the current request. |
| `kotlinskidev_a11y_current_locale` | Override the locale used for widget strings. |
| `kotlinskidev_a11y_strings` | Adjust the strings sent to the front end. |
| `kotlinskidev_a11y_update_source` | Swap repository, slug, asset pattern or branch for updates. |
| `kotlinskidev_a11y_update_token` | Supply an authentication token for private update sources. |

## Privacy and storage (GDPR)

The widget stores a visitor's choices only on their device, never on the server, and sends nothing to third parties. `storage.mode` selects where:

- `local`: `localStorage`, no expiry unless a TTL is set. Strictly necessary to honor an explicit user preference, as noted on the admin page.
- `cookie`: a first-party cookie with the configured lifetime.
- `none`: nothing persisted; choices reset on reload.

Choose `none` if your legal review requires no storage without consent. Page caches must vary per language.
