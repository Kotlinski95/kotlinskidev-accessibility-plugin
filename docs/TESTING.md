## CI

| Workflow | Trigger | What runs |
| --- | --- | --- |
| `ci.yml` `php` | push to main, pull request | phpcs and PHPUnit on PHP 8.1 and 8.3 |
| `ci.yml` `phpstan` | push to main, pull request | `composer run analyse` (level 8, config in `phpstan.neon.dist`) |
| `ci.yml` `js` | push to main, pull request | ESLint, typecheck, Jest, build, version check |
| `ci.yml` `e2e` | push to main, pull request | wp-env in Docker, Chromium. Pull requests run `--grep @smoke` when tagged tests exist, otherwise the full suite. Main runs the full suite. |
| `ci.yml` `plugin-check` | push to main, pull request | Builds the package like the release (build, `composer --no-dev`, rsync with `.distignore`) and runs WordPress Plugin Check on `dist/kotlinskidev-accessibility` |
| `nightly.yml` | 03:00 UTC, manual | Full Chromium suite on WordPress 6.4 and latest with PHP 8.1 and 8.4 (6.4 on 8.4 excluded), plus Firefox and WebKit `@smoke`, and a Lighthouse job that runs `lhci` three times against wp-env (widget off through `visibility.mode=only_on` with `includePostIds=[999999]`, widget on with Recommended, widget on with saved state seeded by `bin/lh-seed-state.cjs`), settings switched by `bin/lh-widget.php`, then `bin/lh-compare.mjs` compares the medians: LCP and TBT may rise by 5 percent of the off value but never less than 100 ms (LCP) and 50 ms (TBT) as noise floors, CLS by 0.01, and no render-blocking plugin URL is allowed (`lighthouserc.cjs`) |
| `codeql.yml` | push to main, pull request, weekly | CodeQL for JavaScript and TypeScript |
| `release.yml` | tag `v*` | Builds and attaches `kotlinskidev-accessibility.zip` |

Plugin Check runs without the `plugin_updater` and `plugin_readme` checks because the plugin ships from GitHub with its own updater, not from wordpress.org. Four codes are ignored: `wp_function_not_compatible_with_requires_wp` (`array_is_list()` is native on PHP 8.1+), `missing_composer_json_file`, `WordPress.DB.SlowDBQuery.slow_db_query_meta_query` and `WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound` (third-party WPML hooks).

Nightly sets the WordPress and PHP version through a generated `.wp-env.override.json` (git-ignored, not packaged). Cross-browser jobs need `firefox` and `webkit` projects in `playwright.config.ts`.

WebKit notes: it does not paint or run `requestAnimationFrame` while a deferred script is pending, so Playwright's visible and stable check never resolves for a test that holds `loader.js`; those tests click with `force: true`. WebKit logs `Prefetch request denied: URL must be secure (HTTPS)` for `rel=prefetch` over plain HTTP, which `collectErrors` in `tests/e2e/triggers.spec.ts` ignores. The Lighthouse job sets `CHROME_PATH` to the runner's Chrome because `lhci` with a `puppeteerScript` otherwise fails its healthcheck with `Chrome installation not found`.

Run PHPStan locally with `composer run analyse`. Run Plugin Check locally by packaging the plugin as in `release.yml`, mounting the folder in a throwaway wp-env, then `wp plugin install plugin-check --activate` and `wp plugin check kotlinskidev-accessibility`.

## End-to-end fixtures and projects

Every page invariant runs against two fixtures.

| Fixture | Page | How it is selected |
| --- | --- | --- |
| `stock` | The default wp-env theme | Nothing to set |
| `hostile` | `tests/e2e/fixtures/hostile-theme`, a classic theme with a transformed page wrapper, sticky header, `overflow-x: clip` on `html` and `body`, smooth scrolling, a fixed cookie wall, a fixed badge, a `<dialog>`, a scroll-snap carousel, an iframe, a muted looping video, a background-image `<img>`, about 3000 nodes and a `<body>` child appended 400 ms after load | The Playwright option `fixture: 'hostile'` sets the cookie `ka11y_fixture=hostile`; the mu-plugin `tests/e2e/fixtures/mu-plugins/ka11y-fixture-switch.php` then filters `pre_option_template` and `pre_option_stylesheet`. The theme is never activated, so the admin and REST calls keep the stock theme. |

