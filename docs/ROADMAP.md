# Roadmap: v0.1.2 to v1.0

Follows `SPEC.md`. Each phase ends with a release or a merged PR, and each has a done-when check.

## Measured baseline (v0.1.1 on kotlinskidev.local)

| Item | Today | Target |
| --- | --- | --- |
| JS on every page | 39.2 KB raw, 13.8 KB gzip | loader at most 2 KB gzip |
| Render-blocking CSS | `frontend.css`, 1.6 KB gzip | 0 |
| Inline config in HTML | 7.9 KB | at most 1.5 KB |
| Panel DOM | built at boot on every page | built on first open |
| OpenDyslexic, 115 KB | loads only when switched on | keep |

Other findings:

- Root class collision. `_color-orientation-overlays.scss` styles `.ka11y-reading-mask` and `.ka11y-reading-line` without scoping, and the applier adds the same class names to `<html>`. The page root becomes `position: fixed; pointer-events: none`. Affected: `readingMask`, `readingLine`, and the `adhdFriendly` profile. The other features and profiles passed the same root-style check; `<html>` was the only element checked. Removing the class from `<html>` restored the page.
- The broken state is saved, and the bootstrap reapplies it on reload, so the visitor stays locked.
- Asset CleanUp rewrites the plugin files into `wp-content/cache/asset-cleanup/`. Lazy chunks must use an absolute base URL from config, not a path relative to the script.
- The panel declares `aria-modal="true"` and traps Tab, but the page behind stays clickable. The semantics and the behaviour disagree.
- Device visibility is CSS only, so a device where the widget is hidden still downloads all JS.

## Phase 0: hotfix, v0.1.2

1. Rename the overlay classes to `ka11y-overlay ka11y-overlay--mask-top|mask-bottom|line`. Keep the `<html>` state classes.
2. Add a build check that fails when a page SCSS selector starts with a bare `.ka11y-<feature>` state class.
3. Keep the mask hidden until the first pointer move or touch. Keep the cookie banner above the mask through `advanced.excludeSelectors`.
4. Add recovery URLs: `?ka11y=reset` clears saved state before paint, `?ka11y=off` disables the widget for that page view. Handle both in the bootstrap.
5. Show an admin notice when `vendor/` or `build/` is missing. Remove the silent early return.
6. Check that the auto-update toggle appears on the Plugins screen. If not, fix `Updater`.

Done when: an e2e test turns on every feature and profile, then proves scroll, click and reset work, including after a reload.

## Phase 1: shared agent kit

Repo `kotlinskidev-claude-kit` (private), a Claude Code marketplace with three plugins.

| Plugin | Contents |
| --- | --- |
| `kd-core` | planner, thinker, coder, maker, orchestrator, code-reviewer, clean-code-refactorer; skills verify, review-changes, sync-docs, write-tests, clean-code |
| `kd-web` | performance, accessibility, SEO, security, legal reviewers and site-audit-orchestrator; skills for TypeScript, SCSS, testing, GSAP, Storybook |
| `kd-wp` | skills for PHP, WordPress plugins, block themes, i18n, security headers, release; agent `wp-plugin-reviewer` |

Stays in the theme repo: `php-patterns` rule, `push-page`, `theme-lint.sh` hook, `clean-code-plan`, `treeview` details, kotlinskidev design tokens, memory notes.

Design rules:

- Agents hold no project facts. Each repo's `CLAUDE.md` gets a `## Project profile`: scope, forbidden paths, verify command, test commands, docs to update. Agents read it first.
- Do not copy the WordPress `wp-*` skills. Install them from their upstream source.
- Plugin agents are namespaced (`kd-core:coder`). Update the orchestrator and every cross-reference.
- Confirm with the Claude Code docs whether a plugin can ship path-scoped rules. If not, ship the five rules as skills.
- Enable per repo through `extraKnownMarketplaces` and `enabledPlugins` in `.claude/settings.json`.
- Pin kit versions, keep a changelog, and add a few `claude plugin eval` cases.

Plugin repo only: `widget-tester` agent, `onetap-parity-reviewer` agent, `CLAUDE.md` with its profile.

Migration: build the kit, enable it in the plugin repo, use it for Phase 2, then switch the theme. Delete theme copies only after the theme passes `/verify` with the kit.

Done when: `kd-core:coder` edits the plugin repo, and the theme still passes `/verify`.

## Phase 2: test harness

Layers:

1. Unit: keep Jest and PHPUnit. Add PHPStan and WordPress Plugin Check.
2. Page invariants (Playwright), run for every feature, every level and every profile: root computed styles unchanged except allowed ones, scroll works, a link and a form field work, no large element takes pointer events, Escape restores focus, reset restores the DOM, reload keeps the page usable, no console errors, no serious axe issues.
3. Combinations: pairwise set of features, not the full product.
4. Fixtures: stock theme, plus a hostile fixture theme (transformed wrapper, sticky header, `overflow: clip`, modal, cookie wall, carousel, iframe, 5000 nodes). Real themes run locally, not in CI.
5. Visual snapshots: panel, launcher, each profile; light and dark; desktop and mobile; EN, PL and one RTL locale.
6. Compatibility: Asset CleanUp, Super Page Cache, delay-JS, Polylang, strict CSP.
7. Matrix: minimum and latest WordPress, PHP 8.1 to latest; Chromium on PRs, WebKit and Firefox nightly.
8. Manual once per minor release: VoiceOver and NVDA script.

Done when: reverting the Phase 0 fix makes the suite fail.

## Phase 3: loading and performance, v0.2.0

Status: done, released as v0.2.0. Spec: [PHASE3-SPEC.md](PHASE3-SPEC.md).

Architecture:

