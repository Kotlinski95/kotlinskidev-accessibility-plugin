# Phase 5 spec: UI parity, v0.4.0

Status: draft for owner review. Source of truth for Phase 5 once approved. It replaces the Phase 5 section of `ROADMAP.md` where the two differ.

Reference: three owner screenshots of the OneTap panel (header, content card, color and orientation cards, skip select, reset button). Layout, behaviour and general design language may match. No CSS, icons, text or code are copied from OneTap.

Rules for every milestone: strict TypeScript (no `any`), no comments anywhere, WPCS PHP, no jQuery, no React, all strings through i18n, no `innerHTML` in the widget. Nothing new goes into the bootstrap, the loader or the inline config: `everyPage` is at 5238 of 5250 B.

## Open decisions for the owner

| # | Decision | Recommendation |
| --- | --- | --- |
| D1 | Modality: keep `aria-modal="true"` with a focus trap, or a non-modal dialog. | Non-modal. `role="dialog"` without `aria-modal`, no Tab trap, no light dismiss. Visitors must see and use the page while they change it. Fixes the semantic mismatch noted in the roadmap baseline. |
| D2 | Multi-level features: steppers or cycle tiles. | Steppers (minus, value, plus) for `biggerText` and `lineHeight` only. Cycle tiles with level dots for `textAlign` (3) and `saturation` (2). |
| D3 | Keep profiles. | Keep, as the first card, same tile component, hideable in the admin. No other plugin feature is removed. |
| D4 | Where icons live. | Path data only, in the panel-data JSON under `icons`, generated at build time into `build/icons.json` (new budget `data.icons` 2048 B gzip). The panel builds each SVG with `createElementNS`. No extra request, no new chunk name, no growth of the panel chunk. |
| D5 | Icon source. | A subset of Lucide (ISC licence, stroke icons on a 24 grid), adjusted where needed, with `assets/icons/LICENSE`. Drawing a full own set costs a week for no user gain. If the owner wants a fully own set, only the SVG files change. |
| D6 | Budgets (section 9). | `scripts.panel` 7168 to 8192 gzip, new `data.icons` 2048 gzip, `styles.launcher` 1400 to 1440 raw. `everyPage`, loader, bootstrap and kernel unchanged. |
| D7 | Desktop layout: keep the popover anchored to the launcher, or a full-height side panel. | Side panel docked to the launcher's side, 28rem wide. Bottom sheet on mobile. The popover is removed, not kept as an option. |
| D8 | Language switcher scope. | Changes the widget language only, never the site. Native `<select>`, native language names, no flags. Choice saved in `localStorage` under `<storage.key>-locale` (new key; `ka11y` stays untouched). Shown only with two or more known locales. |
| D9 | Tile keyboard model: roving tabindex with arrow keys, or plain Tab. | Plain Tab. Predictable in a non-modal panel, no extra bytes, no arrow-key conflict with screen readers. |
| D10 | Feature descriptions: the tile has no room for them. | Keep them as `hidden` text referenced by `aria-describedby`. Screen readers still announce them; sighted visitors get the short label. |

## 0. Goals and non-goals

Goals:

1. A panel that matches the reference layout: dark header with language switcher, title and meta links; rounded section cards; icon tiles in a grid; steppers; a skip-to-content select; a full-width reset button.
2. Non-modal behaviour (D1) with correct focus, Escape and announcements.
3. Desktop side panel and mobile bottom sheet with safe-area insets, `transform` and `opacity` motion only, reduced motion, forced colors, RTL, 44 px targets, light and dark themes with checked contrast.
4. Admin style presets, new tokens with a live contrast check, tile columns, section visibility, language switcher toggle.
5. Visual snapshots the owner approves (the Phase 5 done-when).

Non-goals:

- New features or profiles. The 26 feature keys and 5 profile keys stay.
- Changes to the bootstrap, loader, inline config, triggers, public API or events (Phase 4 contracts).
- Branding text ("Powered by"). The meta row shows the statement link and "Hide toolbar".
- Drag gestures on the bottom sheet.
- Switching the language of runtime feature strings already applied on the page (for example read-aloud voice). They follow on the next page load.

## 1. Frozen contracts

Everything in PHASE4-SPEC section 1 stays, plus the Phase 4 API and events. In addition:

| Contract | Value |
| --- | --- |
| Panel id | `#ka11y-panel` inside the shadow root, `role="dialog"`, `aria-labelledby="ka11y-panel-title"` |
| Launcher | `.ka11y-launcher`, `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls="ka11y-panel"` |
| Feature hooks on controls | `data-feature="<key>"` on every tile and stepper, `data-profile="<key>"` on profile tiles |
| Store | `levels`, `open`, `SavedState` format unchanged; the panel only calls `setLevel`, `set({ open })`, `reset` and `profiles.toggle` |
| Panel data route | `GET kotlinskidev-a11y/v1/panel-data?locale=` unchanged; payload is additive |

Breaking for site owners: internal shadow classes change (`.ka11y-toggle`, `.ka11y-profile`, `.ka11y-grid`, `.ka11y-feature`, `.ka11y-section`, `.ka11y-group` are removed). Custom CSS that targets them must be updated. One `Changed` line in the CHANGELOG and a README note.

## 2. Gap list (v0.3.0 vs reference)

