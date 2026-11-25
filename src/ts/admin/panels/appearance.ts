import { __ } from '@wordpress/i18n';
import type { FormContext } from '../context';
import { fieldset, h } from '../dom';
import { createColorField } from '../fields/color';
import { createNumberField } from '../fields/number';
import { createSelectField, enumChoices } from '../fields/select';
import { createTextField } from '../fields/text';
import { createTextareaField } from '../fields/textarea';
import { createToggleField } from '../fields/toggle';
import { panelPresetLabel, panelSectionLabel, themeModeLabel, tokenLabel } from '../labels';
import { CUSTOM_PRESET, PRESET_TOKEN_KEYS, isManagedPreset, matchesPreset, presetTokens } from '../presets';

const PRESET_PATH = 'panel.preset';
const SECTIONS: readonly string[] = ['profiles', 'content', 'color', 'orientation', 'skip'];
const COLUMN_CHOICES = [
  { value: 2, label: '2' },
  { value: 3, label: '3' },
];

const tokenPath = (key: string): string => `tokens.${key}`;

const currentTokens = (ctx: FormContext): Record<string, unknown> => {
  const tokens = ctx.state.get('tokens');
  return typeof tokens === 'object' && tokens !== null ? (tokens as Record<string, unknown>) : {};
};

const applyPreset = (ctx: FormContext, preset: string): void => {
  const values = presetTokens(preset, currentTokens(ctx));
  if (values === null) return;
  for (const key of PRESET_TOKEN_KEYS) ctx.state.set(tokenPath(key), values[key]);
};

const watched = new WeakSet<FormContext['state']>();

const watchPreset = (ctx: FormContext): void => {
  if (watched.has(ctx.state)) return;
  watched.add(ctx.state);
  let lastPreset = ctx.state.get(PRESET_PATH);
  let busy = false;

  ctx.state.subscribe(() => {
    if (busy) return;
    const preset = ctx.state.get(PRESET_PATH);
    if (typeof preset !== 'string') return;
    busy = true;
    try {
      if (preset !== lastPreset) {
        lastPreset = preset;
        if (isManagedPreset(preset)) {
          applyPreset(ctx, preset);
          ctx.reload();
        }
      } else if (isManagedPreset(preset) && !matchesPreset(preset, currentTokens(ctx))) {
        lastPreset = CUSTOM_PRESET;
        ctx.state.set(PRESET_PATH, CUSTOM_PRESET);
        ctx.reload();
      }
    } finally {
      busy = false;
    }
  });
};

const colorField = (ctx: FormContext, token: string): HTMLElement => createColorField(ctx, { path: tokenPath(token), token, label: tokenLabel(token) });

export const buildAppearancePanel = (ctx: FormContext): HTMLElement => {
  watchPreset(ctx);

  return h(
    'div',
    { class: 'ka11y-panel ka11y-panel--appearance' },
    fieldset(
      __('Theme', 'kotlinskidev-accessibility'),
      'ka11y-theme',
      createSelectField(ctx, { path: 'theme.mode', label: __('Widget theme', 'kotlinskidev-accessibility'), choices: enumChoices(ctx, 'theme.mode', themeModeLabel) }),
      createTextField(ctx, {
        path: 'theme.darkSelector',
        label: __('Dark mode selector', 'kotlinskidev-accessibility'),
        help: __('CSS selector that matches your site when it is in dark mode.', 'kotlinskidev-accessibility'),
      }),
      createTextField(ctx, {
        path: 'theme.lightSelector',
        label: __('Light mode selector', 'kotlinskidev-accessibility'),
        help: __('CSS selector that matches your site when it is in light mode.', 'kotlinskidev-accessibility'),
      }),
      createToggleField(ctx, { path: 'theme.followPrefersColorScheme', label: __('Follow the visitor color scheme preference', 'kotlinskidev-accessibility') })
    ),
    fieldset(
      __('Panel layout', 'kotlinskidev-accessibility'),
      'ka11y-panel-layout',
      createSelectField(ctx, {
        path: 'panel.columns',
        label: __('Tile columns', 'kotlinskidev-accessibility'),
        help: __('Columns on desktop and tablet. Narrow panels use fewer columns automatically.', 'kotlinskidev-accessibility'),
        choices: COLUMN_CHOICES,
      }),
      ...SECTIONS.map((section) => createToggleField(ctx, { path: `panel.sections.${section}`, label: panelSectionLabel(section) })),
      h('p', { class: 'description' }, __('Hidden cards stay usable through triggers and the JavaScript API.', 'kotlinskidev-accessibility')),
      createToggleField(ctx, {
        path: 'panel.languageSwitcher',
        label: __('Show the language switcher', 'kotlinskidev-accessibility'),
        help: __('Shown only when the site has two or more languages.', 'kotlinskidev-accessibility'),
      })
    ),
    fieldset(
      __('Colors', 'kotlinskidev-accessibility'),
      'ka11y-colors',
      createSelectField(ctx, {
        path: PRESET_PATH,
        label: __('Color preset', 'kotlinskidev-accessibility'),
        help: __('A preset fills in the colors below. Changing any color switches to Custom.', 'kotlinskidev-accessibility'),
        choices: (ctx.schema.definitions[PRESET_PATH]?.enum ?? []).map((value) => ({ value, label: panelPresetLabel(value) })),
      }),
      h('p', { class: 'description' }, __('Each color shows its contrast ratio. Text needs at least 4.5:1 and controls at least 3:1.', 'kotlinskidev-accessibility')),
      ...PRESET_TOKEN_KEYS.map((token) => colorField(ctx, token))
    ),
    fieldset(
      __('Shape and type', 'kotlinskidev-accessibility'),
      'ka11y-shape',
      createTextField(ctx, {
        path: 'tokens.radius',
        label: __('Corner radius', 'kotlinskidev-accessibility'),
        help: __('Any CSS length, for example 12px or 0.75rem.', 'kotlinskidev-accessibility'),
      }),
      createNumberField(ctx, { path: 'tokens.zIndex', label: __('Stacking order (z-index)', 'kotlinskidev-accessibility') }),
      createTextField(ctx, {
        path: 'tokens.fontFamily',
        label: __('Font family', 'kotlinskidev-accessibility'),
        help: __('Use inherit to follow the site font.', 'kotlinskidev-accessibility'),
      })
    ),
    createTextareaField(ctx, {
      path: 'customCss',
      label: __('Custom CSS', 'kotlinskidev-accessibility'),
      help: __('Applied to the widget and the page. Tags are removed on save.', 'kotlinskidev-accessibility'),
      rows: 8,
      code: true,
    })
  );
};
