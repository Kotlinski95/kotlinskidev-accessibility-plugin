# Kotlinskidev Accessibility

Standalone GPL accessibility widget plugin for WordPress. Visitors adjust content, colors and orientation; settings are managed from the admin page and the REST API.

Requires WordPress 6.4+, PHP 8.1+, Node 20+ (22 in CI).

## Install

Download `kotlinskidev-accessibility.zip` from the latest GitHub release and upload it under Plugins, Add New, Upload Plugin. Do not use GitHub's "Source code" archive: it has no built assets or vendor directory.

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