| # | Area | v0.3.0 | Target |
| --- | --- | --- | --- |
| G1 | Container | Popover anchored to the launcher, max 24rem by 40rem | Full-height side panel on desktop, bottom sheet on mobile (D7) |
| G2 | Modality | `aria-modal="true"`, Tab trap, page still clickable | Non-modal dialog (D1) |
| G3 | Header | Primary-colour bar with title and close | Dark band: language pill and close on top, round accessibility icon, large centred title, meta row "Accessibility statement • Hide toolbar" |
| G4 | Language | None in the panel | Language select (D8) |
| G5 | Hide toolbar | Footer disclosure | Meta-row button, same disclosure menu below it |
| G6 | Sections | Flat list, uppercase group titles | Rounded cards with titles on a tinted canvas: Profiles, Content, Color, Orientation, Skip to content |
| G7 | Controls | Full-width text toggles with state text and visible description | Icon tiles (icon disc above label) in a 3-column grid, check badge when on, level dots for multi-level tiles |
| G8 | Font size, line height | Cycle toggles | Steppers spanning two columns: minus, value ("Default", "Low", "Medium", "High"), plus |
| G9 | Skip to content | Select hidden until the feature is on | Own card, select always visible with "Choose…" and the landmarks found |
| G10 | Reset | Bordered button in the footer | Full-width solid button in a sticky footer |
| G11 | Focus | 3px outline in the primary focus colour | Strong 3px ring with 2px offset on every control, header ring in the header text colour |
| G12 | Dark mode | Surfaces swap, primary unchanged | Full dark palette including a lighter primary for pressed tiles (contrast fix, section 5.2) |
| G13 | Icons | None in the panel | Own inline SVG set from path data (D4, D5) |
| G14 | Motion | Fade and 0.5rem slide | Slide in from the docked side or from the bottom, fade; reduced motion is a plain fade-free switch |
| G15 | Forced colors | Not handled | System colours for tiles, pressed state, focus, launcher outline |
| G16 | Host transform | `#ka11y-root` gets `transform: translateY(-50%)` for `middle-*` positions | No transform on the host: a transformed host would become the containing block of the fixed panel |

## 3. Layout

### 3.1 Containers

- The panel is `position: fixed` inside the shadow root. The host keeps `position: fixed` and must never carry `transform`, `filter`, `perspective` or `contain` (G16).
- The panel chunk sets `data-layout="side"` or `"sheet"` on the panel from `matchMedia(data.layout.sheetQuery)`, and listens for its `change` event. `sheetQuery` is the mobile query from `InlineConfig::device_queries()`, default `(max-width:768px)`.
- Side: `inset-block: 0`, `inline-size: min(28rem, 100vw)`, docked to the launcher's physical side: `data-side="left"` when the host centre is in the left half of the viewport, else `"right"`. Computed on every open, as `placePanel` does today.
- Sheet: `inset-inline: 0`, `inset-block-end: 0`, `max-block-size: 85dvh`, top corners rounded, `padding-block-end: env(safe-area-inset-bottom)`, `padding-inline: env(safe-area-inset-left) env(safe-area-inset-right)`.
- The launcher stays visible and clickable in both layouts (it toggles the panel). In side layout the panel covers it when docked to the same side; the close button is the visible way out, Escape and the shortcut work too.

### 3.2 Inside the panel

- `.ka11y-head__bar` (language select and close) is sticky at the top. `.ka11y-foot` (reset) is sticky at the bottom. The big icon, title and meta row scroll away.
- `.ka11y-body` has `scroll-padding-block` equal to the sticky bar and footer heights, so a focused tile is never hidden under them (WCAG 2.4.11).
- Under `(max-height: 30rem)` nothing is sticky, so zoomed or landscape views keep room for content.
- `.ka11y-body` is a size container (`container: ka11y-body / inline-size`). Tile grid: `repeat(var(--ka11y-w-cols), minmax(0, 1fr))`, where `--ka11y-w-cols` comes from `data-columns` (2 or 3). Below 22rem container width it is 2, below 15rem it is 1. Steppers span 2 columns, or 1 when the grid has 1.
- No fixed heights anywhere: tiles use `min-block-size`, so text spacing overrides (WCAG 1.4.12) and 200 percent text do not clip.
- At 320 CSS px wide (400 percent zoom of 1280) the sheet has no horizontal scroll (WCAG 1.4.10).

### 3.3 Order of cards

Profiles, Content, Color, Orientation, Skip to content. A card renders only when its section is on (section 7) and it has at least one enabled item. Within Content the steppers come first, then tiles in `FEATURE_GROUPS` order. `skipToContent` never renders as a tile; when it is enabled and the Skip section is on, it renders as its own card.

## 4. DOM and ARIA

### 4.1 Structure

Built with `createElement` and a new `createSvg` helper in `dom.ts`. Shown with the panel open, theme and layout attributes set:

