# Phase 6 spec: management and maintenance, v1.0

Status: draft for owner review. Source of truth for Phase 6 once approved. It replaces the Phase 6 section of `ROADMAP.md` where the two differ.

Rules for every milestone: strict TypeScript (no `any`), no comments anywhere, WPCS PHP, no jQuery, no React, all strings through i18n, every new user-facing string in `pl_PL`. The widget panel is not redesigned. Phase 6 adds zero bytes to the front end: no change to the bootstrap, loader, kernel, panel, feature chunks, launcher CSS, page CSS, inline config or `/panel-data` payload. Everything new lives in the admin bundle, PHP that runs only in admin, REST, cron or WP-CLI, the release workflow and CI.

## Open decisions for the owner

| # | Decision | Recommendation |
| --- | --- | --- |
| D1 | Beta channel opt-in mechanism. | One network-wide option `kotlinskidev_a11y_update` (`{ "channel": "stable" \| "beta" }`, stored with `update_site_option`, so single site and multisite behave the same). Set from an Updates card that only `update_plugins` users see. Constant `KOTLINSKIDEV_A11Y_UPDATE_CHANNEL` wins over the option, filter `kotlinskidev_a11y_update_channel` runs last. Default `stable`. Not part of `kotlinskidev_a11y_settings`, so it is never exported or imported. |
| D2 | Rollback storage location and retention. | No local copies of old zips. Rollback downloads the chosen release asset from the update source on demand and checks its SHA-256 (section 8.4). Offer the 3 newest stable releases older than the installed one, never older than v0.4.0 (the rollback floor). Before installing, write one settings backup to option `kotlinskidev_a11y_settings_backup` (autoload off, replaced each time). Old zips in a public uploads folder would be a download and tampering risk, and local retention costs disk on every customer site. |
| D3 | How multisite network defaults merge. | Layered, live inheritance: schema defaults, then network defaults, then the site's own values, then locks. From v1.0 a site stores only the paths that differ from the defaults below it (sparse storage, section 3.2), so a network change reaches every site that did not override that path. Nothing is copied into new sites. The network can also lock paths. |
| D4 | Locked settings precedence. | Constant `KOTLINSKIDEV_A11Y_LOCKED_SETTINGS` beats filter `kotlinskidev_a11y_locked_settings`, which beats network locks. Any lock beats network and site values. Lock values must pass the schema strictly or they are dropped and reported in Site Health. Locked fields render disabled with "Locked by site configuration". |
| D5 | Customer role: a real WordPress role or a capability. | A primitive capability `kotlinskidev_a11y_customize`, no new role. Owners grant it to an existing role with `wp ka11y access grant <role>` or with code. Filter `kotlinskidev_a11y_customer_capability` renames it. A role adds database state, role-editor clutter and a role to delete on uninstall, for no gain over a capability. |
| D6 | What the customer can edit. | `labels`, `statement.*`, `tokens.*`, `panel.*`, `theme.mode`. Not `customCss`, `theme.darkSelector`, `theme.lightSelector` (code-like input), and nothing from other tabs. Filter `kotlinskidev_a11y_customer_paths` can only narrow the list. |
| D7 | Uninstall default. | Delete data (today's behaviour, and what wordpress.org reviewers expect). New setting `maintenance.keepDataOnUninstall`, default `false`. |
| D8 | Checksums and provenance for releases made before Phase 6. | The owner uploads `kotlinskidev-accessibility.zip.sha256` for v0.4.0 by hand (`gh release upload`), so v0.4.0 can be a rollback target. Build provenance attestations start with v1.0.0-beta.1 only: attesting an old zip from a later run would claim a build that did not happen. |
| D9 | wordpress.org listing. | Not in Phase 6. Stay compliant (section 10) and add `KOTLINSKIDEV_A11Y_DISABLE_UPDATER` so a future wordpress.org build can drop the updater and rollback cleanly. No `readme.txt` until the owner decides to list. |
| D10 | Admin bundle size. | New budget `scripts.admin` in `bin/budgets.json`: the v0.4.0 gzip size measured at the start of M6.2, plus 10240 B. Admin code never loads on the front end, but it should not grow without limit. |
| D11 | Path to v1.0. | v1.0.0-beta.1 on the beta channel, installed on the owner's site for 7 days, then v1.0.0. A blocking bug gives beta.2 and restarts the 7 days. |

## 0. Goals and non-goals

Goals:

1. Settings management: search, per-tab reset, change preview, a stronger unsaved-changes guard, import and export with a version check, locked settings.
2. A customer capability limited to labels, statement and appearance.
3. WP-CLI: `wp ka11y settings get|set|import|export|reset`, `wp ka11y doctor`, `wp ka11y access`.
4. Multisite network defaults and network locks.
5. Site Health tests and debug information.
6. Updates: stable and beta channels, release notes in the update window, rollback, SHA-256 checks and build provenance.
7. Maintenance: `SECURITY.md`, CodeQL and Dependabot coverage, a written deprecation policy, upgrade tests from every released version, Linux visual baselines.
8. Uninstall keep-or-delete choice, privacy policy guide text.
9. The done-when from the roadmap: an upgrade from v0.1.1 to v1.0 keeps settings and visitor state.

Non-goals:

- Any change to the widget, panel layout or front-end payload. Parity gaps P1 (stepper row) and P3 (select padding) stay as v0.4.x follow-ups, outside Phase 6.
- HANDOFF gaps "layout shift for returning visitors" and "inline HTML cost": both need front-end bytes. They stay open.
- HANDOFF gap "locales without a core language pack": already fixed under `[Unreleased]`, ships with v1.0. No further work.
- A private update server product. The existing `kotlinskidev_a11y_update_source` and `kotlinskidev_a11y_update_token` filters stay the private-server option. Phase 6 only makes them visible in Site Health and `doctor`.
- Telemetry of any kind.

## 1. Frozen contracts

Everything in CLAUDE.md "Frozen contracts" and PHASE4-SPEC section 1 stays. Visitor state (`ka11y` storage key and `SavedState` format) does not change. New contracts from v1.0 (change only in a major release):

| Contract | Value |
| --- | --- |
| Options | `kotlinskidev_a11y_settings` (now sparse), `kotlinskidev_a11y_settings_backup`; site options `kotlinskidev_a11y_network_settings`, `kotlinskidev_a11y_update` |
| Constants | `KOTLINSKIDEV_A11Y_LOCKED_SETTINGS`, `KOTLINSKIDEV_A11Y_UPDATE_CHANNEL`, `KOTLINSKIDEV_A11Y_DISABLE_UPDATER` |
| Filters | `kotlinskidev_a11y_locked_settings`, `kotlinskidev_a11y_customer_capability`, `kotlinskidev_a11y_customer_paths`, `kotlinskidev_a11y_update_channel`, `kotlinskidev_a11y_enable_updater`, `kotlinskidev_a11y_rollback_releases` |
| Capability | `kotlinskidev_a11y_customize` |
| WP-CLI | `wp ka11y settings ...`, `wp ka11y doctor`, `wp ka11y access ...`, exit codes in section 6 |
| Export file | envelope in section 4.1, `format` `kotlinskidev-accessibility-settings`, `formatVersion` 1 |
| Site Health | test ids `kotlinskidev_a11y_*`, debug section `kotlinskidev-accessibility` |

REST routes stay additive. Existing route bodies keep their shape; new behaviour is behind new parameters or new routes.

## 2. Size budget

Hard rule: `bin/budgets.json` entries for the front end do not change in Phase 6, and `npm run check-budget` must report the same front-end numbers as v0.4.0 (within 0 B for every entry, since no front-end source changes).

Proof, added in M6.1 before any other change:

- `tests/php/Frontend/PayloadGoldenTest.php`: for default settings and for `tests/fixtures/settings/full-v4.json`, `InlineConfig::script()` and `PanelData::encode( PanelData::payload( 'en_US' ) )` equal golden files `tests/fixtures/golden/inline-*.txt` and `panel-data-*.json`, captured from v0.4.0 code. Network defaults and locks that resolve to the same values must give the same bytes.
- CI step in the Node job: `git diff --exit-code origin/main -- src/ts/frontend src/ts/shared src/scss/widget src/scss/launcher src/scss/page` fails any Phase 6 PR that touches front-end source. Removed after v1.0.

PHP front-end cost, the only allowed runtime change: `Repository::get()` gains one `defined()` check, one `apply_filters`, and on multisite one `get_site_option` (cached by the object cache, one query per request without it). Everything else (CLI, Site Health, Access, rollback, privacy text) is constructed only when `is_admin()`, `wp_doing_cron()`, `REST_REQUEST` or `WP_CLI` is true.

Admin: new `scripts.admin` budget (D10). `bin/check-budget.mjs` reads `build/admin.js` for it.

## 3. Settings core

### 3.1 Schema v5

`Schema::VERSION = 5`. Additions:

| Key | Type | Default | Notes |
| --- | --- | --- | --- |
| `maintenance.keepDataOnUninstall` | bool | `false` | read raw by `uninstall.php`; never sent to the front end |

Migration `4 => strip_defaults`: removes every leaf whose value equals `Schema::defaults()` at that path (lists compared as whole values), keeps `schemaVersion`. It runs on read like the others, so a v0.4 full tree resolves to the same effective values while letting network defaults apply. `VersionWatcher::check()` persists the migrated tree once after an update (admin and cron only), through `Repository::persist_migrated()`, which does not fire `kotlinskidev_a11y_cache_invalidated` because effective values do not change on a single site.

### 3.2 Resolution layers

`Repository::get()` returns, in order of increasing priority:

1. `Schema::defaults()`
2. network defaults: `get_site_option( 'kotlinskidev_a11y_network_settings', array() )['settings']`, multisite only, sanitized on write
3. the site's stored option, migrated
4. locks (section 3.3)

then `Schema::apply_performance_preset()`, as today. New public methods:

| Method | Returns |
| --- | --- |
| `effective_defaults(): array` | layers 1 and 2 merged; what a site reset returns to |
| `stored(): array` | layer 3 after migration, sparse |
| `locked(): array` | path to value map, valid entries only |
| `lock_errors(): array` | dropped lock entries with a reason, for Site Health |
| `source( string $path ): string` | `default`, `network`, `site` or `locked` |

`save()` sanitizes the full tree, then removes paths whose value equals `effective_defaults()` and all locked paths, then stores the result. `reset( array $prefixes = array() )` removes the stored paths under the given prefixes, or the whole option when empty. Both fire `Invalidation::settings_changed()` only when the effective tree changed.

Downgrade: a sparse v5 tree read by v0.4.0 merges with v0.4 defaults and gives the same values a single site had (locks and network defaults are lost, by design). `RepositoryTest` proves it with the v0.4 merge code copied into a fixture function.

### 3.3 Locked settings

Sources, merged in this order (later wins): network locks (`network_settings['locked']`, a list of paths whose value is the network default), `apply_filters( 'kotlinskidev_a11y_locked_settings', $locked )` with `$locked` being the network map, then `KOTLINSKIDEV_A11Y_LOCKED_SETTINGS` (an array constant, `define( 'KOTLINSKIDEV_A11Y_LOCKED_SETTINGS', array( 'storage.mode' => 'none' ) )`), re-applied after the filter so a filter cannot change a constant lock.

Validation per entry: the path is a leaf in `Schema::definitions()`, `schemaVersion` cannot be locked, and `Sanitizer::sanitize_value( $value, $definition ) === $value`. Anything else goes to `lock_errors()` with reason `unknown_path`, `not_lockable` or `invalid_value`. In admin, the first error per request also calls `_doing_it_wrong()`.

REST: `POST /settings` with a locked path whose value differs from the lock returns 409 `kotlinskidev_a11y_locked` with `data.paths`. Locked paths that equal the lock are accepted and ignored, so the admin can send its full snapshot.

### 3.4 REST changes (namespace `kotlinskidev-a11y/v1`)

| Route | Change |
| --- | --- |
| `GET /schema` | Additive keys: `effectiveDefaults`, `locked` (path list), `sources` (path to layer, only non-default ones), `access` (`full` or `customer`), `editable` (path prefixes, `null` for full access), `scope` (`site` or `network`). |
| `POST /settings` | New arg `dry_run` (bool). With it, nothing is saved and the body is `{ settings, changes, adjusted, locked }` (section 4.2). Body limit 262144 B, else 413 `kotlinskidev_a11y_too_large`. |
| `POST /import` | Accepts the envelope or a legacy tree (section 4.1). Args `dry_run`. Migrates before sanitizing (fixes v0.4, which saved imported legacy keys without migration). Newer schema gives 409 `kotlinskidev_a11y_newer_schema`. |
| `GET /export` | Returns the envelope. The legacy bare tree is no longer returned. |
| `POST /reset` | Optional body `{ "paths": ["tokens", "theme"] }`: each entry must be a definition path or prefix (regex `^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)*$`), else 400. Arg `dry_run`. |
| `GET, POST /network/settings`, `GET /network/schema`, `POST /network/import`, `GET /network/export`, `POST /network/reset` | Registered only when `is_multisite()`. Permission `manage_network_options`. Same bodies as the site routes; the network tree also has `locked` (list of paths). |
| `GET /releases` | Permission `update_plugins`. Rollback candidates (section 8.4). |
| `POST /update-channel` | Permission `update_plugins`. Body `{ "channel": "stable" \| "beta" }`, enum checked. 409 `kotlinskidev_a11y_channel_fixed` when the constant is set. |

Every route keeps `permission_callback`, declares `args` with `type`, `enum` or `pattern` and `sanitize_callback`, and returns `WP_Error` with a `status`. `docs/API.md` REST table is updated in M6.9.

## 4. Admin settings management

All in `src/ts/admin`. The widget preview (`preview.ts`) is unchanged.

### 4.1 Import and export with version check

Export envelope, downloaded as `kotlinskidev-accessibility-settings-<YYYYMMDD>.json`:

```json
{
  "format": "kotlinskidev-accessibility-settings",
  "formatVersion": 1,
  "plugin": "1.0.0",
  "schemaVersion": 5,
  "scope": "site",
  "exportedAt": "2026-12-01T10:00:00Z",
  "settings": {}
}
```

`settings` is the effective tree without locked paths. No site URL, user or token is included.

Import rules, in `Rest/SettingsController::import_settings()` through a new `Settings/Importer.php`:

| Input | Result |
| --- | --- |
| Envelope, `formatVersion` 1, `schemaVersion` at most `Schema::VERSION` | migrate from that version, sanitize, save |
| Envelope with `formatVersion` above 1 or `schemaVersion` above current | 409, message "This file was made by a newer version of the plugin. Update the plugin first." |
| Bare object with integer `schemaVersion` (v0.1 to v0.4 exports) | treated as an envelope with that version |
| Bare object without `schemaVersion` | treated as version 1 |
| `scope` `network` into a site, or the other way | 400 `kotlinskidev_a11y_wrong_scope` |
| Anything else | 400, existing `invalid_body` |

Import replaces the site's stored values (same as v0.4). The dry run returns `dropped` (input leaves with no definition), `adjusted` (values the sanitizer changed) and `locked` (paths ignored because locked) next to `changes`.

UI flow: choose file, client parses (existing `parseSettingsText`), calls `/import?dry_run=1`, shows the change preview (4.3) with the version line "File from plugin 0.3.0, settings version 3, will be upgraded", then saves on confirm.

### 4.2 Change model

`changes` is `Array<{ path: string; from: unknown; to: unknown; source: 'default' | 'network' | 'site' }>`, sorted by path, computed on the server from effective trees before and after. Lists compare as whole values. The client never computes its own diff for saving; it only formats.

### 4.3 Change preview

`src/ts/admin/change-preview.ts`. Save, import and reset (full or per tab) call the dry run first and open a dialog built on `confirm-dialog.ts`:

- Title "Review changes", a count, then a table: Setting, Before, After. Setting is the field label from the search index (4.5), else the path.
- Value formatting: booleans "On" or "Off", enums by their existing label functions, lists joined with ", ", colors with a swatch and the hex text, HTML and CSS as "Changed (N characters)", strings cut at 80 characters with an ellipsis.
- Over 50 rows: the first 50 and "and N more".
- `adjusted`, `dropped` and `locked` show as warnings above the table.
- Buttons "Save changes" and "Cancel". Focus goes to the dialog title, Escape cancels, focus returns to the button that opened it.
- No changes: no dialog, notice "Nothing to save."

### 4.4 Unsaved-changes guard

`guard.ts` keeps the `beforeunload` guard. Added:

- Save bar shows "N unsaved changes" (`_n`), N from a client path count, used for display only.
- Import, full reset and per-tab reset ask "You have unsaved changes. They will be lost." inside their confirm when `state.isDirty()`.
- Nonce refresh: on a 403 with code `rest_cookie_invalid_nonce`, `api.ts` fetches `admin-ajax.php?action=rest-nonce` once, swaps the nonce and retries. A second failure shows "Your session expired. Copy your changes, then reload the page." and keeps the form state.

### 4.5 Settings search

`src/ts/admin/search.ts`, mounted above the tabs:

- `wrapField` sets `data-ka11y-path` on the field wrapper. After `renderForm`, the index reads every `[data-ka11y-path]` in every tab panel: label text, help text, path, tab id.
- `<input type="search">` with a visible label "Search settings". Matching is case- and accent-insensitive (`normalize('NFD')`, marks removed), every word must match, 100 ms debounce, at least 2 characters.
- Results: a list of up to 20 buttons "Label (Tab)". A `role="status"` line announces "N results". Activating a result selects the tab, focuses the control, scrolls it into view and adds `is-found` for 2 s. Escape clears the field.
- No REST call, no index outside the admin bundle.

### 4.6 Per-tab reset

Each tab panel ends with a "Reset this tab" button (`button-link-delete`). Paths are the `data-ka11y-path` values in that panel. It calls `/reset` with `paths` and `dry_run`, shows the preview, then resets on confirm and reloads state. Locked paths are skipped. The Import / Export tab gets no button.

### 4.7 Locked and inherited fields

`FieldContext` gains `isLocked(path)`, `sourceOf(path)` and `isEditable(path)` from the schema payload. `wrapField` disables locked controls (`disabled` and `aria-disabled`) and adds a help line "Locked by site configuration". On a multisite subsite, fields whose source is `network` show "Network default" in the help line.

### 4.8 Maintenance tab

New last tab "Maintenance" (`panels/maintenance.ts`):

- Card "Uninstall": toggle `maintenance.keepDataOnUninstall`, labelled "Keep settings when the plugin is deleted", with help text listing what is deleted.
- Card "Updates" (only when `config.canUpdate`, from `current_user_can( 'update_plugins' )`, and not on a multisite subsite): channel select Stable or Beta, saved through `/update-channel` immediately (not through the save bar), disabled with a note when the constant is set; "Check for updates now" link (the existing PUC check URL); rollback list from `/releases` with one "Roll back to X" link per release (section 8.4).
- Card "Diagnostics": link to Tools > Site Health and the text `wp ka11y doctor`.

## 5. Customer capability

`src/php/Admin/Access.php`:

| Method | Behaviour |
| --- | --- |
| `admin_capability()` | existing `kotlinskidev_a11y_capability` filter, default `manage_options` |
| `customer_capability()` | filter `kotlinskidev_a11y_customer_capability`, default `kotlinskidev_a11y_customize` |
| `level( ?int $user_id = null )` | `full` with the admin capability, else `customer` with the customer capability, else `none` |
| `editable_paths()` | for `customer`: `labels`, `statement`, `tokens`, `panel`, `theme.mode`, passed through `kotlinskidev_a11y_customer_paths` and intersected with that list; `null` for `full` |
| `can_edit( string $path )` | `full`, or `customer` and the path starts with an editable prefix |

Enforcement is on the server:

- `SettingsPage::add_menu()` uses the admin capability for `full` users and the customer capability otherwise, so customers see Settings > Accessibility.
- `SettingsController::check_permission()` allows `full` everywhere. `customer` may call only `GET /settings`, `GET /schema` and `POST /settings` (with or without `dry_run`).
- For `customer`, `GET /settings` returns only the editable subtree. `POST /settings` merges the body into the current tree, computes changes, and returns 403 `kotlinskidev_a11y_forbidden_paths` with `data.paths` when any changed path is not editable. Nothing is saved in that case.
- `statement.content` already goes through `wp_kses_post`. `customCss` is never editable by customers.
- Admin UI in customer mode: tabs without an editable field are not rendered (expected: Languages and Appearance); fields that are not editable are not rendered; no Import / Export or Maintenance tab; no per-tab reset in Languages (it would touch nothing else, but is kept off to keep the role narrow).
- `PerformanceNotice`, `DashboardWidget` and the alt-text tools keep the admin capability.

Granting: `wp ka11y access grant <role>`, `revoke <role>`, `list` (section 6). Uninstall removes the capability from every role unless data is kept.

## 6. WP-CLI

`src/php/Cli/SettingsCommand.php`, `DoctorCommand.php`, `AccessCommand.php`, registered in `Plugin::init()` only when `defined( 'WP_CLI' ) && WP_CLI`, with `WP_CLI::add_command( 'ka11y settings', ... )` and so on. Every command uses the same `Repository`, `Importer`, `Sanitizer` and `Health\Checks` code as REST and Site Health.

```text
wp ka11y settings get [<path>] [--format=<json|yaml|var_export>] [--layer=<effective|stored|network|defaults>] [--network]
wp ka11y settings set <path> <value> [--json] [--network] [--dry-run]
wp ka11y settings import <file> [--dry-run] [--yes] [--network]
wp ka11y settings export [--file=<file>] [--force] [--network]
wp ka11y settings reset [<path>...] [--dry-run] [--yes] [--network]
wp ka11y doctor [--format=<table|json>] [--fail-on=<critical|recommended>]
wp ka11y access grant <role>
wp ka11y access revoke <role>
wp ka11y access list [--format=<table|json>]
```

Input validation:

- `<path>`: regex `^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)*$`, then it must be a definition path or prefix (`get`, `reset`) or a leaf (`set`). Unknown paths exit 1 with the closest match from `levenshtein` when the distance is at most 3.
- `<value>` for `set`, by definition type: boolean `true|false|1|0|on|off|yes|no`; integer `^-?\d+$` and inside `min`/`max` (out of range is an error, never a clamp); enum must be listed; string as given; arrays and objects need `--json` and a JSON value of at most 65536 B with depth at most 16. The value then goes through `Sanitizer::sanitize_value()`. If the result differs from the parsed input, the command exits 1 and prints the sanitized value, except for `html_map` and `css` values, where it prints a warning and saves.
- Locked paths: exit 1, "Locked by site configuration".
- `<file>` for `import`: `-` reads STDIN; otherwise the path must not contain `://`, must resolve with `realpath()`, be a regular readable file and at most 262144 B.
- `--file` for `export`: same `://` rule, refuses to overwrite without `--force`, writes through `WP_Filesystem` direct method; without `--file` it prints to STDOUT.
- `import` and `reset` without `--dry-run` or `--yes` show the change list and ask `WP_CLI::confirm()`.
- `--network`: multisite only, operates on network defaults; otherwise exit 1. Subsites are chosen with the standard `--url`.
- `access grant|revoke`: the role must exist (`get_role()`); `administrator` is refused for `revoke` of the admin capability since only the customer capability is changed.

Output: `set`, `import`, `reset` print the change list (`WP_CLI\Utils\format_items`, table Path, Before, After) then `WP_CLI::success()`. Nothing prints the update token, only `token: set` or `token: not set`.

Exit codes: 0 success; 1 invalid input, locked path, newer schema or failed check at the `--fail-on` level; `doctor` default `--fail-on=critical`.

`wp ka11y doctor` runs every check of section 7 and prints Status, Check, Result, Action. It makes no outbound HTTP request.

## 7. Site Health

`src/php/Health/Checks.php` (pure, returns `array{ id, status, label, description, actions }`) and `src/php/Health/SiteHealth.php` (adapters for `site_status_tests` direct tests and `debug_information`). Registered only in admin. No check makes a network request.

| Id | Status when it fails | Check |
| --- | --- | --- |
| `kotlinskidev_a11y_build_files` | critical | `kotlinskidev_a11y_missing_files()` is empty and every file in `Manifest::data()` exists |
| `kotlinskidev_a11y_update_source` | recommended | updater enabled; source repository is `https`; last PUC check (from the checker's update state) is under 48 h old and has no error. Shows the source host, never the URL query or credentials. Skipped on subsites and when the updater is disabled. |
| `kotlinskidev_a11y_optimizer_conflicts` | recommended | for each optimizer detected by constant (`WP_ROCKET_VERSION`, `LSCWP_V`, `JETPACK_BOOST_VERSION`, `WPACU_PLUGIN_VERSION`) or by the Cloudflare plugin (`CLOUDFLARE_PLUGIN_DIR`), the matching `performance.optOut` entry is on or the preset is `compatibility`. Autoptimize (`AUTOPTIMIZE_PLUGIN_VERSION`) gets an advisory to exclude `kotlinskidev-accessibility` scripts from aggregation. |
| `kotlinskidev_a11y_page_cache_language` | recommended | when two or more locales are known (`SettingsPage::locales()`) and a page cache is likely (`WP_CACHE` true or `wp-content/advanced-cache.php` exists): passes only when something hooks `kotlinskidev_a11y_cache_invalidated`; the text reminds that the cache must vary per language. Single-language sites pass. |
| `kotlinskidev_a11y_locked_settings` | recommended | `Repository::lock_errors()` is empty |
| `kotlinskidev_a11y_panel_data_store` | recommended | the uploads folder `kotlinskidev-a11y` is writable, else panel data falls back to REST |

Debug section `kotlinskidev-accessibility` (all `private` false except the source host, which is `private` true): plugin version, schema version, update channel and whether a constant sets it, updater enabled, source host, token set yes or no, network defaults active, locked paths (list), customer capability and the roles that have it, strategy, page CSS, storage mode, keep data on uninstall.

## 8. Updates

### 8.1 Channels

`Update/Channel.php` resolves the channel (D1). `Updater::register()`:

- returns `null` when `KOTLINSKIDEV_A11Y_DISABLE_UPDATER` is true or `apply_filters( 'kotlinskidev_a11y_enable_updater', true )` is false;
- for `beta`, calls the PUC v5 GitHub API release filter so prereleases are included (`setReleaseFilter` or `setReleaseVersionFilter` with the all-releases type; confirm the exact names against the upstream PUC README for the locked version, never by opening `vendor/`), with `^\d+\.\d+\.\d+(-(beta|rc)\.\d+)?$`;
- for `stable`, keeps today's latest-release behaviour.

Version order uses `version_compare()`: `1.0.0-beta.1` < `1.0.0-rc.1` < `1.0.0`; `UpdaterTest` proves it. Switching from beta back to stable never downgrades; the site waits for the next stable release that is newer. Changing the channel deletes PUC's cached update state so the next check uses the new channel.

### 8.2 Release notes in the update window

PUC shows the GitHub release body as the Changelog in "View details". The release workflow sets the body from `CHANGELOG.md`:

- new `bin/release-notes.mjs <version>` prints that version's section (heading excluded), failing when it is missing or empty; unit test in `tests/js/release-notes.test.ts`;
- `softprops/action-gh-release` gets `body_path: dist/release-notes.md` instead of `generate_release_notes: true`, and `prerelease: ${{ contains(github.ref_name, '-') }}`.

`bin/lib-version.mjs`: `SEMVER` and `CHANGELOG_HEADING` accept `-(beta|rc).N`. `bin/release.mjs` gains `--pre beta|rc` (for example `1.0.0-beta.1`, then `--pre beta` again gives `beta.2`, a plain `--major` from a prerelease gives `1.0.0`). `check-version` tests cover each case.

### 8.3 SHA-256 and provenance

Release workflow, after the zip is built:

- `sha256sum kotlinskidev-accessibility.zip > kotlinskidev-accessibility.zip.sha256` and upload both assets;
- `actions/attest-build-provenance` (pinned to a commit SHA) with `subject-path: dist/kotlinskidev-accessibility.zip`; job permissions `contents: write`, `id-token: write`, `attestations: write`;
- all actions in `release.yml` pinned by commit SHA.

On the site, `Update/PackageVerifier.php` hooks `upgrader_pre_download` (admin only). When `$hook_extra['plugin']` is this plugin's basename, or the request is a rollback from section 8.4, it downloads the package with `download_url()`, fetches the matching `.sha256` asset from the same release, compares with `hash_equals()`, and returns the local file or `WP_Error` `kotlinskidev_a11y_checksum_mismatch`. A missing `.sha256` asset blocks rollback and only logs a Site Health note for normal updates (older releases have none).

What this protects: corrupted or swapped downloads between GitHub and the site. It does not protect against a compromised GitHub account, since the hash comes from the same release. Provenance covers that out of band: the README documents `gh attestation verify kotlinskidev-accessibility.zip --repo Kotlinski95/kotlinskidev-accessibility-plugin`. The plugin does not verify Sigstore bundles in PHP (no new runtime dependency).

### 8.4 Rollback

`Update/Rollback.php` and `Rest` route `GET /releases`:

- Candidates: GitHub API `GET https://api.github.com/repos/<owner>/<repo>/releases?per_page=30` (owner and repo parsed from the update source; only `github.com` sources are supported by default), with the token filter as `Authorization` when set, `timeout` 10, cached in site transient `kotlinskidev_a11y_releases` for 12 h. Kept: releases with the `kotlinskidev-accessibility.zip` asset, version below the installed one and at least `0.4.0`, prereleases only on the beta channel, newest 3. Other sources supply the list through `kotlinskidev_a11y_rollback_releases` (array of `{ version, package, sha256_url }`, each URL `https` only).
- Action: a hidden admin page `kotlinskidev-a11y-rollback` (registered on `admin_menu` for single site, `network_admin_menu` for multisite, capability `update_plugins`), `GET` with `version` (regex `^\d+\.\d+\.\d+(-(beta|rc)\.\d+)?$`) and nonce `kotlinskidev_a11y_rollback_<version>`. It first shows a confirmation screen ("Roll back to X. Settings stay. Features added after X stop working.") with a POST form; the POST checks the nonce again, writes `kotlinskidev_a11y_settings_backup`, and runs `Plugin_Upgrader( new Plugin_Upgrader_Skin(...) )->install( $package, array( 'overwrite_package' => true ) )`. The package URL is always taken from the server-side candidate list for that version, never from the request.
- After a rollback the older version reads the sparse option (section 3.2). The backup lets the owner restore with `wp option get kotlinskidev_a11y_settings_backup` and the import route once back on v1.0.

## 9. Multisite network defaults

- Network admin page Settings > Accessibility (`network_admin_menu`, `settings.php` parent, capability `manage_network_options`). It mounts the same admin app with `config.scope = 'network'` and `restRoot` pointing at `/network/`. Tabs are the same; the Maintenance tab shows "Locked on all sites" (a text list of paths, validated against the schema) and the Updates card.
- Network settings are stored as `{ "schemaVersion": 5, "settings": { sparse tree }, "locked": [paths] }` and sanitized with the same `Sanitizer`. Lock values come from the network settings at that path, or the schema default.
- Subsite admins see inherited values as "Network default" and locked fields disabled. Subsite reset returns to network defaults.
- Saving network settings fires `kotlinskidev_a11y_cache_invalidated` with `settings` once on the main site only; owners with per-site caches hook it themselves. Documented in README.
- Not activated network-wide: network defaults still apply to every site where the plugin is active.

## 10. wordpress.org guidelines and security

### 10.1 Guidelines (kept even though distribution is GitHub)

| Guideline | How Phase 6 complies |
| --- | --- |
| 1, GPL | Every dependency GPL-compatible (PUC MIT, icons ISC). No new runtime dependency. |
| 4, readable code | Built files are minified, source is public; README links the repository and `npm run build`. |
| 7, no tracking without consent | No telemetry. Update checks are server-to-GitHub only and documented in the privacy text. `doctor` and Site Health send nothing. |
| 8, no executable code from third parties | Updater and rollback are GitHub-only and switchable off with `KOTLINSKIDEV_A11Y_DISABLE_UPDATER` (D9). Plugin Check keeps excluding only `plugin_updater` and `plugin_readme`. |
| 11, no admin hijacking | No new global notices. Site Health and the Maintenance tab hold everything new. |
| Prefixes, uninstall | All new options, hooks, capability and commands use `kotlinskidev_a11y`, `ka11y` or `KOTLINSKIDEV_A11Y`. Uninstall cleans everything it created unless the owner keeps data. |

### 10.2 Security rules

| Surface | Capability | Nonce or auth |
| --- | --- | --- |
| Site settings REST | admin capability; customer subset (section 5) | `wp_rest` cookie nonce |
| Network REST | `manage_network_options` | `wp_rest` |
| `/releases`, `/update-channel`, rollback page | `update_plugins` | `wp_rest`; rollback `kotlinskidev_a11y_rollback_<version>` on GET and POST |
| WP-CLI | shell user, still fully validated (section 6) | none |
| Site Health | core `view_site_health_checks` | core |

- Inputs are validated by REST `args` and the schema; no `$_GET` or `$_POST` read without `sanitize_text_field( wp_unslash() )` and a pattern check.
- Outbound requests: only `api.github.com` and the release asset URLs it returns, or a filtered `https` source; `wp_safe_remote_get` for lists; `download_url` for packages.
- Secrets: the update token stays filter-only and is never stored, exported, logged, shown in Site Health, `doctor` or error messages. Exports and backups hold settings only.
- Output escaping: every new PHP output uses `esc_html`, `esc_attr`, `esc_url`; admin TS builds DOM with `h()` and `textContent`, never `innerHTML`.
- `kd-web:security-reviewer` reviews M6.1, M6.3, M6.4 and M6.7 before merge.

## 11. Uninstall and privacy

`uninstall.php`, per site (inside the existing `switch_to_blog` loop): read `get_option( 'kotlinskidev_a11y_settings' )['maintenance']['keepDataOnUninstall']` raw (no autoloader). When `true`, skip that site. Otherwise delete as today plus `kotlinskidev_a11y_settings_backup`, the perf-notice user meta (`delete_metadata( 'user', 0, 'kotlinskidev_a11y_perf_notice_dismissed', '', true )`, once) and the customer capability from every role. Network data (`kotlinskidev_a11y_network_settings`, `kotlinskidev_a11y_update`, site transient `kotlinskidev_a11y_releases`, PUC state option for the slug) is deleted unless the main site keeps data. `UninstallTest` covers keep and delete on single site and multisite.

Privacy: `src/php/Admin/Privacy.php` calls `wp_add_privacy_policy_content( 'Kotlinskidev Accessibility', $text )` on `admin_init`. Text (translatable, `wp_kses_post`):

- The widget saves visitor choices on the visitor's device only (`localStorage` key `<storage.key>`, `<storage.key>-locale`, or a first-party cookie with the configured lifetime when the cookie mode is on). Nothing is sent to the site or to third parties.
- No tracking, analytics or profiling.
- The server checks for plugin updates at github.com; these requests come from the server, contain no visitor data, and carry the site address in the standard WordPress user agent.
- Suggested wording for consent tools: the storage is strictly necessary to honour an explicit preference; `storage.mode = none` stores nothing.

No personal data exporter or eraser is needed because nothing is stored per person on the server; the README states that.

## 12. Maintenance

- `SECURITY.md` (repo root, kept out of the zip by `.distignore`): supported versions (latest minor; previous minor for 90 days after a new minor), private reporting through GitHub Security Advisories, response within 7 days, fix target 30 days, no bug bounty.
- CodeQL: add `actions` to the languages matrix (workflow injection checks). PHP is not supported by CodeQL; PHP stays covered by PHPStan, WPCS security sniffs and Plugin Check.
- Dependabot: keep the weekly groups; split npm into `production` and `development` groups; `ignore` semver-major updates of `yahnis-elsts/plugin-update-checker` (a major needs the Updater reviewed by hand).
- CI: add `composer audit` and `npm audit --omit=dev --audit-level=high` to the CI jobs; pin all third-party actions by commit SHA.
- Deprecation policy (new `docs/DEPRECATION.md`, linked from `docs/API.md`): from v1.0 the plugin follows semver. Frozen contracts (CLAUDE.md and section 1) change only in a major. Settings paths: a removed or renamed path keeps a migration forever and is read for one major. PHP hooks: `_deprecated_hook()` for one minor, removal in the next major. JS API: the existing one-minor rule with `console.warn`. CLI: deprecated flags print `WP_CLI::warning()` for one minor. Every deprecation gets a `Deprecated` CHANGELOG entry.
- Upgrade tests (section 13.3) run nightly and on release tags.
- Visual baselines (HANDOFF gap, PHASE5-PARITY P11 and P7): generate Linux baselines in the Playwright Docker image, add the Skip card baseline with three landmarks, then run `@visual` in CI. The macOS baselines stay for local runs.

## 13. Test plan

### 13.1 PHPUnit (`tests/php`)

- `Settings/RepositoryTest`: layer order; sparse save; `strip_defaults` migration keeps effective values; v0.4 read of a v5 tree; `effective_defaults` with and without network; reset with prefixes; invalidation fires only on effective change.
- `Settings/LocksTest`: constant beats filter beats network; invalid path, `schemaVersion`, invalid value go to `lock_errors`; locked paths never stored.
- `Settings/ImporterTest`: envelope, legacy tree with version 1 to 4 (fixtures exported from each tag), missing version, newer schema 409, wrong scope 400, `dropped`, `adjusted`, `locked`.
- `Rest/SettingsControllerTest`: `dry_run` saves nothing; 409 locked; 413 size; reset `paths` validation; export envelope; customer GET subtree and 403 on forbidden paths; network routes absent on single site and 403 without `manage_network_options`.
- `Admin/AccessTest`: levels, filter narrows only, menu capability per level.
- `Cli/SettingsCommandTest`, `DoctorCommandTest`, `AccessCommandTest` with a `WP_CLI` stub in `tests/php/Cli/WpCliStub.php`: each validation rule in section 6, exit codes, no token in output.
- `Health/ChecksTest`: each check pass and fail, no HTTP call (`pre_http_request` asserts none).
- `Update/UpdaterTest`, `ChannelTest`, `PackageVerifierTest`, `RollbackTest`: disable constant and filter, channel precedence, version order, checksum match and mismatch, candidate filtering and floor, package URL never from the request, nonce and capability checks.
- `Uninstall/UninstallTest`: keep and delete, single and multisite, capability removal.
- `Admin/PrivacyTest`: text registered, mentions the configured storage key.
- `Frontend/PayloadGoldenTest`: section 2.

### 13.2 Jest (`tests/js`)

- `admin/search.test.ts`: index from `data-ka11y-path`, accent-insensitive match, result activation selects tab and focuses control, status count.
- `admin/change-preview.test.ts`: formatting of each value type, 50-row cap, warnings, no dialog without changes, focus return.
- `admin/import-export.test.ts` (extend): dry run then confirm, newer-version error shown.
- `admin/guard.test.ts`: change count text, dirty warning in import and reset confirms.
- `admin/api.test.ts` (extend): nonce refresh retries once, second failure keeps state.
- `admin/access.test.ts`: customer mode renders only editable fields and tabs.
- `admin/maintenance-panel.test.ts`: channel select disabled by constant, rollback links.
- `release-notes.test.ts`, `check-version.test.ts` (extend for prereleases).

### 13.3 Playwright

- `tests/e2e/admin-management.spec.ts`: search finds "z-index" and focuses it; per-tab reset with preview; save preview lists exactly the edited field; locked field (mu-plugin fixture `ka11y-fixture-locks.php` behind a query flag) is disabled and a forced REST post gets 409; unsaved guard on navigation; axe on the admin page with the dialog open.
- `tests/e2e/customer.spec.ts`: a user with role `editor` plus the capability sees only Languages and Appearance, saves a label, and a crafted REST post to `performance.strategy` gets 403.
- `tests/e2e/cli.spec.ts` through `support/wp-cli.ts`: `get`, `set` round trip, invalid value exit 1, `export` then `import --yes` keeps settings, `doctor --format=json` parses.
- `tests/e2e/upgrade.spec.ts` (tag `@upgrade`, nightly and on tags): for each version in `tests/fixtures/releases.json` (`0.1.1`, `0.1.2`, `0.1.3`, `0.2.0`, `0.3.0`, `0.4.0`): reset the site database, install that release zip (downloaded in CI with `gh release download` into an ignored folder; a tag without the asset is built from the tag), activate, load `tests/fixtures/settings/<version>.json` with `wp option update --format=json`, open the home page and turn on `highlightLinks` and `biggerText` level 2 in the panel, replace the plugin with the current build zip, load wp-admin once, then assert `wp ka11y settings get --format=json` equals `tests/fixtures/settings/<version>.expected.json` and the reloaded home page shows the same state classes and levels. This is the Phase 6 done-when.
- `tests/e2e/downgrade.spec.ts` (`@upgrade`): v1.0 build to v0.4.0 keeps effective settings on a single site.
- Multisite: `.wp-env.multisite.json` with `WP_ALLOW_MULTISITE` and `MULTISITE`, project `multisite` in `playwright.config.ts`, nightly only: network default reaches a subsite, a subsite override wins, a network lock disables the field.

### 13.4 Manual, once before v1.0

Rollback from beta.1 to v0.4.0 on a scratch wp-env site; beta channel offers beta.2; "View details" shows the CHANGELOG section; `gh attestation verify` passes on the beta.1 zip; Plugin Check green; screen reader pass (VoiceOver) over search, preview dialog and Maintenance tab.

## 14. Milestones

Agents: `kd-core:coder`, `kd-core:maker`, `kd-core:thinker`, `kd-web:security-reviewer`, `kd-web:accessibility-reviewer`, `kd-wp:wp-plugin-reviewer`, `widget-tester`. Each milestone runs the verify command from CLAUDE.md plus its listed checks and puts the `check-budget` output in its report. One e2e suite against one wp-env at a time.

### M6.1 Settings core: layers, sparse storage, locks, import envelope (kd-core:coder, then kd-web:security-reviewer)

Depends on: none.

Files: `src/php/Settings/Schema.php`, `Repository.php`, `Sanitizer.php` (no change expected), new `Settings/Importer.php`, `Settings/Locks.php`; `src/php/Rest/SettingsController.php`; `src/php/Cache/VersionWatcher.php`; `tests/php/Settings/*`, `tests/php/Rest/SettingsControllerTest.php`, `tests/php/Frontend/PayloadGoldenTest.php`, `tests/fixtures/golden/*`, `tests/fixtures/settings/*` (exports from each tag); `.github/workflows/ci.yml` (front-end diff guard).

Acceptance: 13.1 settings, locks, importer, REST and golden cases green; golden files captured before the first code change; `check-budget` identical to v0.4.0.

Rollback: revert. v0.4 code reads the sparse option correctly (proved by test), so sites that saved in between keep their values.

### M6.2 Admin management UX (kd-core:coder, then kd-web:accessibility-reviewer)

Depends on: M6.1.

Files: `src/ts/admin/search.ts`, `change-preview.ts`, `panels/maintenance.ts` (uninstall card only here) (new); `dom.ts` (`data-ka11y-path`, locked state), `context.ts`, `app.ts`, `api.ts`, `guard.ts`, `save-bar.ts`, `import-export.ts`, `panels/import-export.ts`, `form-renderer.ts`, `types.ts`; `src/scss/admin/*` (search, preview table, found highlight); `bin/budgets.json` and `bin/check-budget.mjs` (`scripts.admin` only); Jest files from 13.2; `tests/e2e/admin-management.spec.ts`.

Acceptance: 13.2 admin cases and the admin e2e green; axe clean; `scripts.admin` within D10.

Rollback: revert; M6.1 REST stays backward compatible with the v0.4 admin.

### M6.3 Customer capability (kd-core:coder, then kd-web:security-reviewer)

Depends on: M6.1, M6.2 (context helpers).

Files: `src/php/Admin/Access.php` (new), `Admin/SettingsPage.php`, `Rest/SettingsController.php`, `src/ts/admin/form-renderer.ts`, `context.ts`, `types.ts`; `tests/php/Admin/AccessTest.php`, `tests/js/admin/access.test.ts`, `tests/e2e/customer.spec.ts`.

Acceptance: customer cases in 13.1 to 13.3; reviewer confirms no non-editable path can change through any route.

Rollback: revert; the capability stays on roles harmlessly until uninstall or `wp ka11y access revoke`.

### M6.4 Health checks and Site Health (kd-core:coder)

Depends on: M6.1.

Files: `src/php/Health/Checks.php`, `Health/SiteHealth.php` (new), `Plugin.php`; `tests/php/Health/ChecksTest.php`.

Acceptance: every check pass and fail covered with no HTTP; Tools > Site Health in wp-env lists the six tests and the debug section without the token.

Rollback: revert.

### M6.5 WP-CLI (kd-core:coder, then kd-web:security-reviewer)

Depends on: M6.1, M6.3 (`access`), M6.4 (`doctor`).

Files: `src/php/Cli/SettingsCommand.php`, `DoctorCommand.php`, `AccessCommand.php` (new), `Plugin.php`; `tests/php/Cli/*`; `tests/e2e/cli.spec.ts`; README section "WP-CLI".

Acceptance: 13.1 CLI cases and `cli.spec.ts` green; `wp help ka11y settings` shows synopsis for every subcommand.

Rollback: revert; nothing else depends on the commands except the upgrade test (M6.8).

### M6.6 Multisite network defaults (kd-core:coder, then kd-wp:wp-plugin-reviewer)

Depends on: M6.1, M6.2.

Files: `src/php/Admin/NetworkSettingsPage.php` (new), `Rest/NetworkSettingsController.php` (new), `Settings/Repository.php` (network layer wiring), `src/ts/admin/index.ts` (scope), `panels/maintenance.ts` (network locks), `.wp-env.multisite.json`, `playwright.config.ts` (`multisite` project), multisite e2e, `tests/php/Rest/NetworkSettingsControllerTest.php`.

Acceptance: network cases in 13.1 and 13.3; single-site behaviour unchanged (golden test still green).

Rollback: revert; stored network option is ignored by single-site code paths.

### M6.7 Updates: channels, notes, checksums, provenance, rollback (kd-core:coder, then kd-web:security-reviewer)

Depends on: M6.2 (Maintenance tab), M6.4 (update-source check).

Files: `src/php/Update/Updater.php`, `Channel.php`, `PackageVerifier.php`, `Rollback.php` (new), `src/php/Admin/RollbackPage.php` (new), `Rest/UpdateController.php` (new, `/releases` and `/update-channel`), `src/ts/admin/panels/maintenance.ts` (Updates card), `bin/release-notes.mjs` (new), `bin/lib-version.mjs`, `bin/release.mjs`, `.github/workflows/release.yml`; `tests/php/Update/*`, `tests/js/release-notes.test.ts`, `tests/js/check-version.test.ts`; README "Updates on customer sites" and "Verifying a release".

Acceptance: 13.1 update cases; dry run of `release.yml` on a fork or with `act` produces the zip, `.sha256` and attestation; owner uploads the v0.4.0 `.sha256` (D8).

Rollback: revert; the updater falls back to v0.4 behaviour. Extra release assets are harmless.

### M6.8 Maintenance and upgrade tests (kd-core:coder, then widget-tester)

Depends on: M6.5 (`wp ka11y settings get` in the upgrade test).

Files: `SECURITY.md`, `docs/DEPRECATION.md` (new), `docs/API.md` (link), `.github/workflows/codeql.yml`, `.github/dependabot.yml`, `.github/workflows/ci.yml`, `.github/workflows/nightly.yml` (`@upgrade`, multisite, `@visual` on Linux), `.distignore` (`SECURITY.md`), `tests/e2e/upgrade.spec.ts`, `tests/e2e/downgrade.spec.ts`, `tests/fixtures/releases.json`, `tests/fixtures/settings/*.expected.json`, Linux baselines under `tests/e2e/__screenshots__/linux/`, Skip card baseline.

Acceptance: `@upgrade` green for all six versions; `@visual` green in CI on Linux; CodeQL runs both languages.

Rollback: revert workflow and test files only.

### M6.9 Uninstall, privacy, docs, translations (kd-core:coder for PHP, then kd-core:maker for docs and translations)

Depends on: M6.1 to M6.8.

Files: `uninstall.php`, `src/php/Admin/Privacy.php` (new), `Plugin.php`, `tests/php/Uninstall/UninstallTest.php`, `tests/php/Admin/PrivacyTest.php`; `languages/*` (pot, pl_PL po, mo, json); `README.md` (WP-CLI, locks, customer capability, multisite, channels, rollback, verifying releases, privacy, uninstall); `docs/API.md` (REST table, hooks); `CHANGELOG.md`; `docs/ROADMAP.md`; `docs/HANDOFF.md`.

Acceptance: `msgfmt --statistics` shows no untranslated strings; `kd-wp:wp-plugin-reviewer` and Plugin Check green with only the existing exclusions.

Rollback: revert; uninstall falls back to delete-all.

### M6.10 Release v1.0.0-beta.1, then v1.0.0 (kd-core:maker)

Depends on: M6.9 and owner approval.

Steps in section 15.

## 15. Release plan to v1.0

1. All milestones merged; verify command, `@smoke`, `@upgrade`, multisite and `@visual` green; `check-budget` identical to v0.4.0 for the front end.
2. Owner uploads `kotlinskidev-accessibility.zip.sha256` to the v0.4.0 release (D8).
3. `npm run release -- --major --pre beta` gives `1.0.0-beta.1`; `npm run check-version`; commit `chore: release v1.0.0-beta.1`; tag and push only when the owner asks. The workflow publishes a prerelease with notes, checksum and attestation.
4. Owner switches the channel to Beta on the kotlinskidev site, updates, and runs `wp ka11y doctor` and the manual list in 13.4. 7 days soak (D11). Bugs go into beta.2 and restart the soak.
5. `npm run release -- --major` gives `1.0.0`; CHANGELOG `[1.0.0]` lists everything since 0.4.0; `docs/API.md` API changelog row for 1.0.0; commit `chore: release v1.0.0`, tag, push when asked.
6. After release: remove the front-end diff guard from CI, set the rollback floor review for the next minor, update HANDOFF "Where we are".

## 16. Risks

| Risk | Mitigation |
| --- | --- |
| Sparse storage changes effective values on some site | `strip_defaults` compares with schema defaults only; golden and upgrade tests; downgrade test. |
| A lock bricks a setting the owner needs | Locks are code; Site Health lists them; `wp ka11y settings get --layer=stored` shows the hidden value. |
| PUC method names differ for prerelease filtering | Confirm from the upstream README of the locked version in M6.7; fallback is a `puc_request_info_result-<slug>` filter that picks the newest matching release. |
| GitHub API rate limit for the rollback list (60 per hour unauthenticated) | 12 h site transient; the list is fetched only when the Maintenance tab opens. |
| Rollback to v0.4.0 leaves locks and network defaults unenforced | Confirmation screen says so; settings backup written first. |
| Customer capability granted to a broad role | `access list` and Site Health debug show the roles; the editable list can only narrow. |
| Admin bundle grows past D10 | Search and preview share `confirm-dialog.ts` and `h()`; no new libraries. |
| Upgrade tests depend on GitHub downloads in CI | Cache downloaded zips by tag; build from the tag when the asset is missing. |
