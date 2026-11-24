import { __ } from '@wordpress/i18n';
import type { FormContext } from '../context';
import { fieldset, h } from '../dom';
import { createLocaleMapField } from '../fields/locale-map';
import { createNumberField } from '../fields/number';
import { createTextField } from '../fields/text';

export const buildLanguagesPanel = (ctx: FormContext): HTMLElement =>
  h(
    'div',
    { class: 'ka11y-panel ka11y-panel--languages' },
    h(
      'p',
      { class: 'description' },
      __('Override any widget text per language. Empty fields use the default text shown as a placeholder.', 'kotlinskidev-accessibility')
    ),
    createLocaleMapField(ctx, {
      path: 'labels',
      label: __('Widget labels', 'kotlinskidev-accessibility'),
      mode: 'strings',
      keys: Object.keys(ctx.config.strings),
      defaults: ctx.config.strings,
    }),
    fieldset(
      __('Accessibility statement', 'kotlinskidev-accessibility'),
      'ka11y-statement',
      createNumberField(ctx, {
        path: 'statement.pageId',
        label: __('Statement page ID', 'kotlinskidev-accessibility'),
        help: __('Use 0 to link to the address below instead.', 'kotlinskidev-accessibility'),
      }),
      createTextField(ctx, { path: 'statement.url', label: __('Statement address', 'kotlinskidev-accessibility') }),
      createLocaleMapField(ctx, {
        path: 'statement.content',
        label: __('Statement content', 'kotlinskidev-accessibility'),
        mode: 'document',
      })
    )
  );