```html
<div id="ka11y-panel" class="ka11y-panel" role="dialog" aria-labelledby="ka11y-panel-title" data-layout="side" data-side="right" data-columns="3">
  <header class="ka11y-head">
    <div class="ka11y-head__bar">
      <label class="ka11y-sr" for="ka11y-lang">Language</label>
      <select id="ka11y-lang" class="ka11y-lang">
        <option value="en_US" lang="en">English</option>
        <option value="pl_PL" lang="pl">Polski</option>
      </select>
      <button type="button" class="ka11y-close" aria-label="Close"><svg class="ka11y-svg" aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="..."/></svg></button>
    </div>
    <span class="ka11y-head__icon" aria-hidden="true"><svg class="ka11y-svg">...</svg></span>
    <h2 id="ka11y-panel-title" class="ka11y-title" tabindex="-1">Accessibility adjustments</h2>
    <p class="ka11y-meta">
      <a class="ka11y-meta__link" href="https://example.com/statement/">Accessibility statement</a>
      <span aria-hidden="true">•</span>
      <button type="button" class="ka11y-meta__link" aria-expanded="false" aria-controls="ka11y-hide-menu">Hide toolbar</button>
    </p>
    <div id="ka11y-hide-menu" class="ka11y-hide-menu" hidden>
      <button type="button" class="ka11y-chip">For this session</button>
      <button type="button" class="ka11y-chip" data-days="7">For 7 days</button>
    </div>
  </header>
  <div class="ka11y-body">
    <section class="ka11y-card" aria-labelledby="ka11y-card-content">
      <h3 id="ka11y-card-content" class="ka11y-card__title">Content</h3>
      <div class="ka11y-tiles">
        <div class="ka11y-stepper" role="group" aria-labelledby="ka11y-step-biggerText" data-feature="biggerText">
          <span id="ka11y-step-biggerText" class="ka11y-stepper__label">Bigger text</span>
          <div class="ka11y-stepper__row">
            <button type="button" class="ka11y-step" data-step="-1" aria-label="Decrease Bigger text" aria-disabled="true"><svg class="ka11y-svg">...</svg></button>
            <output class="ka11y-stepper__value" aria-live="polite">Default</output>
            <button type="button" class="ka11y-step" data-step="1" aria-label="Increase Bigger text"><svg class="ka11y-svg">...</svg></button>
          </div>
        </div>
        <button type="button" class="ka11y-tile" aria-pressed="false" aria-describedby="ka11y-desc-textAlign ka11y-state-textAlign" data-feature="textAlign">
          <span class="ka11y-tile__icon" aria-hidden="true"><svg class="ka11y-svg" data-flip="">...</svg></span>
          <span class="ka11y-tile__label">Align text</span>
          <span class="ka11y-dots" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="ka11y-tile__check" aria-hidden="true"><svg class="ka11y-svg">...</svg></span>
        </button>
        <span id="ka11y-desc-textAlign" hidden>Aligns text to the left, centre or right.</span>
        <span id="ka11y-state-textAlign" hidden>Off</span>
      </div>
    </section>
    <section class="ka11y-card" aria-labelledby="ka11y-card-skip">
      <h3 id="ka11y-card-skip" class="ka11y-card__title"><label for="ka11y-skip-select">Skip to content</label></h3>
      <select id="ka11y-skip-select" class="ka11y-select">
        <option value="">Choose…</option>
        <option value="main">Main content</option>
      </select>
    </section>
  </div>
  <footer class="ka11y-foot">
    <button type="button" class="ka11y-reset">Reset settings</button>
    <p class="ka11y-hint">Keyboard shortcut: Alt+Shift+A</p>
    <p class="ka11y-sr" role="status"></p>
  </footer>
</div>
```

Rules:

- `aria-modal` is never set (D1). `inert` stays on the closed panel, as today.
- Tiles: `<button type="button">` with `aria-pressed` `"true"` or `"false"`. The accessible name is the label only and never changes. Multi-level tiles reference a `hidden` state span (`levelText` result, for example "Center") through `aria-describedby`; single-level tiles reference only the description. Profile tiles have no description.
- Level dots: one `<i>` per level, `data-on` on the dots up to the current level. Dots are filled when on and outlined when off, so the level does not depend on colour (WCAG 1.4.1).
- Check badge: shown only on pressed tiles. Pressed state is therefore shape plus colour.
- Steppers: two buttons and an `<output aria-live="polite">`. Not `role="spinbutton"`: arrow-key support differs across screen readers and a spinbutton needs a numeric value. At a bound the button gets `aria-disabled="true"`, keeps focus and ignores activation. Values: level 0 shows `levelDefault`, levels 1 to 3 show the existing `FEATURE_LEVEL_LABELS`. Minus sits at inline start, plus at inline end, so RTL mirrors them.
- Icons: every `<svg>` has `aria-hidden="true"` and `focusable="false"`. Directional icons (`textAlign`, `bigCursor`, `readingLine` arrows, the select chevron) carry `data-flip` and mirror under `:host([dir="rtl"])`.
- Language select: labelled by a visually hidden `<label>`. Each `<option>` has its own `lang`. A missing `locales` list or fewer than two entries removes the select; the close button then sits alone at the inline end.
- Skip select: labelled by the card title. Options come from `findLandmarks` (first of each kind), rebuilt on every open. Choosing one calls `focusLandmark`, resets the select to "Choose…", and does not change `levels.skipToContent`. With no landmarks found, the card is hidden, as the select is today.
- Status region: `role="status"` paragraph exists from the first render; reset writes `resetDone`, language switch writes nothing (the page text change is the feedback).

### 4.2 New strings

Added to `I18n/Strings.php` and `pl_PL`: `levelDefault` "Default", `stepDecrease` "Decrease %s", `stepIncrease` "Increase %s", `language` "Language", `skipChoose` "Choose…", `resetDone` "All adjustments were reset.", `resetSettings` "Reset settings". `createTranslator` gains `format(key, value)` that replaces the first `%s`. Existing keys keep their text; `panelTitle`, `groupContent`, `groupColor`, `groupOrientation` and `profilesTitle` become the card titles.

## 5. Design tokens

### 5.1 Public tokens

