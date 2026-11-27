# Kotlinskidev Accessibility: implementation spec

Standalone GPL plugin re-creating all features of "Accessibility Widget by OneTap" (studied from wordpress.org description and public SVN only; no code or assets copied). No jQuery. Slug and text domain `kotlinskidev-accessibility`, PHP prefix `kotlinskidev_a11y`, namespace `Kotlinskidev\A11y` (PSR-4 from `src/php`). Rules: strict TypeScript (no `any`), no code comments, named callbacks, strict comparisons, all strings via i18n.

## Decisions
- Build: esbuild + dart-sass in `bin/build.mjs`, `tsc --noEmit` for types. No webpack/Babel/React.
- Admin page: vanilla TS rendered from the REST schema (deps `wp-i18n`, `wp-api-fetch` only).
- Front-end strings: PHP inline JSON after switching to the page locale (Polylang, WPML, TranslatePress, `determine_locale()`); no `wp-i18n` on front end.
- Widget panel in open Shadow DOM; tokens are CSS variables; custom CSS injected into shadow root and document.
- State = classes on `<html>` (`ka11y-*`) + CSS variables. ~600 B head bootstrap applies saved state before paint.
- Filters go on `body > *:not(#ka11y-root)`, never on `html`/`body` (breaks position:fixed descendants).
- Font size/line height scaled per element, original cached in a WeakMap and restored exactly.
- Per-language label overrides in plugin option (`labels[locale]`), not Polylang string translation.
- Device visibility via CSS media queries with breakpoints from settings, no UA sniffing (cache safe).
- Updates: Plugin Update Checker v5 via Composer, `enableReleaseAssets('/kotlinskidev-accessibility\.zip/')`, GitHub Releases. Repo public for now; `Updater.php` stays a thin swappable class (a private Cloudflare Worker update server may replace it later).
- Widget has a panel language picker (`panel.languageSwitcher`, shown with two or more languages); `panel.languageMode=follow` pins it to the page locale and clears any saved visitor choice. Default shortcut `Alt+Shift+A`. Ship `pl_PL` beyond English.

## Features (settings `features.<key>.enabled` bool, `features.<key>.default` bool or level index)
Content: `biggerText` (+10/+25/+50%), `lineHeight` (1.5/1.75/2), `letterSpacing`, `fontWeight`, `readableFont`, `dyslexicFont` (OpenDyslexic OFL woff2, lazy @font-face), `textAlign` (left/center/right cycle), `highlightLinks`, `bigCursor` (data-URI SVG), `textMagnifier`, `cognitiveReading` (TreeWalker bolds first half of words, reversible).
Color: `darkContrast`, `lightContrast`, `highContrast` (contrast 1.5), `monochrome` (grayscale 1), `saturation` (low .5 / high 2). Dark, light, high contrast mutually exclusive.
Orientation: `readingLine`, `readingMask`, `readPage` (speechSynthesis, click-to-read, page lang), `keyboardNavigation` (strong focus-visible + hotkeys H/F/B/G/L/M), `hideImages`, `muteSounds` (muted + MutationObserver), `highlightTitles`, `highlightAll`, `stopAnimations` (none + pause video + freeze GIFs), `skipToContent` (landmark select; hide option when landmark missing).
Profiles (`profiles.<key>.{enabled,features[]}`): `visionImpaired`, `seizureSafe`, `adhdFriendly`, `blindness`, `epilepsySafe`; presets editable.
Toolbar: opens from any link to `#kotlinskidev-a11y`, reset, hide toolbar (session or N days), keyboard shortcut, statement link, Esc closes, focus trap, `inert` when closed, `aria-pressed` toggles.
Admin: shortcode `[kotlinskidev_a11y_statement]` (per-language content); missing-alt-text page with inline edit; dashboard widget with missing-alt count.