The mu-plugin does nothing unless `WP_ENVIRONMENT_TYPE` is `local` (wp-env sets it), the cookie is present and the fixture theme folder exists. Both folders are mounted through `mappings` in `.wp-env.json`. Run `npm run wp-env:start` again after changing the mappings.

`assertPageUsable` detects the hostile page and adds hostile-only checks (`tests/e2e/support/hostile.ts`): `html` and `body` filter is `none` and `html` is static, the fixed badge keeps its rectangle, the header stays sticky, the cookie wall button is reachable, the late `<body>` node is filtered exactly when a filter feature is on, overlays never intercept the pointer, and the dialog opens and closes.

| Project | Runs |
| --- | --- |
| `chromium` | Every spec on desktop Chrome |
| `mobile-smoke` | `invariants.spec.ts` on Pixel 5, only tests tagged `@smoke` |
| `visual` | `visual.spec.ts` only, tests tagged `@visual`. Never part of `chromium`, the default run or CI |

Specs that loop over `FIXTURE_NAMES` wrap their tests in `test.describe('[stock]')` and `test.describe('[hostile]')`, each with `test.use({ fixture })`.

### Pairwise combinations

`tests/e2e/support/pairwise.ts` builds a deterministic greedy covering array over `FEATURE_LEVELS` (`off` plus each level). Every valid 2-way pair of feature levels appears in at least one row; the three contrast features are mutually exclusive, so pairs of them are not required. `tests/js/pairwise.test.ts` proves coverage and determinism. `combinations.spec.ts` applies each row through the panel on both fixtures, then reloads and resets with the page invariants checked at each step.

### Running

```bash
npm run wp-env:start
npx playwright test                       # everything
npx playwright test --grep @smoke         # fast subset
npx playwright test --project=mobile-smoke
npx playwright test --grep-invert "combination"  # without pairwise rows
```

`@smoke` is every single-level feature on `stock`, level 1 of each multi-level feature on `stock`, and every profile on `hostile`.

### Adding a fixture

1. Add a folder under `tests/e2e/fixtures/` and map it in `.wp-env.json` (a theme goes to `wp-content/themes/<slug>`).
2. Make the mu-plugin switch to it for a new cookie value.
3. Add the name to `FixtureName` and `FIXTURE_NAMES` in `tests/e2e/support/fixtures.ts`.
4. Put its fixture-only checks in `tests/e2e/support/hostile.ts` style helpers and call them from `assertPageUsable` when a marker element is present.

### Loading specs

`loading.spec.ts` covers the five load strategies with and without saved state on both fixtures, open triggers held behind a delayed `loader.js`, a 404 on `panel.js` (error state, then recovery), the uploads JSON fallback to REST, device skip, no JavaScript and the three Page CSS modes. `support/perf.ts` has `pluginRequests`, `seedSavedState` and `firstPaintSnapshot`. `@smoke` marks interaction without state on `stock`, eager without state on `stock`, interaction with state on `hostile`, the early-trigger test, the chunk failure test and the no-JS test.

### Compat and performance specs

Two more mu-plugins live in `tests/e2e/fixtures/mu-plugins/`. Both do nothing unless `WP_ENVIRONMENT_TYPE` is `local` and their cookie is present, like the fixture switch.