Set from settings (`tokens.*`), overridable by custom CSS. Existing tokens keep their names and defaults. New tokens are panel-only: `Assets::root_variables()` skips the keys in `Schema::PANEL_TOKENS`, and the panel chunk sets them on the host with `style.setProperty` from `data.tokens`, so the page head does not grow.

| Setting | CSS property | Default | New |
| --- | --- | --- | --- |
| `tokens.primary` | `--ka11y-primary` | `#0b57d0` | no |
| `tokens.onPrimary` | `--ka11y-on-primary` | `#ffffff` | no |
| `tokens.primaryDark` | `--ka11y-primary-dark` | `#7aa7ff` | yes |
| `tokens.onPrimaryDark` | `--ka11y-on-primary-dark` | `#0b1a33` | yes |
| `tokens.headerBg` | `--ka11y-header-bg` | `#16181d` | yes |
| `tokens.onHeader` | `--ka11y-on-header` | `#ffffff` | yes |
| `tokens.canvasLight` | `--ka11y-canvas-light` | `#f2f4f7` | yes |
| `tokens.canvasDark` | `--ka11y-canvas-dark` | `#101114` | yes |
| `tokens.surfaceLight` (card) | `--ka11y-surface-light` | `#ffffff` | no |
| `tokens.surfaceDark` (card) | `--ka11y-surface-dark` | `#1b1b1f` | no |
| `tokens.textLight` | `--ka11y-text-light` | `#1b1b1f` | no |
| `tokens.textDark` | `--ka11y-text-dark` | `#f2f2f2` | no |
| `tokens.radius` (tile) | `--ka11y-radius` | `12px` | no |

Every color setting (`tokens.*` colors, `widget.bg`, `widget.fg`, `panel.backdropColor`) accepts a hex value or `var(--wp--preset--color--<slug>, #fallback)` where the slug matches `[a-z0-9-]+` and the fallback is hex. Anything else is rejected. The admin lists the theme palette from `wp_get_global_settings( array( 'color', 'palette' ) )` as `themePalette`; contrast checks use the fallback hex.

### 5.2 Internal tokens and contrast

Internal properties are `--ka11y-w-*` in `_panel-tokens.scss`. Light and dark values swap on `:host([data-theme="dark"])`, as today.

| Internal | Light | Dark | Checked pair (ratio) |
| --- | --- | --- | --- |
| `--ka11y-w-text` on `--ka11y-w-tile` | `#1b1b1f` on `#f5f6f8` | `#f2f2f2` on `#262a31` | 16.4, 12.9 |
| `--ka11y-w-muted` on card | `#4a5260` on `#fff` | `#b4bcc9` on `#262a31` | 7.9, 7.5 |
| pressed tile fill on card | `#0b57d0` on `#fff` | `#7aa7ff` on `#1b1b1f` | 6.4, 7.2 |
| text on pressed tile | `#fff` on `#0b57d0` | `#0b1a33` on `#7aa7ff` | 6.4, 7.3 |
| `--ka11y-w-focus` on card and tile | `#0b3fa8` on `#fff` / `#f5f6f8` | `#8fb4ff` on `#1b1b1f` / `#262a31` | 9.2 / 8.5, 8.3 / 7.0 |
| header text and header focus | `#fff` on `#16181d` | same | 17.8 |
| reset button | `#fff` on `#16181d` | `#16181d` on `#f2f2f2` | 17.8, 15.3 |

Two defects this fixes: v0.3.0 keeps `#0b57d0` as the pressed fill in dark mode (2.69 against `#1b1b1f`, under the 3:1 non-text minimum), and the light focus colour on a dark header is 1.94. Inside `.ka11y-head` the focus ring uses `--ka11y-on-header`.

Other internal values: `--ka11y-w-card-radius: calc(var(--ka11y-w-radius) + 0.5rem)`, `--ka11y-w-target: 2.75rem`, `--ka11y-w-panel-size: 28rem`, `--ka11y-w-in: 220ms`, `--ka11y-w-out: 160ms`, `--ka11y-w-ease: cubic-bezier(0.2, 0.8, 0.2, 1)`. Icons: `fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round`, 1.5rem in tiles inside a 2.75rem disc.

### 5.3 Targets and focus

- Every control is at least 44 by 44 CSS px: tiles `min-block-size: 6.5rem`, stepper buttons and close `2.75rem`, chips and meta buttons `min-block-size: 2.75rem`.
- Focus: `outline: 3px solid var(--ka11y-w-focus); outline-offset: 2px` on `:focus-visible` for every control, never removed. On a pressed tile the ring sits outside the fill, so it contrasts with the card.
- The title gets focus with `tabindex="-1"` and shows no ring (`:focus:not(:focus-visible)`).

### 5.4 Forced colors

`@media (forced-colors: active)` in `widget.css`:

- Tiles, steppers, cards and selects: `border: 1px solid ButtonText`.
- Pressed tiles: `border: 3px solid Highlight`, check badge in `Highlight`. The badge is the non-colour cue.
- Dots: `background: ButtonText` when on, `border: 1px solid ButtonText` when off.
- Focus: `outline-color: Highlight`.
- Launcher (`launcher.css`): `border: 2px solid #0000` on `.ka11y-launcher`. Transparent borders turn into the system colour under forced colors, so the circle stays visible. No media query needed (about 22 raw bytes).

### 5.5 Motion

