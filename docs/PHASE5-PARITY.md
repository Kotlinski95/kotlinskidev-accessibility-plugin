# Phase 5 parity review

Compared: three owner screenshots of the reference panel (content modules, color and orientation modules, skip select and reset) against the macOS visual baselines `panel-desktop-light-en-US`, `panel-mobile-light-en-US`, `panel-mobile-dark-en-US` and `panel-desktop-light-en-US-active-state`. Layout, behaviour and design language only. No reference text, CSS or icons are used.

Closed by the rebuild: dark header band with language control and close, round accessibility icon, large title, meta row, rounded section cards on a tinted canvas, icon tiles with discs, steppers, full-width reset, non-modal side panel and bottom sheet, dark theme.

## Remaining gaps

| # | Area | Reference | Ours | Severity | Recommendation |
| --- | --- | --- | --- | --- | --- |
| P1 | Layout | Wide panel, two stepper rows each beside a tall tile | Stepper spans two of three columns and leaves an empty third cell, so the first Content row looks unbalanced | Medium | Pair the steppers with the next two tiles, or let a lone stepper span all columns. Follow-up for v0.4.x. |
| P2 | Layout | Desktop capture is wider with larger type and padding | The 28rem side panel makes the desktop baseline look like the mobile one | Low | Keep. Add a wider optional size (`panel.width`) only if owners ask. |
| P3 | Controls | Language control is a pill with flag and a custom dropdown | Native `select` styled as a pill, no flag, native arrow position is not mirrored by the pill padding | Low | Keep native for accessibility. Add `padding-inline-end` so the arrow never touches the text. Flags stay out of scope (D8). |
| P4 | Controls | Stepper order plus then minus, value between | Minus then value then plus, disabled minus drawn grey | Low | Keep. Minus at the start is the more common convention and mirrors in RTL. |
| P5 | Controls | Pressed tile is a dark outline with a thick border | Filled primary tile with a check badge | Low | Keep. The fill passes the non-color checks and the badge is the shape cue. |
| P6 | Sections | Titles "Content Modules", "Color Modules", "Orientation Modules" | Titles "Content", "Color", "Orientation" plus a Profiles card the reference lacks | Low | Keep. Profiles are a plugin feature (D3). |
| P7 | Sections | Skip to content select open in the reference with Main, Navigation, Footer | Card hidden when no landmark is found, so baselines do not show it | Low | Add a visual baseline of the Skip card with a page that has three landmarks. |
| P8 | Behaviour | Branding line "Powered by" | None | None | Intentional non-goal. |
| P9 | Behaviour | Reset is a sticky full-width button | Same, plus a keyboard shortcut hint | None | Closed. |
| P10 | Behaviour | Panel keeps page scroll position and focus order | Same, non-modal, Escape scoped to panel and launcher | None | Closed. |
| P11 | Visual QA | n/a | Baselines exist for macOS only. Linux baselines for CI are not generated | Medium | Generate in the Docker image before enabling `@visual` in CI. |
| P12 | Behaviour | Language change applies to the panel only | Same. Runtime feature strings such as the read-aloud voice follow on the next page load | Low | Document. Already a non-goal. |
