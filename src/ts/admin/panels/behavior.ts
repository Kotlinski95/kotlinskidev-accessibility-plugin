import { __ } from '@wordpress/i18n';
import type { FormContext } from '../context';
import { fieldset, h } from '../dom';
import { createComboField } from '../fields/combo';
import { createNumberField } from '../fields/number';
import { createSelectField, enumChoices } from '../fields/select';
import { createTextField } from '../fields/text';
import { createTextListField } from '../fields/text-list';
import { createToggleField } from '../fields/toggle';
import { loadStrategyLabel, storageModeLabel } from '../labels';

export const buildBehaviorPanel = (ctx: FormContext): HTMLElement =>
  h(
    'div',
    { class: 'ka11y-panel ka11y-panel--behavior' },
    fieldset(
      __('Remembering choices', 'kotlinskidev-accessibility'),
      'ka11y-storage',
      h(
        'p',
        { class: 'description ka11y-gdpr' },
        __(
          'Saving a visitor choice in the browser is strictly necessary to provide the accessibility features they asked for. Choose Do not remember choices to store nothing.',
          'kotlinskidev-accessibility'
        )
      ),
      createSelectField(ctx, { path: 'storage.mode', label: __('Storage mode', 'kotlinskidev-accessibility'), choices: enumChoices(ctx, 'storage.mode', storageModeLabel) }),
      createNumberField(ctx, { path: 'storage.ttlDays', label: __('Remember for (days)', 'kotlinskidev-accessibility') }),
      createTextField(ctx, { path: 'storage.key', label: __('Storage key', 'kotlinskidev-accessibility') })
    ),
    fieldset(
      __('Keyboard shortcut', 'kotlinskidev-accessibility'),
      'ka11y-shortcut',
      createToggleField(ctx, { path: 'shortcut.enabled', label: __('Enable the keyboard shortcut', 'kotlinskidev-accessibility') }),
      createComboField(ctx, {
        path: 'shortcut.combo',
        label: __('Shortcut combination', 'kotlinskidev-accessibility'),
        help: __('Opens the accessibility panel from anywhere on the page.', 'kotlinskidev-accessibility'),
      })
    ),
    fieldset(
      __('Hide toolbar', 'kotlinskidev-accessibility'),
      'ka11y-hide-toolbar',
      createToggleField(ctx, { path: 'hideToolbar.allow', label: __('Let visitors hide the toolbar', 'kotlinskidev-accessibility') }),
      createTextListField(ctx, {
        path: 'hideToolbar.days',
        label: __('Hide durations (days)', 'kotlinskidev-accessibility'),
        numeric: true,
        placeholder: '7',
      })
    ),
    fieldset(
      __('Advanced', 'kotlinskidev-accessibility'),
      'ka11y-advanced',
      createTextField(ctx, {
        path: 'advanced.excludeSelectors',
        label: __('Exclude selectors', 'kotlinskidev-accessibility'),
        help: __('Elements matching these selectors are left untouched by the adjustments.', 'kotlinskidev-accessibility'),
      }),
      createSelectField(ctx, {
        path: 'advanced.loadStrategy',
        label: __('Script loading', 'kotlinskidev-accessibility'),
        choices: enumChoices(ctx, 'advanced.loadStrategy', loadStrategyLabel),
      })
    )
  );
