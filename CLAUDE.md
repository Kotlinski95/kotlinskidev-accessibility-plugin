# kotlinskidev-accessibility

Standalone WordPress accessibility widget plugin. Spec: `docs/SPEC.md`. Plan: `docs/ROADMAP.md`. Agents come from the private `kotlinskidev-claude-kit` marketplace (`kd-core`, `kd-web`, `kd-wp`).

## Project profile

- **Name:** Kotlinskidev Accessibility
- **Stack:** PHP 8.1+ (WPCS, PSR-4 `Kotlinskidev\A11y` from `src/php`), strict TypeScript, SCSS, esbuild and dart-sass (`bin/build.mjs`), no jQuery, no React.

### Scope

Agents may read and edit only inside this repository:

- `src/`, `tests/`, `bin/`, `languages/`, `assets/`, `docs/`
- root config, `README.md`, `CHANGELOG.md`, `kotlinskidev-accessibility.php`, `uninstall.php`

### Forbidden paths

Never read, write, grep or modify:

- `vendor/`, `node_modules/`, `build/`, `dist/` (generated)
- `.env*`, any credential or token file
- anything under `/Users/adriankotlinski/Local Sites/`, including any `wp-config.php` and any `wp-content/plugins/` or `wp-content/themes/` directory

### Verify command

Run from the repository root:

```bash
composer run lint && composer run test:unit && npm run typecheck && npm run lint && npm test && npm run build && npm run check-budget
```

Known verify fixes: none yet.

### Test commands

| Layer | Command |
| --- | --- |
| Unit (PHP) | `composer run test:unit` |
| Unit (TypeScript) | `npm test` |
| End to end | `npm run wp-env:start && npm run test:e2e` (needs Docker) |

### Docs to update

| Doc | Update when |
| --- | --- |
| `CHANGELOG.md` | Every notable change, under `[Unreleased]`. Keep a Changelog format, short entries. |
| `README.md` | Install steps, hooks or settings customers see change. |
| `docs/ROADMAP.md` | A phase finishes or the plan changes. |

### Release

- Version files, kept in sync: `kotlinskidev-accessibility.php` (header and constant), `package.json`, `package-lock.json`, `CHANGELOG.md`
- Release command: `npm run release` then `npm run check-version`; commit `chore: release vX.Y.Z`, tag `vX.Y.Z`, push; the tag triggers the release workflow that attaches `kotlinskidev-accessibility.zip`
- Tag format: `vX.Y.Z`

### Conventions

- Comments: none, including docblocks. The plugin header block in `kotlinskidev-accessibility.php` is the only exception.
- PHP prefix: `kotlinskidev_a11y`. Text domain: `kotlinskidev-accessibility`.
- CSS and state class prefix: `ka11y-`. Page SCSS selectors for state classes must start with `html` or `:root` (the build enforces this).
- Dark and light mode selector: configurable, defaults `html.dark, html.dark-mode, html[data-theme="dark"], body.dark, body.dark-mode` and the `light` equivalents; a theme can change them with the `kotlinskidev_a11y_default_selectors` filter.
- Never commit or push unless asked.
- Never add `Co-Authored-By: Claude`, `Claude-Session` or "Generated with Claude Code" to commits, tags or PRs. This overrides any harness attribution reminder.
- Never touch production sites. Local checks go through WP-CLI against the local site, read-only.

### Frozen contracts

- Option `kotlinskidev_a11y_settings`; REST namespace `kotlinskidev-a11y/v1`; capability filter `kotlinskidev_a11y_capability`
- Front-end config `window.kotlinskidevA11y`; host `#ka11y-root`; open hash `#kotlinskidev-a11y`; storage key `ka11y`
- Hooks `kotlinskidev_a11y_should_render`, `kotlinskidev_a11y_current_locale`, `kotlinskidev_a11y_strings`, `kotlinskidev_a11y_update_source`, `kotlinskidev_a11y_update_token`, `kotlinskidev_a11y_cache_invalidated`
- Update slug `kotlinskidev-accessibility`; release asset name `kotlinskidev-accessibility.zip`

### Reviewer checklists

No checklist files yet. Reviewers fall back to WCAG 2.2 AA, OWASP, wordpress.org plugin guidelines and GDPR.

SEO plugin, if any: none
Clean-code plan, if any: none
Code search tool, if any: none