- Only `transform` and `opacity` animate, plus `visibility` with a delay so the closed panel leaves the accessibility tree after the fade.
- Side: closed `transform: translateX(100%)` (`-100%` when `data-side="left"`), open `none`. Sheet: closed `translateY(100%)`. Opacity 0 to 1.
- Open uses `--ka11y-w-in` with `--ka11y-w-ease`; close uses `--ka11y-w-out` with `ease-in`.
- `prefers-reduced-motion: reduce`: no transform, `transition-duration: 0.01ms` for all panel transitions; the existing global reduced-motion block stays.
- Tile press: background and colour change only, no scale. Launcher hover scale stays in `widget.css` (already there).

### 5.6 RTL

- The host already gets `dir` and `lang`. All panel CSS uses logical properties except the side docking, which is physical by design (it follows the launcher).
- `[data-flip]` icons use `scale: -1 1` under `:host([dir="rtl"])`.
- The language switch sets `lang` and `dir` on the host from `locales[].rtl`.

## 6. Behaviour

### 6.1 Dialog (`a11y-dialog.ts`)

- Remove `trapTab`. Tab moves through the panel and then out of it into the page; Shift+Tab from the first control goes back into the page.
- Escape: the `keydown` listener moves from `document` to the shadow root plus the launcher. Escape closes only when focus is inside the panel or on the launcher. A page modal's own Escape is no longer swallowed.
- Open: focus `#ka11y-panel-title`. Close: existing return-focus chain (opener, launcher, previous, body) unchanged.
- Clicking the page does not close the panel. The launcher, the close button, Escape, the shortcut and every Phase 4 trigger do.
- `DialogOptions` gains `initialFocus: HTMLElement` and drops nothing; `Dialog` interface unchanged.

### 6.2 Controls

| Control | Activation | Effect | Feedback |
| --- | --- | --- | --- |
| Tile, single level | click, Enter, Space | `setLevel(key, !active)` | `aria-pressed`, check badge |
| Tile, multi level | same | next level, wrapping to 0 (existing `nextLevel`) | `aria-pressed`, dots, `hidden` state text |
| Stepper minus or plus | same | `setLevel(key, clamp(level ± 1, 0, levelCountOf(key)))` | output text announced politely, `aria-disabled` at bounds |
| Profile tile | same | `profiles.toggle(key)` | `aria-pressed`, check badge |
| Skip select | change | `focusLandmark`, then reset to "Choose…" | focus moves to the landmark |
| Reset | click | `store.reset()` | status `resetDone`, focus stays on the button |
| Language select | change | section 6.3 | text, `lang` and `dir` change; focus stays on the select |
| Hide toolbar | click | toggles the menu (`aria-expanded`); a chip hides for the session or N days and closes the panel | existing behaviour |

All controls render from store state in one `render(state)` pass, as today. No feature logic moves into the panel.

### 6.3 Language switch

1. `data.locales` is `Array<{ locale: string; label: string; rtl: boolean }>`, built by `LanguageResolver::known_locales()`. `label` is the native name from `\Locale::getDisplayLanguage( $locale, $locale )` when `intl` exists, else the locale code; filter `kotlinskidev_a11y_locale_label` ( `$label`, `$locale` ).
2. On change, the panel builds the URL from `config.data[1]` (the REST fallback): `searchParams.set('locale', value)`, `searchParams.delete('v')`, then fetches with `credentials: 'same-origin'`. Unknown locales are rejected by the existing route.
3. On success: save `value` in `localStorage` under `<storage.key>-locale` (try and catch), set host `lang` and `dir`, replace the strings, rebuild the panel content in place, keep it open, focus the language select. On failure: restore the previous select value, write `loadError` to the status region.
4. On mount, a saved locale that is in `data.locales` and differs from `data.locale` triggers one fetch before the first render. Unknown saved values are removed.
5. Panel data for the page locale stays the only request before first open. Nothing is added to the loader.

### 6.4 Theme

`createThemeResolver` is unchanged. The panel reads `data-theme` through CSS only.

## 7. Settings schema v4 and admin

### 7.1 Additions (`Schema::VERSION = 4`)

| Key | Type | Default | Notes |
| --- | --- | --- | --- |
| `tokens.primaryDark`, `tokens.onPrimaryDark`, `tokens.headerBg`, `tokens.onHeader`, `tokens.canvasLight`, `tokens.canvasDark` | color | section 5.1 | in `Schema::PANEL_TOKENS` |
| `panel.columns` | int, 2 to 3 | 3 | desktop and tablet; the container query still reduces it |
| `panel.sections.profiles`, `.content`, `.color`, `.orientation`, `.skip` | bool | true | hides the card only; features stay usable through triggers and the API |
| `panel.languageSwitcher` | bool | true | shown only with two or more locales |
| `panel.preset` | enum `classic`, `brand`, `soft`, `contrast`, `custom` | `classic` | admin helper only, never sent to the front end |

Migration v3 to v4 is additive: missing keys take defaults, nothing is renamed. A stored v4 option must keep working on v0.3.0 (unknown keys ignored); `RepositoryTest` proves it.

`PanelData::payload()` adds `panel` (columns, sections, languageSwitcher), `layout` (`sheetQuery`), `locales` and `icons`. `hash` covers them.

### 7.2 Presets

A preset writes token values into the form; saving stores tokens, and the runtime never sees the preset name. Editing any token switches the select to `custom`.

