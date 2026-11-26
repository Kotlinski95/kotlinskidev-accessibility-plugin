# Deprecation policy

From v1.0 the plugin follows semantic versioning. This policy applies to everything documented in `docs/API.md` and to the frozen contracts in `CLAUDE.md`.

## Rules

- Additive changes (a new action, event, method, field, hook, setting or flag) ship in any minor release.
- A deprecated item keeps working for one more minor release, then is removed. Frozen contracts and removals of settings paths change only in a major release.
- Every deprecation gets a `Deprecated` entry in `CHANGELOG.md`, a note in `docs/API.md` where the item is documented, and the runtime notice below.

## By surface

| Surface | Notice | Removal |
| --- | --- | --- |
| JavaScript API and `data-ka11y` actions | One `console.warn('[kotlinskidev-a11y] deprecated: ...')` per page view per item | Next minor, per `docs/API.md` |
| PHP hooks and functions | `_deprecated_hook()` or `_deprecated_function()` | Next major |
| Settings paths | A removed or renamed path keeps its migration forever and is still read for one major | A major |
| WP-CLI commands and flags | `WP_CLI::warning()` naming the replacement | Next minor |
| REST routes and fields | Documented in `docs/API.md` and the changelog; the old shape stays for one minor | Next minor |
| Frozen contracts (option name, REST namespace, global, host, hash, hook names, update slug, asset name) | None: they change only in a major | A major |

## Current deprecations

None.