| mu-plugin | Cookie | Effect |
| --- | --- | --- |
| `ka11y-fixture-moved.php` | `ka11y_fixture_moved=1` | Copies the loader build file to `wp-content/cache/asset-cleanup/js/ka11y-loader.js` when missing or stale, and filters `script_loader_src` for `kotlinskidev-a11y-loader` to that URL. Chunks must still come from the plugin `build/` URL |
| `ka11y-fixture-csp.php` | `ka11y_fixture_csp=nonce` or `strict` | Sends `script-src 'nonce-{n}' 'self'` or `'nonce-{n}' 'strict-dynamic'` plus `style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'`, adds the nonce to every script tag and inline script, and removes the core emoji detector (its blob worker would violate `worker-src` and is not plugin code) |

`compat.spec.ts` covers the moved loader (panel opens, saved state applies, every chunk request goes to the plugin `build/` URL, no failed request), both CSP modes (policy header has no `unsafe-eval`, zero `securitypolicyviolation` events, panel opens, saved state applies) and the Compatibility preset opt-out attributes on the bootstrap, config and loader tags. `@smoke` marks the moved-loader test and the `strict` panel test.

`perf.spec.ts` compares the widget off (`visibility.mode=only_on` with an unmatched post ID) and on (Recommended) on `/` in fresh contexts with 4x CPU throttling, five interleaved runs per side. Median deltas, on minus off: CLS at most 0.005, LCP at most 50 ms, long-task total over 50 ms at most 30 ms. It also checks that no plugin stylesheet is in the head and that the launcher keeps its box with the loader held. `support/perf.ts` adds `installVitals`, `readVitals`, `throttleCpu`, `median` and `headHtml`. `@smoke` marks one run per side with CLS and request assertions only.

Flake notes: the median test is the only timing-sensitive one. If it flakes on a slow runner, raise `RUNS` before loosening a budget.

### Trigger specs

`triggers.spec.ts` covers every trigger kind under each of the five load strategies with `widget.launcher = hidden`. A fourth mu-plugin, `tests/e2e/fixtures/mu-plugins/ka11y-fixture-triggers.php`, does nothing unless `WP_ENVIRONMENT_TYPE` is `local`, `KOTLINSKIDEV_A11Y_E2E` is true and the cookie `ka11y_fixture_triggers=1` is present. It prints one `#ka11y-fixture-triggers` block in `wp_footer` with: the open hash link, the `#ka11y/profile:adhdFriendly` link, a `.ka11y-open` button, a `data-ka11y="feature:darkContrast"` button, a `data-ka11y="toggle"` link with a real `href`, a `.fixture-a11y-menu > a` link (the spec saves that selector in `triggers.selectors`), the shortcode, the block with `feature:biggerText:2`, `kotlinskidev_a11y_button( array( 'action' => 'toggle' ) )`, a button that calls `kotlinskidevA11y.open( this )`, an unknown action, a button for the `highContrast` feature (disabled in the tests that need it), a reset button and a plain `Before` button for focus checks.

| Test per strategy | Checks |
| --- | --- |
| `<case> takes effect by click and Enter` (10 cases) | Panel opens, Escape closes, focus returns to the trigger; feature and profile cases apply, set `aria-pressed`, survive a reload (with a `ka11y:change` of source `restore`), and re-apply after reset by Enter; no console error |
| `<case> wires ARIA and activates by Space` (10 cases) | `role="button"` on links, `aria-expanded` false then true then false around open, `aria-pressed` false then true, Space activation |
| unknown and disabled actions | Unknown `data-ka11y`, a disabled feature, `set`, and `toggle` with a disabled or invalid target change nothing |
| URL query, landing hash, off and reset | `?ka11y=` applies, keeps other parameters and the hash, is never stored on its own and is stored with the next manual change; `#ka11y/feature:biggerText:2` clears the hash |
| URL allowlist | `toggle`, `close`, `statement`, `hide`, unknown, a disabled feature and `feature:__proto__` are ignored |
| JS API and events | `api`, `open`, `close`, `toggle`, `set` (true, level, clamp, false), `toggle(target)`, `reset`, `getState`, `on` with unsubscribe, late `ready`, `ka11y:ready` once, open, close and change events |
| focus | Shortcut and API `open()` return focus to the previously focused element; with nothing focused and the launcher hidden focus lands on `body` and no `tabindex` is left behind |
| axe | No serious or critical violations on the fixture block and the open panel |
| before the loader | Profile link, data button and shortcode button clicked while `loader.js` is held apply exactly once after release |