| Preset | headerBg / onHeader | primary / onPrimary | canvasLight / surfaceLight | Notes |
| --- | --- | --- | --- | --- |
| `classic` | `#16181d` / `#ffffff` | `#0b57d0` / `#ffffff` | `#f2f4f7` / `#ffffff` | defaults, closest to the reference |
| `brand` | primary / onPrimary | unchanged | `#f2f4f7` / `#ffffff` | header follows the brand colour |
| `soft` | `#e8ecf3` / `#1b1b1f` | `#0b57d0` / `#ffffff` | `#f7f8fa` / `#ffffff` | light header |
| `contrast` | `#000000` / `#ffffff` | `#000000` / `#ffff00` | `#ffffff` / `#ffffff` | black and white, yellow on black |

Dark values of each preset are listed in `src/ts/admin/presets.ts` and must pass the same checks.

### 7.3 Contrast check

In the Appearance tab, every color field shows a live badge with the ratio against its pair and AA pass or fail:

| Pair | Minimum |
| --- | --- |
| onPrimary on primary, onPrimaryDark on primaryDark, onHeader on headerBg, text on surface (light and dark) | 4.5 |
| primary on surfaceLight, primaryDark on surfaceDark, focus colour on surface | 3 |

A failing pair shows a warning notice on save; saving is not blocked. The ratio function lives in `src/ts/admin/contrast.ts` (WCAG 2.x relative luminance), with unit tests on known pairs.

### 7.4 Other admin fields

Appearance tab: preset select, new token fields, tile columns (2 or 3), section toggles, language switcher toggle. The existing preview (`preview.ts`) renders the new panel classes with the current tokens in light and dark.

## 8. Icons

- Source: `src/icons/<key>.svg`, one per feature key, profile key and UI name (`close`, `plus`, `minus`, `check`, `chevron`, `access`). Each file: `viewBox="0 0 24 24"`, only `<path>` elements, no `fill`, `transform`, `style` or `class`.
- `bin/build.mjs` joins each file's paths into one `d` string and writes `build/icons.json` as `{"v":1,"icons":{"<name>":"<d>"}}`. The build fails on any other element or attribute.
- `src/php/Frontend/Icons.php` reads `build/icons.json` like `launcher.css` is read, applies filter `kotlinskidev_a11y_icons` (array name to `d`), and keeps only known names whose value matches `^[MmZzLlHhVvCcSsQqTtAa0-9eE.,+\s-]{1,1500}$`.
- The panel validates the same pattern before `setAttribute('d', ...)`. A missing or invalid icon renders the tile without an icon disc; nothing else breaks.
- About 40 icons at roughly 45 B gzip each: about 1.8 KB, budget 2048.

## 9. Size budget

Measured now (`npm run check-budget`): panel 5875 of 7168, launcher raw 1396 of 1400, everyPage 5238 of 5250, kernel 5160 of 5632.

| Item | Lives in | Estimate (gzip) |
| --- | --- | --- |
| Header, language select, meta row, moved hide menu | panel TS | +250 |
| Tiles, dots, check badge, state spans | panel TS | +200 |
| Steppers | panel TS | +260 |
| Cards, sections, columns, layout, side docking, token setter | panel TS | +230 |
| `createSvg`, icon validation | panel TS | +90 |
| Language switch fetch, rebuild, persistence | panel TS | +330 |
| Escape scoping, initial focus, reset status | dialog and panel TS | +110 |
| Trap removal, vertical placement removal | dialog and panel TS | −150 |
| Widget CSS rewrite (cards, tiles, stepper, side, sheet, motion, forced colors, RTL, container queries) | panel chunk CSS | +450 |
| Total | | about +1770, so about 7650 |

Decision (D6):

- `scripts.panel` 7168 to 8192. It loads only on first open or hover prefetch, never on every page.
- New `data.icons` 2048 gzip, measured on `build/icons.json` by `bin/check-budget.mjs`.
- `styles.launcher` 1400 to 1440 raw, for the forced-colors border. First try to fit it in 1400 by shortening selectors in `launcher/_state.scss`; raise only if that fails.
- `everyPage`, `inline.bootstrap`, `scripts.loader`, `scripts.kernel`, feature chunks and `styles.page` unchanged.

Hard rules:

- Nothing from this phase goes into `launcher.css` except the transparent border. Panel layout, tile, sheet, forced-colors and motion CSS live in `widget.css` inside the panel chunk.
- If the panel is over 8192 after M5.4 and M5.5: drop saved-locale restore on mount (switch stays for the visit), then merge the stepper into the cycle tile for `lineHeight`. Do not raise again without the owner.
- Every milestone from M5.2 on puts the `check-budget` output in its report.

## 10. Test plan

### 10.1 PHPUnit (`tests/php`)

- `Settings/SchemaTest`, `SanitizerTest`: v4 definitions, columns clamp, section bools, the six color tokens, preset enum, `PANEL_TOKENS` list.
- `Settings/RepositoryTest`: v3 to v4 migration keeps every v3 value; a v4 option read by v3 code paths keeps defaults.
- `Frontend/PanelDataTest`: `panel`, `layout.sheetQuery` from breakpoints, `locales` with labels and `rtl`, `icons` present, hash changes when any of them change.
- `Frontend/IconsTest`: missing file gives an empty map, filter override accepted, unknown names and invalid `d` dropped.
- `Frontend/AssetsTest`: `root_variables` excludes panel tokens; `middle-*` placement has no `transform`; offsets add `env(safe-area-inset-*)`.
- `I18n/LanguageResolverTest`: label with and without `intl`, the label filter.

### 10.2 Jest (`tests/js`)

