import { __ } from '@wordpress/i18n';
import type { FormContext } from '../context';
import { fieldset, h } from '../dom';
import { createColorField } from '../fields/color';
import { createNumberField } from '../fields/number';
import { createSelectField, enumChoices } from '../fields/select';
import { createTextField } from '../fields/text';
import { createTextareaField } from '../fields/textarea';
import { createToggleField } from '../fields/toggle';
import { themeModeLabel } from '../labels';

export const buildAppearancePanel = (ctx: FormContext): HTMLElement =>
  h(
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
      __('Colors', 'kotlinskidev-accessibility'),
      'ka11y-colors',
      createColorField(ctx, { path: 'tokens.primary', label: __('Primary color', 'kotlinskidev-accessibility') }),
      createColorField(ctx, { path: 'tokens.onPrimary', label: __('Text on primary color', 'kotlinskidev-accessibility') }),
      createColorField(ctx, { path: 'tokens.surfaceLight', label: __('Light surface', 'kotlinskidev-accessibility') }),
      createColorField(ctx, { path: 'tokens.surfaceDark', label: __('Dark surface', 'kotlinskidev-accessibility') }),
      createColorField(ctx, { path: 'tokens.textLight', label: __('Text on light surface', 'kotlinskidev-accessibility') }),
      createColorField(ctx, { path: 'tokens.textDark', label: __('Text on dark surface', 'kotlinskidev-accessibility') })
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