## Repo tree
`kotlinskidev-accessibility.php`, `uninstall.php`, `composer.json`, `package.json`, `tsconfig.json`, `bin/build.mjs`, `bin/check-version.mjs`, `.distignore`, `.gitignore`, `phpcs.xml.dist`, `phpunit.xml.dist`, `jest.config.js`, `playwright.config.ts`, `.wp-env.json`, `README.md`, `CHANGELOG.md`, `languages/`, `assets/fonts/`, `assets/icons/`, `src/php/`, `src/ts/{bootstrap,frontend,admin}/`, `src/scss/{widget,page,admin}/`, `tests/{php,js,e2e}/`, `.github/workflows/{ci,release}.yml`. `build/` gitignored.

## PHP (`src/php/`)
- `Plugin.php`: boot on `plugins_loaded`.
- `Settings/Schema.php`: `key => {type, default, sanitize, enum?}`; `Repository.php`: option `kotlinskidev_a11y_settings`, deep-merge defaults, `schemaVersion` migrations, per-request cache; `Sanitizer.php`: schema-driven, custom CSS via `wp_strip_all_tags` + `</style` strip.
- `Rest/SettingsController.php`: namespace `kotlinskidev-a11y/v1`; `GET|POST /settings`, `GET /schema`, `GET /export`, `POST /import`, `POST /reset`; permission `current_user_can(apply_filters('kotlinskidev_a11y_capability','manage_options'))`.
- `I18n/LanguageResolver.php`: `pll_current_language('locale')` > `wpml_current_language` mapped > `$GLOBALS['TRP_LANGUAGE']` > `determine_locale()`; filter `kotlinskidev_a11y_current_locale`. `I18n/Strings.php`: `switch_to_locale`, collect `__()` strings, merge `labels[locale]`, filter `kotlinskidev_a11y_strings`, restore.
- `Frontend/Visibility.php` (excluded post IDs, types, roles, URL patterns; filter `kotlinskidev_a11y_should_render`), `Assets.php` (`loader.js` and eager chunks, inline bootstrap `wp_head` priority 1, tokens CSS), `InlineConfig.php`, `Manifest.php`, `ScriptAttributes.php`, `Markup.php` (launcher in `wp_footer` inside `#ka11y-root`).
- `Statement/Shortcode.php`, `Admin/{SettingsPage,AltTextPage,DashboardWidget}.php`, `Update/Updater.php`.

## Option defaults
- `features.*`: enabled true, default false. `profiles.*`: enabled true, preset lists.
- `widget`: `position` per device (desktop/tablet/mobile; bottom-right, bottom-left, top-right, top-left, middle-right, middle-left), `offsetX`/`offsetY` per device 20, `size` md (sm 40, md 52, lg 64), `icon` universal or attachment ID, `iconBorder` false.
- `visibility`: `devices` all true, `breakpoints {tablet:1024, mobile:768}`, `excludePostIds/PostTypes/Roles/UrlPatterns` [].
- `theme`: `mode` auto, `darkSelector` `html.dark-mode, body.dark-mode`, `lightSelector` `html.light-mode, body.light-mode`, `followPrefersColorScheme` true.
- `tokens`: primary, onPrimary, surfaceLight, surfaceDark, textLight, textDark, radius, zIndex 2147483000, fontFamily. `customCss` ''.
- `storage`: mode local|cookie|none, ttlDays 365, key `ka11y`. `statement {pageId:0,url:'',content:{locale:html}}`. `shortcut {enabled:true,combo:'Alt+Shift+A'}`. `hideToolbar {allow:true,days:[1,7,30]}`. `labels {locale:{stringKey:text}}`. `advanced {excludeSelectors:'#wpadminbar'}`, `performance {preset, strategy:'interaction'|'idle'|'defer'|'async'|'eager', position, fetchPriority, prefetch, pageCss, deviceSkip, optOut}`.

## Front-end contract
`window.kotlinskidevA11y = {v, features, profiles, widget, theme, tokens, storage, shortcut, hideToolbar, statementUrl, strings, locale, rtl, customCss}`.

