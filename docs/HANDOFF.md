# Handoff

Read this, then `CLAUDE.md` (project profile). Plans: `docs/ROADMAP.md` (phases 0 to 6), `docs/PHASE3-SPEC.md`, `docs/PHASE4-SPEC.md`, `docs/PHASE5-SPEC.md`, `docs/PHASE5-PARITY.md`, `docs/PHASE6-SPEC.md`, `docs/API.md` (public API), `docs/TESTING.md`. Do not re-read whole specs: open only the milestone being worked on.

## Where we are

- Repo `~/Projects/kotlinskidev-accessibility` (public GitHub `Kotlinski95/kotlinskidev-accessibility-plugin`). Released: v0.4.0 (Phase 5, UI parity). Phase 6 (management, `docs/PHASE6-SPEC.md`) is implemented through M6.9 and sits under `[Unreleased]` in `CHANGELOG.md`; v1.0.0-beta.1 is pending release (M6.10).
- Phase 6 shipped: layered settings with locks, settings search, change preview and per-tab reset, versioned import and export, customer capability, WP-CLI (`settings`, `doctor`, `access`), multisite network defaults, Site Health checks, update channels, checksum verification and rollback, uninstall keep-data choice, privacy policy guide text, upgrade and downgrade tests, pl_PL translations.
- Earlier phases: 0 (hotfix v0.1.2/v0.1.3), 1 (agent kit repo `Kotlinski95/kotlinskidev-claude-kit`), 2 (test harness), 3 (v0.2.0), 4 (v0.3.0), 5 (v0.4.0).

## Next

Release steps (PHASE6-SPEC section 15), only when the owner asks:

1. Verify command, `@smoke`, `@upgrade`, multisite and `@visual` green; `check-budget` identical to v0.4.0 for the front end.
2. Owner uploads `kotlinskidev-accessibility.zip.sha256` to the v0.4.0 release (D8).
3. `npm run release -- --major --pre beta` gives `1.0.0-beta.1`; `npm run check-version`; commit `chore: release v1.0.0-beta.1`; tag and push. The workflow publishes a pre-release with notes, checksum and attestation.
4. Owner switches the channel to Beta on the kotlinskidev site, updates, runs `wp ka11y doctor` and the manual list in PHASE6-SPEC 13.4. 7 days soak (D11). Bugs go into beta.2 and restart the soak.
5. `npm run release -- --major` gives `1.0.0`; CHANGELOG `[1.0.0]` lists everything since 0.4.0; commit `chore: release v1.0.0`, tag, push.
6. After release: remove the front-end diff guard from CI, set the rollback floor review for the next minor, update this section.

The owner must do:

- Upload the v0.4.0 `kotlinskidev-accessibility.zip.sha256` asset (D8).
- Run the `visual-baselines` workflow and commit the Linux baseline artifact so `@visual` can run in CI.
- Do a manual screen-reader pass and a Navigation block check (trigger block as a menu item).
- Run the 7-day beta soak on the kotlinskidev site.

Other open work:

- Phase 4b (quick-actions block) lives in a theme repo and uses the Phase 4 API.
- Parity follow-ups from `docs/PHASE5-PARITY.md`: stepper row balance (P1), Skip card baseline (P7).

## Known gap: visual baselines

- Visual baselines in `tests/e2e/__screenshots__/darwin/` are macOS only. Linux baselines come from the `visual-baselines` workflow artifact, which the owner commits before `@visual` runs in CI.

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