- `panel.test.ts` (rewrite): no `aria-modal`; tiles `aria-pressed`, check badge, dots per level, state text; stepper clamps, `aria-disabled` at bounds, output text; profile tiles; sections off remove cards; `data-columns`; skip select options and reset to "Choose…"; reset status text; invalid icon path skipped; no `innerHTML` used (spy).
- `a11y-dialog.test.ts`: no Tab trap; Escape closes only from inside the panel or launcher; initial focus on the title; return-focus chain unchanged.
- `panel-language.test.ts`: URL built from `data[1]` with `locale` set and `v` removed; success rebuilds strings and sets `lang` and `dir`; failure restores the select; saved locale fetched on mount; unknown saved locale removed.
- `panel-layout.test.ts`: `matchMedia` switches `side` and `sheet`; `data-side` from the host rect.
- `admin/contrast.test.ts`: black on white 21, `#0b57d0` on white 6.39, `#0b3fa8` on `#16181d` 1.94 fails.
- `check-budget.test.ts`: `data.icons` entry read from `build/icons.json`.

### 10.3 Playwright behaviour (`tests/e2e/panel-ui.spec.ts`)

1. Open panel: no `aria-modal`; a link on the page behind the panel is clickable and the panel stays open.
2. Open moves focus to the title; Escape inside closes and returns focus; Escape with focus on the page does not close.
3. Tab from the last control leaves the panel.
4. Tile toggles `aria-pressed` and the page root class; reload keeps it.
5. `textAlign` tile cycles 1, 2, 3, 0 with dots and described state.
6. Stepper: plus to High, plus is `aria-disabled`, minus back to Default; Enter and Space work.
7. Skip select focuses `main`.
8. Reset turns everything off, status text present, focus on reset.
9. Language: switch to Polish, title and `lang` change, focus on the select, choice survives reload; an RTL locale sets `dir="rtl"`.
10. Hide toolbar chip hides the launcher for the session.
11. `panel.sections.color = false` removes the Color card; `panel.columns = 2` gives two columns.
12. Mobile 390 by 844: sheet layout, `padding-block-end` uses the safe area, the page above the sheet scrolls.
13. Desktop with `bottom-left`, `bottom-right` and `middle-right`: panel docks to that side and fills the viewport height (no transformed host).
14. `reducedMotion: 'reduce'`: computed transition duration under 1 ms. `forcedColors: 'active'`: tile border colour is not transparent; pressed tile border differs from unpressed.
15. 320 by 640 viewport: `scrollWidth` of the panel body equals `clientWidth`.
16. axe on the open panel in light, dark and sheet layouts: no serious or critical issues.

The existing `panel.spec.ts` trap test is replaced by test 3; the RTL locale comes from a test mu-plugin filtering `kotlinskidev_a11y_current_locale` to `he_IL` behind a query flag.

### 10.4 Visual snapshots (`tests/e2e/visual.spec.ts`, tag `@visual`)

Chromium only, inside the Playwright Docker image for stable fonts, `animations: 'disabled'`, `maxDiffPixelRatio: 0.01`, panel element only.

| Theme | Viewport | Locale | State |
| --- | --- | --- | --- |
| light, dark | 1280 by 800 | en_US, pl_PL | defaults |
| light, dark | 390 by 844 | en_US, pl_PL | defaults |
| light | 1280 by 800 | he_IL (RTL) | defaults |
| dark | 390 by 844 | he_IL (RTL) | defaults |
| light | 1280 by 800 | en_US | forced colors |
| light | 1280 by 800 | en_US | three tiles on, `biggerText` 2, `textAlign` 2, one profile |

Twelve baselines plus the launcher alone in light, dark and forced colors. The owner approves the baselines; that approval closes Phase 5.

## 11. Milestones

Agents: `kd-core:coder`, `kd-core:maker`, `kd-core:thinker`, `kd-web:accessibility-reviewer`, `kd-web:security-reviewer`, and the plugin-repo agents `widget-tester` and `onetap-parity-reviewer`. Each milestone runs the verify command plus its listed checks. One e2e suite against one wp-env at a time.

### M5.1 Settings v4, panel data, host placement (kd-core:coder)

Depends on: none.

Files: `src/php/Settings/Schema.php`, `Sanitizer.php`, `Repository.php`; `src/php/Frontend/PanelData.php`, `Assets.php`; `src/php/I18n/LanguageResolver.php`, `Strings.php`; `src/ts/shared/types.ts` (`PanelData` gains `panel`, `layout`, `locales`, `icons`; `TokensConfig` gains six keys); tests from 10.1 for these files.

Acceptance: 10.1 cases green; `GET /schema` lists the new keys; `middle-right` host has no `transform` in wp-env; inline head CSS measured before and after in the report.

Rollback: revert. The v0.3.0 panel ignores the new payload keys.

### M5.2 Icon set, build step, budget (kd-core:coder, then kd-web:security-reviewer)

Depends on: M5.1.

Files: `src/icons/*.svg`, `assets/icons/LICENSE`, `bin/build.mjs`, `bin/check-budget.mjs`, `bin/budgets.json` (`data.icons` 2048 only), `src/php/Frontend/Icons.php`, `PanelData.php` (wire `icons`), `tests/php/Frontend/IconsTest.php`, `tests/js/check-budget.test.ts`.

Acceptance: build fails on a fixture SVG with a `<script>` or `fill`; `data.icons` at most 2048; filter override covered.

Rollback: revert; `icons` becomes an empty map and tiles render without icons.

### M5.3 Non-modal dialog and layout (kd-core:coder, then kd-web:accessibility-reviewer)