- `bootstrap` (inline, under 1 KB): restores state, handles recovery URLs.
- `loader` (at most 2 KB gzip): launcher click, shortcut, triggers, public API queue.
- `panel` chunk: loads on first open, prefetched on hover or focus.
- `feature` chunks: load on first use. CSS for a feature travels with its chunk.
- Strings: versioned cacheable JSON per locale, fetched with the panel.

A visitor with saved state always loads the active features at once, whatever the strategy.

Settings, under a new Performance tab:

| Setting | Values | Default |
| --- | --- | --- |
| Strategy | interaction, idle, defer, async, eager | interaction |
| Position | head, footer | footer |
| Fetch priority | low, auto, high | low |
| Where to load | everywhere, only on, except on (post, type, template, role, URL pattern) | everywhere |
| Devices | skip the download where the widget is hidden | on |
| Panel prefetch | none, hover, idle | hover |
| Page CSS | lazy, linked, inline | lazy |
| Optimizer opt-out | attributes for Cloudflare, WP Rocket, LiteSpeed | off |

Use native `fetchpriority` script arguments on WordPress 6.9 and later, and a script attribute filter on older versions. Presets Recommended, Compatibility and Custom keep this simple for customers. The admin shows the resulting cost per page.

Done when: a CI size budget enforces the targets, and Lighthouse shows no change in LCP, CLS and TBT between widget on and off.

## Phase 4: triggers and public API, v0.3.0

Status: done, release v0.3.0 pending. Spec: [PHASE4-SPEC.md](PHASE4-SPEC.md). Public API: [API.md](API.md).

One action vocabulary: `open`, `close`, `toggle`, `reset`, `feature:<key>[:<level>]`, `profile:<key>`, `statement`, `hide`, `show`.

| Surface | Example |
| --- | --- |
| Link hash | `#kotlinskidev-a11y`, `#ka11y/profile:adhdFriendly` |
| URL query | `?ka11y=open` |
| CSS class | `.ka11y-open`, plus a custom selector list in settings |
| Data attribute | `<button data-ka11y="feature:darkContrast">` |
| JavaScript | `kotlinskidevA11y.open()`, `.set()`, `.toggle()`, `.reset()`, `.getState()`, `.on()` |
| Events | `ka11y:ready`, `ka11y:open`, `ka11y:close`, `ka11y:change` |
| Shortcode | `[kotlinskidev_a11y_button action="open" label="..."]` |
| Block | Accessibility trigger, for the editor and navigation |
| PHP | `kotlinskidev_a11y_button()` and documented filters |

- Commands sent before load are queued, then replayed.
- Unknown actions are ignored. URL actions are allowlisted, never saved, and limited to enabled features.
- Triggers get `aria-expanded`, `aria-controls` and `aria-pressed` automatically. Links get `role="button"` and Space key support.
- Focus returns to the trigger that opened the panel.
- Launcher mode: `floating`, `inline` (mount in a selector), `hidden`. With `hidden`, the keyboard shortcut stays on, and the admin warns when no trigger is found on the home page.
- The admin has a snippet generator with copy buttons and a preview.
- The API is versioned and documented in `docs/API.md`. Deprecations last one minor release.

A "+" quick-actions menu is not part of this plugin. Themes build it on this API. Contact links do not belong in an accessibility plugin.

Phase 4b (a quick-actions block in a theme repo) is outside this plugin and uses the public API in `docs/API.md`.

Done when: an e2e page with one trigger of each kind passes keyboard and screen reader checks, with the launcher hidden and under every load strategy.

## Phase 5: UI parity, v0.4.0

Status: done, released as v0.4.0. Spec: [PHASE5-SPEC.md](PHASE5-SPEC.md). Parity review and follow-ups: [PHASE5-PARITY.md](PHASE5-PARITY.md).

1. Run OneTap in a separate wp-env site. Capture screens, video, timings, mobile and keyboard behaviour.
2. Write a gap list and design spec. Match layout and behaviour. Copy no CSS, icons or text.
3. Decide modality. Recommended: a non-modal dialog without `aria-modal`, because visitors need to see the page change.
4. Rebuild: icon tiles, level indicators, profile cards, sticky header and footer, open and close motion with `transform` and `opacity`, mobile bottom sheet, safe-area insets, reduced motion, forced colors.
5. Style presets and tokens, with a contrast check in the admin.

Done when: the gap list is closed and the snapshots are approved by the owner.

## Phase 6: management, v1.0

Status: done in code (M6.1 to M6.9). Pending: v1.0.0-beta.1 release, 7-day beta soak on the kotlinskidev site, then v1.0.0. Spec: [PHASE6-SPEC.md](PHASE6-SPEC.md).

- Settings: search, per-tab reset, change preview, unsaved-changes guard, import and export with version check, locked settings through a constant or filter.
- Roles: a customer capability limited to labels, statement and appearance.
- WP-CLI: `wp ka11y settings get|set|import|export|reset` and `wp ka11y doctor`.
- Multisite network defaults.
- Site Health checks: build files, update source, optimizer conflicts, page cache per language.
- Updates: stable and beta channels, changelog in the update window, rollback to a previous release, provenance attestation for the zip.
- Maintenance: Dependabot, CodeQL, deprecation policy, migration tests from each released version, `SECURITY.md`.
- Uninstall: keep or delete data, chosen in settings.
- Privacy: text for the WordPress privacy policy guide. No tracking.

Done when: an upgrade test from v0.1.1 to v1.0 keeps settings and visitor state.

## Order

0, 1, 2, 3, 4, 5, 6. Phase 3 precedes 4 because the trigger queue lives in the loader. Phase 5 follows 3 and 4 so the panel is rebuilt once.
