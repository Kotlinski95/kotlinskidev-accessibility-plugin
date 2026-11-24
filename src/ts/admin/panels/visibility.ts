import { __ } from '@wordpress/i18n';
import type { FormContext } from '../context';
import { fieldset, h } from '../dom';
import { createDeviceMatrixField } from '../fields/device-matrix';
import { createNumberField } from '../fields/number';
import { createTextListField } from '../fields/text-list';
import { createSelectField, enumChoices } from '../fields/select';
import { DEVICES, deviceLabel, visibilityModeLabel } from '../labels';

const MODE_PATH = 'visibility.mode';

const rolesHelp = __(
  'Use __guest for logged-out visitors. Role rules are skipped on cached pages, so a page cache can show the widget to the wrong audience.',
  'kotlinskidev-accessibility'
);

const templatesHelp = __(
  'Template slugs such as single, page or front-page, or a page template file such as templates/full-width.php.',
  'kotlinskidev-accessibility'
);

const buildRuleLists = (ctx: FormContext, prefix: 'include' | 'exclude'): HTMLElement[] => [
  createTextListField(ctx, {
    path: `visibility.${prefix}PostIds`,
    label: __('Post and page IDs', 'kotlinskidev-accessibility'),
    numeric: true,
  }),
  createTextListField(ctx, {
    path: `visibility.${prefix}PostTypes`,
    label: __('Post types', 'kotlinskidev-accessibility'),
    placeholder: 'page',
  }),
  createTextListField(ctx, {
    path: `visibility.${prefix}Templates`,
    label: __('Templates', 'kotlinskidev-accessibility'),
    help: templatesHelp,
    placeholder: 'front-page',
  }),
  createTextListField(ctx, {
    path: `visibility.${prefix}Roles`,
    label: __('User roles', 'kotlinskidev-accessibility'),
    help: rolesHelp,
    placeholder: 'administrator',
  }),
  createTextListField(ctx, {
    path: `visibility.${prefix}UrlPatterns`,
    label: __('URL patterns', 'kotlinskidev-accessibility'),
    help: __('Use * as a wildcard, for example /checkout/*.', 'kotlinskidev-accessibility'),
    placeholder: '/checkout/*',
  }),
];

export const buildVisibilityPanel = (ctx: FormContext): HTMLElement => {
  const modeField = createSelectField(ctx, {
    path: MODE_PATH,
    label: __('Show the widget', 'kotlinskidev-accessibility'),
    choices: enumChoices(ctx, MODE_PATH, visibilityModeLabel),
  });
  const onlyOn = fieldset(__('Only on', 'kotlinskidev-accessibility'), 'ka11y-exclusions ka11y-inclusions', ...buildRuleLists(ctx, 'include'));
  const exceptOn = fieldset(__('Except on', 'kotlinskidev-accessibility'), 'ka11y-exclusions', ...buildRuleLists(ctx, 'exclude'));

  const syncMode = (): void => {
    const mode = ctx.state.get(MODE_PATH);
    onlyOn.hidden = mode !== 'only_on';
    exceptOn.hidden = mode !== 'except_on';
  };
  modeField.addEventListener('change', syncMode);
  syncMode();

  return h(
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
    modeField,
    onlyOn,
    exceptOn
  );
};