Depends on: M5.1.

Files: `src/ts/frontend/a11y-dialog.ts`, `src/ts/frontend/panel/layout.ts` (new: `matchMedia`, `data-layout`, `data-side`), `tests/js/a11y-dialog.test.ts`, `tests/js/panel-layout.test.ts`.

Acceptance: 10.2 dialog and layout cases; reviewer confirms D1 behaviour against WAI-ARIA APG non-modal dialog guidance.

Rollback: revert both files; the v0.3.0 trap returns.

### M5.4 Panel DOM rebuild (kd-core:coder)

Depends on: M5.2, M5.3.

Files: `src/ts/frontend/panel.ts` (reduced to composition), new `src/ts/frontend/panel/header.ts`, `cards.ts`, `tile.ts`, `stepper.ts`, `skip.ts`, `footer.ts`, `icons.ts`; `src/ts/frontend/dom.ts` (`createSvg`); `src/ts/frontend/translate.ts` (`format`); `src/ts/frontend/chunks/panel.ts` (token setter); `tests/js/panel.test.ts`.

Acceptance: 10.2 panel cases; DOM matches section 4.1; no `innerHTML`; `check-budget` in the report.

Rollback: revert; M5.1 to M5.3 stay compatible with the old panel only if M5.3 is reverted too (old panel expects the trap). Revert M5.3 and M5.4 together.

### M5.5 Widget and launcher styles (kd-core:coder, then kd-web:accessibility-reviewer)

Depends on: M5.4 (class names). Can start in parallel against section 4.1 once M5.4's markup is merged.

Files: `src/scss/widget/_panel-tokens.scss`, `_panel.scss`, `_toggles.scss` (renamed `_tiles.scss`), new `_cards.scss`, `_stepper.scss`, `_motion.scss`, `_forced.scss`, `index.scss`; `src/scss/launcher/_state.scss`, `src/scss/widget/_launcher.scss` (transparent border only); `bin/budgets.json` (`scripts.panel` 8192, `styles.launcher` up to 1440).

Acceptance: contrast table in 5.2 verified in the browser with computed colours; forced colors and reduced motion checked manually in Chromium emulation; `check-budget` green with the report.

Rollback: revert the SCSS and budget files together with M5.4.

### M5.6 Language switcher (kd-core:coder)

Depends on: M5.4.

Files: `src/ts/frontend/panel/language.ts` (new), `header.ts`, `panel.ts`, `tests/js/panel-language.test.ts`.

Acceptance: 10.2 language cases; manual switch EN, PL, he_IL in wp-env; panel stays under 8192.

Rollback: revert; header renders without the select.

### M5.7 Admin appearance (kd-core:coder)

Depends on: M5.1.

Files: `src/ts/admin/panels/appearance.ts`, `src/ts/admin/presets.ts` (new), `src/ts/admin/contrast.ts` (new), `src/ts/admin/fields/color.ts` (badge), `src/ts/admin/preview.ts`, `src/scss/admin/_preview.scss`, `_fields.scss`, `tests/js/admin/contrast.test.ts`, `tests/js/admin/presets.test.ts`.

Acceptance: every preset passes 7.3 in light and dark; badge updates on input; `admin.spec.ts` axe check green.

Rollback: revert; settings saved with new tokens stay valid.

### M5.8 E2E and visual snapshots (kd-core:coder, then widget-tester and kd-core:thinker)

Depends on: M5.5, M5.6, M5.7.

Files: `tests/e2e/panel-ui.spec.ts`, `tests/e2e/visual.spec.ts`, `tests/e2e/panel.spec.ts` (trap test replaced), `tests/e2e/support/` (RTL mu-plugin, settings helper), `playwright.config.ts` (`@visual` project), baseline PNGs.

Acceptance: 10.3 and 10.4 green; `@smoke` green; hostile fixture theme suite green; snapshots sent to the owner.

Rollback: revert test files only.

### M5.9 Parity review, docs, translations (onetap-parity-reviewer, then kd-core:maker)

Depends on: M5.8.

Files: `languages/*` (pot, pl_PL po, mo, json), `README.md` (custom CSS class change, new settings), `CHANGELOG.md`, `docs/ROADMAP.md` (Phase 5 status), `docs/HANDOFF.md`.

Acceptance: the reviewer closes every row of section 2 or files it as a follow-up; `msgfmt --statistics` shows no untranslated strings; owner approves snapshots.

Rollback: revert docs.

### M5.10 Release v0.4.0 (kd-core:maker)

Depends on: M5.9 and owner approval. `npm run release`, `npm run check-version`, commit `chore: release v0.4.0`, tag, push only when the owner asks.

## 12. Risks

| Risk | Mitigation |
| --- | --- |
| Panel over 8192 B | Section 9 fallback order; no further raise without the owner. |
| A theme or optimizer adds `transform` or `filter` to `#ka11y-root` or `body` | Hostile fixture adds a transformed `body` case; panel e2e 13 asserts viewport height. Document in README. |
| Non-modal panel covers the launcher on the same side | Close button, Escape and shortcut stay; e2e 2 covers return focus. |
| Custom CSS targeting removed classes | CHANGELOG `Changed`, README migration table old to new class. |
| Visual snapshot flake from fonts | Docker image only, system font stack pinned in tests, `@visual` not in `@smoke`. |
| Locale labels without `intl` show codes | Label filter; README example. |
| Icon filter used to inject markup | Path data only, regex on both sides, `setAttribute` on a `path` element, never markup. |