## TS modules
- `bootstrap/index.ts`.
- `frontend/`: `store.ts`, `storage.ts`, `apply.ts`, `theme.ts` (matchMedia + MutationObserver on html/body class, sets `data-theme` on host), `panel.ts`, `a11y-dialog.ts`, `shortcut.ts`, `hash-open.ts`, `profiles.ts`, `features/<key>.ts` each exporting `{key, on(level), off()}`.
- `admin/`: `api.ts`, `form-renderer.ts`, `fields/*.ts`, `import-export.ts`, `preview.ts`, `alt-text.ts`.

## SCSS
`src/scss/widget/` (`_tokens`, `_launcher`, `_panel`, `_toggles`, `_themes` with `:host([data-theme=dark])`, `index`) compiled to string injected into shadow root; `src/scss/page/` one partial per document-level feature to `frontend.css`; `src/scss/admin/index.scss`.

## i18n
Text domain `kotlinskidev-accessibility`, `load_plugin_textdomain` on `init`. Admin bundle built with `minifyIdentifiers:false`, `wp.i18n` external. `wp i18n make-pot . languages/kotlinskidev-accessibility.pot --include=src/php,build`, then `make-json`. RTL locales set `dir=rtl` on host.

## Release pipeline
`Updater`: `PucFactory::buildUpdateChecker('https://github.com/Kotlinski95/kotlinskidev-accessibility-plugin/', PLUGIN_FILE, 'kotlinskidev-accessibility')` then `getVcsApi()->enableReleaseAssets(...)`. `release.yml` on tag `v*`: npm ci + build, composer install --no-dev -o, `bin/check-version.mjs` (header Version = package.json = tag), make-pot/make-json, rsync with `.distignore`, zip `kotlinskidev-accessibility.zip`, `softprops/action-gh-release`; fail if asset missing. `ci.yml` on PR: phpcs, PHPUnit, eslint, tsc, Jest, build.

## Tests
PHPUnit + Brain Monkey (Schema, Sanitizer, LanguageResolver, Visibility, REST permission + import round-trip). Jest jsdom (store, storage TTL/none, apply/revert per feature, theme, shortcut, profiles). Playwright on wp-env (open via Enter and `#kotlinskidev-a11y`, persist across reload, reset, locale via WPLANG, axe on panel).

## Milestones
1. M1 Scaffold: root config files, `bin/build.mjs`, plugin header, `Plugin.php`, empty entry points. Check `npm run build && composer install`.
2. M2 `Settings/{Schema,Repository,Sanitizer}.php` + tests. After 1.
3. M3 `Rest/SettingsController.php` + tests. After 2.
4. M4 `I18n/{LanguageResolver,Strings}.php` + tests + pot scripts. After 2.
5. M5 `Frontend/{Visibility,Assets,Markup}.php` + `src/ts/bootstrap`. After 3, 4.
6. M6 front-end core (store, storage, theme, panel, a11y-dialog, shortcut, hash-open, reset, hide toolbar) + `scss/widget` + Jest. After 5.
7. M7 content features + `scss/page` content partials + Jest. After 6.
8. M8 color + orientation features + Jest. After 6.
9. M9 profiles. After 7, 8.
10. M10 `Admin/SettingsPage.php` + `src/ts/admin` (form renderer, per-locale labels editor, import/export, live preview). After 3.
11. M11 `Statement/Shortcode.php`, `Admin/{AltTextPage,DashboardWidget}.php`, `alt-text.ts`. After 10.
12. M12 `Update/Updater.php`, both workflows, `bin/check-version.mjs`. After 1.
13. M13 `.wp-env.json` + `tests/e2e`. After 9, 11.
14. M14 (theme repo, new `feature/T{n}` branch): remove `functions/onetap-inline-style.php` and its require in `functions.php`, update `docs/treeview.md` + `CHANGELOG.md`, `npm run release`, `graphify update .`. Only after plugin replaces OneTap live.

## Risks
Per-element font scaling cost (batch in rAF, observe only added nodes, skip excludeSelectors and `#ka11y-root`); filters on `body > *` miss later-moved nodes (MutationObserver re-apply); JSON translation filename must match script handle; release asset must be attached; page caches must vary per language; localStorage use is strictly-necessary (admin note + `storage.mode=none`); theme toggles `html.light-mode`/`html.dark-mode` so default selector covers both.