`@smoke` marks a handful of cases on the `interaction` and `eager` strategies: hash open and data feature effects, the hash open ARIA test, and a few single tests per strategy. Run it alone with `npx playwright test tests/e2e/triggers.spec.ts --grep @smoke`.

Known product bug: `wireAria` in `src/ts/loader/triggers.ts` selects only `[data-ka11y]:not(html),a[href^="#ka11y/"]`, so `a[href="#kotlinskidev-a11y"]`, `.ka11y-open` and custom selector elements get no `role`, `aria-expanded` or `aria-controls`, and Space does nothing on the links among them. The three affected `wires ARIA and activates by Space` tests are wrapped in `test.fail` through `KNOWN_PRODUCT_BUGS`; remove those ids from the set when the loader is fixed.

Flake note: the loader queue drops a `toggle` from the same source within 50 ms of the previous one (`isDoubleToggle` in `src/ts/loader/queue.ts`), so the dialog cases wait `TOGGLE_GUARD_MS` (80 ms) before each activation. The triggers `@smoke` subset takes about 21 s of the whole `@smoke` run.

### Panel UI and visual specs

`panel-ui.spec.ts` covers the Phase 5 panel: non-modal behaviour, focus and Escape rules, tiles (pressed state, check badge, level dots, described state), steppers for `biggerText` and `lineHeight` (bounds, Enter and Space), the skip select, reset status and focus, the language switcher including an RTL locale, the hide toolbar chip, `panel.sections`, `panel.columns` and `panel.languageSwitcher` set through the settings helper, side docking for `bottom-left`, `bottom-right` and `middle-right`, the 390 by 844 bottom sheet, reduced motion, forced colors, 320 by 640 overflow, 44 px targets and axe in light, dark, sheet and RTL. `@smoke` marks one case per area and adds about 4 s.

A fifth mu-plugin, `tests/e2e/fixtures/mu-plugins/ka11y-fixture-locale.php`, does nothing unless `WP_ENVIRONMENT_TYPE` is `local`, `KOTLINSKIDEV_A11Y_E2E` is true and the cookie `ka11y_fixture_locale` holds a locale such as `en_US`, `pl_PL` or `he_IL`. It filters `kotlinskidev_a11y_current_locale` to that value, adds `en_US`, `pl_PL` and `he_IL` to `kotlinskidev_a11y_known_locales` (so the language select always lists three languages) and pins their labels through `kotlinskidev_a11y_locale_label`. Specs set it with `setFixtureLocale` from `tests/e2e/support/locale.ts`. A saved locale is applied when the panel chunk mounts, so a test that reloads must open the panel before asserting `lang` or `dir` on the host.

`visual.spec.ts` takes `toHaveScreenshot` snapshots of the panel element (animations disabled, `maxDiffPixelRatio` 0.01): desktop 1280 by 800 and mobile 390 by 844, light and dark, `en_US` and `pl_PL`; `he_IL` light desktop and dark mobile; forced colors; one active-state panel; and the launcher in light, dark and forced colors. The skip select is masked because its options depend on page landmarks.

Snapshots depend on the platform fonts and rasteriser, so the `visual` project writes them to `tests/e2e/__screenshots__/{platform}/visual.spec.ts/` (`darwin`, `linux`, `win32`) and CI never compares them.

```bash
npm run wp-env:start
KA11Y_VISUAL=1 npx playwright test --project=visual           # compare against the baselines of this platform
KA11Y_VISUAL=1 npx playwright test --project=visual --update-snapshots # write or replace them
```

Review the changed PNGs before committing a new baseline. Generate the `linux` set inside the Playwright Docker image when it is needed.
