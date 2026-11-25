# Handoff

Read this, then `CLAUDE.md` (project profile). Plans: `docs/ROADMAP.md` (phases 0 to 6), `docs/PHASE3-SPEC.md`, `docs/PHASE4-SPEC.md`, `docs/PHASE5-SPEC.md`, `docs/PHASE5-PARITY.md`, `docs/API.md` (public API), `docs/TESTING.md`. Do not re-read whole specs: open only the milestone being worked on.

## Where we are

- Repo `~/Projects/kotlinskidev-accessibility` (public GitHub `Kotlinski95/kotlinskidev-accessibility-plugin`). Released: v0.3.0 (triggers and public API). v0.4.0 (Phase 5, UI parity) is done and verified (M5.1 to M5.9) and waits for the release step M5.10 (`npm run release`, `npm run check-version`, commit, tag, push only when the owner asks).
- Phase 5 shipped: non-modal panel (side panel and bottom sheet), icon tiles, steppers, language switcher, presets and color tokens with contrast check, columns and section toggles (settings schema v4), icon set with filters, pl_PL translations for every new string. Specs: `docs/PHASE5-SPEC.md`, parity review `docs/PHASE5-PARITY.md`.
- Earlier phases: 0 (hotfix v0.1.2/v0.1.3), 1 (agent kit repo `Kotlinski95/kotlinskidev-claude-kit`), 2 (test harness), 3 (v0.2.0), 4 (v0.3.0).

## Next

- M5.10: release v0.4.0 after the owner approves the snapshots.
- Phase 4b (theme repo, own `feature/T{n}` branch off master): block `kotlinskidev/speed-dial` and child `speed-dial-item` using the Phase 4 API.
- Phase 6: management (roles, WP-CLI, multisite, Site Health, beta channel, rollback, private update server option).
- Parity follow-ups from `docs/PHASE5-PARITY.md`: stepper row balance (P1), Skip card baseline (P7).

## Known gap: visual baselines

- Visual baselines in `tests/e2e/__screenshots__/darwin/` are macOS only. Docker Linux baselines are not generated, so `@visual` is not run in CI. Generate them in the Docker image before enabling it.

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

## Known gap: inline HTML cost

- With the widget on the gzip document grows by about 2.7 KB (inline config, bootstrap, launcher markup and CSS, 6.8 KB raw), which pushes it past the ~14.6 KB TCP initial window and shows up as +300 ms in Lighthouse simulated LCP. Observed (real Chrome) LCP differs by about 10 ms and TBT/CLS are 0. The nightly now compares observed LCP. Idea if it matters: shrink or defer the inline launcher block.

## Known gap: locales without a core language pack

- `Strings::for_locale()` uses `switch_to_locale()`, which only switches to locales in `get_available_languages()`. On a site where a locale (for example pl_PL) is not installed as a core language pack, the widget language switcher returns English for it even though the plugin ships the `.mo`. Fix idea: when `switch_to_locale()` returns false, `unload_textdomain` and `load_textdomain` the shipped `languages/kotlinskidev-accessibility-{locale}.mo`, then restore. The e2e locale fixture now adds pl_PL and he_IL to `get_available_languages`.
