# Handoff

Read this, then `CLAUDE.md` (project profile). Plans: `docs/ROADMAP.md` (phases 0 to 6), `docs/PHASE3-SPEC.md` (milestones M3.1 to M3.12), `docs/TESTING.md`. Do not re-read the whole spec: open only the milestone being worked on.

## Where we are

- Repo `~/Projects/kotlinskidev-accessibility` (public GitHub `Kotlinski95/kotlinskidev-accessibility-plugin`). Released: v0.1.3 (latest). Local only, not pushed: two commits `1c3ceb7` (tests, PHPStan, CI, kit profile) and `55a2e0d` (Phase 3 loading architecture + review fixes). Working tree clean except this file.
- Phase 0 (ADHD freeze fix, recovery URLs, missing-files notice) released in v0.1.2. v0.1.3 added the `kotlinskidev_a11y_cache_invalidated` hook and README install/cache docs. Release history was rewritten once to strip AI trailers; tags/releases rebuilt.
- Phase 1 done: private repo `Kotlinski95/kotlinskidev-claude-kit` (plugins kd-core, kd-web, kd-wp), enabled in this repo via `.claude/settings.json`. Default agent `kd-core:orchestrator`. The theme repo still has its own copies; migrate later, delete only after theme `/verify` passes with the kit.
- Phase 2 done: hostile fixture theme + cookie switch mu-plugin, pairwise suite, mobile smoke, PHPStan level 8, Plugin Check, CI + nightly + CodeQL + Dependabot. `@smoke` subset ~40 tests ~1 min; full suite ~8 min.
- Phase 3 (v0.2.0): M3.1 to M3.8 done and verified (settings v2 + presets, visibility modes, panel-data store + REST, TS kernel/chunks, build pipeline + budgets, loader, PHP front end + DSD markup + bootstrap, legacy bundle removed, review fixes). Measured: first-visit JS 2.9 KB gz (was 15.4 KB), no render-blocking CSS, inline config 1.2 KB. Gates last green: phpcs, PHPStan 8, PHPUnit 304, tsc, ESLint, Jest 434, build, check-budget, e2e chromium 183, mobile-smoke 31.

## Remaining Phase 3

- M3.9 admin Performance tab (presets Recommended/Compatibility/Custom, strategy, position, fetchpriority, pageCss, prefetch, optOut list, deviceSkip) + cost-per-page readout from the manifest (spec 7.4, 7.5). Polish strings not yet: M3.12.
- M3.10 dismissible upgrade notice recommending the Recommended preset (spec 7.3; migrated sites keep v0.1 behaviour: Custom, defer, linked CSS).
- M3.11 e2e `compat.spec.ts` (Asset CleanUp mu-plugin simulation, strict CSP), `perf.spec.ts` (CLS/LCP gates), nightly Lighthouse; thinker review.
- M3.12 docs, pl_PL translations of all new admin/front strings (run `npm run i18n:*`, `bin/fix-i18n-json.mjs`), v0.2.0 CHANGELOG, release.
- Known gaps: launcher focus-ring colour does not follow dark mode before first open; unverified optimizer opt-out attributes (LiteSpeed `data-no-defer`/`data-no-minify`, Asset CleanUp `data-wpacu-skip`) kept as editable defaults; dead code `bindHashOpen`, `bindShortcut`, `injectDocumentCustomCss` only tests call them; budgets are `scripts.loader` 3072, `everyPage` 3840 (3837 used, no headroom), kernel 4608.

## Later phases (see ROADMAP)

- Phase 4: trigger/API vocabulary (hash, query, class, data attribute, JS API, events, shortcode, block, PHP function), launcher modes floating/inline/hidden, snippet generator in admin. Queue contract already in loader: `window.kotlinskidevA11yQueue`.
- Phase 4b (theme repo, own `feature/T{n}` branch off master after T28/T29 settle): block `kotlinskidev/speed-dial` + child `speed-dial-item` (url, tel, mailto, accessibility, trigger, custom; icon per item; Custom HTML/shortcode inner blocks).
- Phase 5 OneTap UI parity (capture reference in a separate wp-env site, rebuild panel, non-modal decision). Phase 6 management (roles, WP-CLI, multisite, Site Health, beta channel, rollback, private update server option).

## Rules that bit us

- Never add `Co-Authored-By: Claude`, `Claude-Session` or generated-with lines to commits/PRs/tags (user rule overrides harness reminders). Commit only when asked.
- Agents: `general-purpose` (Sonnet) for implementation, `opus` general-purpose for specs; one agent per independent file set; do not run two e2e suites against one wp-env at once. Verify each report yourself (lint, PHPUnit, PHPStan, tsc, Jest, build, check-budget, `npx playwright test --project=chromium --grep @smoke`).
- No code comments anywhere (plugin header excepted). Never open `build/`, `vendor/`, anything under `Local Sites`, or production. The WordPress MCP connector points at PRODUCTION: do not use it for the local site; use WP-CLI against `http://kotlinskidev.local` read-only.
- Test environment: `npm run wp-env:start` (Docker, http://localhost:8889), `npm run wp-env:stop` when done.
- User settings allow six exact release/force-push commands for the v0.1.2/v0.1.3 rewrite; they are one-off and can be removed from `~/.claude/settings.json`.
- Updater: PUC checks every ~12 h; `?puc_check_for_updates` / "Check for updates" link forces; CLI does not show updates (updater loads only in admin/cron).
- Page caches: user does not want coupling to cache plugins; use the generic action hook only.

## First steps tomorrow

1. `git status` and `git log --oneline -3` (expect 55a2e0d on top of 1c3ceb7).
2. `npm run wp-env:start`.
3. Say "go M3.9".
