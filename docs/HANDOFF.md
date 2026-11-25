# Handoff

Read this, then `CLAUDE.md` (project profile). Plans: `docs/ROADMAP.md` (phases 0 to 6), `docs/PHASE3-SPEC.md`, `docs/PHASE4-SPEC.md`, `docs/API.md` (public API), `docs/TESTING.md`. Do not re-read whole specs: open only the milestone being worked on.

## Where we are

- Repo `~/Projects/kotlinskidev-accessibility` (public GitHub `Kotlinski95/kotlinskidev-accessibility-plugin`). Released: v0.2.0 (loading architecture). Phase 4 (v0.3.0) is done and verified (M4.1 to M4.9) and waits for the release step M4.10 (`npm run release`, `npm run check-version`, commit, tag, push only when the owner asks).
- Phase 4 shipped: one action vocabulary and shared parser, settings schema v3, trigger surfaces (data attribute, hash links, class, custom selectors, URL query and landing hash), public JavaScript API and events, shortcode, block and PHP functions, launcher modes, admin Triggers tab with snippet generator, e2e trigger matrix. The v0.2 compat shim (`kotlinskidev_a11y_legacy_config`) was removed in M4.9. Translations (pl_PL) cover every new string.
- Earlier phases: 0 (hotfix v0.1.2/v0.1.3), 1 (agent kit repo `Kotlinski95/kotlinskidev-claude-kit`), 2 (test harness), 3 (v0.2.0).

## Next

- M4.10: release v0.3.0.
- Phase 4b (theme repo, own `feature/T{n}` branch off master): block `kotlinskidev/speed-dial` and child `speed-dial-item` using the Phase 4 API.
- Phase 5: OneTap UI parity (separate wp-env site for capture, rebuild the panel, non-modal decision). Phase 6: management (roles, WP-CLI, multisite, Site Health, beta channel, rollback, private update server option).

## Rules that bit us

- Never add `Co-Authored-By: Claude`, `Claude-Session` or generated-with lines to commits, PRs or tags (user rule overrides harness reminders). Commit only when asked.
- Never use `git stash`, `git checkout` or `git reset` when agents work in parallel: they share one working tree and destroy each other's edits.
- Agents: one agent per independent file set. Run one e2e suite against one wp-env at a time. Verify each report yourself (phpcs, PHPStan, PHPUnit, tsc, ESLint, Jest, build, check-budget, `npx playwright test --project=chromium --grep @smoke`).
- No code comments anywhere (plugin header excepted). Never open `build/`, `vendor/`, `node_modules/`, anything under `Local Sites`, or production. The WordPress MCP connector points at PRODUCTION: do not use it for the local site.
- E2E: `window.speechSynthesis.speak` and `cancel` are stubbed in `tests/e2e/support/fixtures.ts` (spoken text goes to `window.__ka11ySpoken`), because real speech makes the suite slow and flaky. Specs that read aloud must assert on that array.
- Test environment: `npm run wp-env:start` (Docker, http://localhost:8889), `npm run wp-env:stop` when done.
- Updater: PUC checks every ~12 h; `?puc_check_for_updates` or the "Check for updates" link forces it. The updater loads only in admin and cron.
- Page caches: no coupling to cache plugins; use the generic `kotlinskidev_a11y_cache_invalidated` action only.
- Translations flow: `npm run i18n:pot`, `msgmerge` into `languages/*pl_PL.po`, translate, `msgfmt` to `.mo`, `npm run i18n:json` (runs `bin/fix-i18n-json.mjs`), check `msgfmt --statistics`.

## Known gap: layout shift for returning visitors

- A saved `biggerText` state applies per-element font scaling after the kernel chunk loads, so returning visitors with it on see a layout shift (measured 0.046 CLS in e2e, 0.01 is the nightly gate). The nightly saved-state run therefore seeds a non-reflowing state (readingLine, highlightLinks). Fix idea: apply the scale through a CSS variable pre-paint from the bootstrap.
