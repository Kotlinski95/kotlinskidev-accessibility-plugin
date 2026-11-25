import { __ } from '@wordpress/i18n';
import type { FormContext } from '../context';
import { h } from '../dom';
import { createToggleField } from '../fields/toggle';

export const buildMaintenancePanel = (ctx: FormContext): HTMLElement =>
  h(
    'div',
    { class: 'ka11y-panel ka11y-panel--maintenance' },
    h(
      'section',
      { class: 'ka11y-card' },
      h('h3', { class: 'ka11y-subheading' }, __('Uninstall', 'kotlinskidev-accessibility')),
      h(
        'p',
        { class: 'description' },
        __('Choose what happens to your settings when the plugin is deleted from the Plugins screen.', 'kotlinskidev-accessibility')
      ),
      createToggleField(ctx, {
        path: 'maintenance.keepDataOnUninstall',
        label: __('Keep my settings when the plugin is deleted', 'kotlinskidev-accessibility'),
        help: __('When off, deleting the plugin also deletes its settings.', 'kotlinskidev-accessibility'),
      })
    )
  );
