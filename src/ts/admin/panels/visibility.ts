import { __ } from '@wordpress/i18n';
import type { FormContext } from '../context';
import { fieldset, h } from '../dom';
import { createDeviceMatrixField } from '../fields/device-matrix';
import { createNumberField } from '../fields/number';
import { createTextListField } from '../fields/text-list';
import { DEVICES, deviceLabel } from '../labels';

export const buildVisibilityPanel = (ctx: FormContext): HTMLElement =>
  h(
    'div',
    { class: 'ka11y-panel ka11y-panel--visibility' },
    createDeviceMatrixField(ctx, {
      label: __('Show the widget on', 'kotlinskidev-accessibility'),
      deviceHeader: __('Device', 'kotlinskidev-accessibility'),
      devices: DEVICES,
      deviceLabel,
      columns: [{ basePath: 'visibility.devices', label: __('Visible', 'kotlinskidev-accessibility'), kind: 'toggle' }],
    }),
    fieldset(
      __('Breakpoints', 'kotlinskidev-accessibility'),
      'ka11y-breakpoints',
      createNumberField(ctx, {
        path: 'visibility.breakpoints.tablet',
        label: __('Largest tablet width (px)', 'kotlinskidev-accessibility'),
        help: __('Screens up to this width count as tablet.', 'kotlinskidev-accessibility'),
      }),
      createNumberField(ctx, {
        path: 'visibility.breakpoints.mobile',
        label: __('Largest mobile width (px)', 'kotlinskidev-accessibility'),
        help: __('Screens up to this width count as mobile.', 'kotlinskidev-accessibility'),
      })
    ),
    fieldset(
      __('Exclusions', 'kotlinskidev-accessibility'),
      'ka11y-exclusions',
      createTextListField(ctx, {
        path: 'visibility.excludePostIds',
        label: __('Post and page IDs', 'kotlinskidev-accessibility'),
        numeric: true,
      }),
      createTextListField(ctx, {
        path: 'visibility.excludePostTypes',
        label: __('Post types', 'kotlinskidev-accessibility'),
        placeholder: 'page',
      }),
      createTextListField(ctx, {
        path: 'visibility.excludeRoles',
        label: __('User roles', 'kotlinskidev-accessibility'),
        placeholder: 'administrator',
      }),
      createTextListField(ctx, {
        path: 'visibility.excludeUrlPatterns',
        label: __('URL patterns', 'kotlinskidev-accessibility'),
        help: __('Use * as a wildcard, for example /checkout/*.', 'kotlinskidev-accessibility'),
        placeholder: '/checkout/*',
      })
    )
  );
