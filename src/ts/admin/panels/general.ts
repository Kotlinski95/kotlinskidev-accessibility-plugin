import { __ } from '@wordpress/i18n';
import type { FormContext } from '../context';
import { h } from '../dom';
import { createDeviceMatrixField } from '../fields/device-matrix';
import { createMediaField } from '../fields/media';
import { createSelectField, enumChoices } from '../fields/select';
import { createToggleField } from '../fields/toggle';
import { createColorField } from '../fields/color';
import { DEVICES, deviceLabel, positionLabel, shapeLabel, sizeLabel } from '../labels';

export const buildGeneralPanel = (ctx: FormContext): HTMLElement =>
  h(
    'div',
    { class: 'ka11y-panel ka11y-panel--general' },
    createDeviceMatrixField(ctx, {
      label: __('Widget position per device', 'kotlinskidev-accessibility'),
      deviceHeader: __('Device', 'kotlinskidev-accessibility'),
      devices: DEVICES,
      deviceLabel,
      columns: [
        {
          basePath: 'widget.position',
          label: __('Position', 'kotlinskidev-accessibility'),
          kind: 'select',
          choices: enumChoices(ctx, 'widget.position.desktop', positionLabel),
        },
        {
          basePath: 'widget.offsetX',
          label: __('Horizontal offset (px)', 'kotlinskidev-accessibility'),
          kind: 'number',
        },
        {
          basePath: 'widget.offsetY',
          label: __('Vertical offset (px)', 'kotlinskidev-accessibility'),
          kind: 'number',
        },
        {
          basePath: 'widget.sizes',
          label: __('Launcher size', 'kotlinskidev-accessibility'),
          kind: 'select',
          choices: enumChoices(ctx, 'widget.sizes.desktop', sizeLabel),
        },
      ],
    }),
    createSelectField(ctx, {
      path: 'widget.size',
      label: __('Launcher size', 'kotlinskidev-accessibility'),
      choices: enumChoices(ctx, 'widget.size', sizeLabel),
    }),
    createSelectField(ctx, {
      path: 'widget.shape',
      label: __('Launcher shape', 'kotlinskidev-accessibility'),
      choices: enumChoices(ctx, 'widget.shape', shapeLabel),
    }),
    createColorField(ctx, {
      path: 'widget.bg',
      label: __('Launcher background', 'kotlinskidev-accessibility'),
      help: __('Leave empty to use the primary color from Appearance.', 'kotlinskidev-accessibility'),
      allowEmpty: true,
    }),
    createColorField(ctx, {
      path: 'widget.fg',
      label: __('Launcher icon color', 'kotlinskidev-accessibility'),
      help: __('Leave empty to use the text on primary color from Appearance.', 'kotlinskidev-accessibility'),
      allowEmpty: true,
    }),
    createColorField(ctx, {
      path: 'widget.bgDark',
      label: __('Launcher background (dark mode)', 'kotlinskidev-accessibility'),
      help: __('Leave empty to keep the light-mode background in dark mode.', 'kotlinskidev-accessibility'),
      allowEmpty: true,
    }),
    createColorField(ctx, {
      path: 'widget.fgDark',
      label: __('Launcher icon color (dark mode)', 'kotlinskidev-accessibility'),
      help: __('Leave empty to keep the light-mode icon color in dark mode.', 'kotlinskidev-accessibility'),
      allowEmpty: true,
    }),
    createMediaField(ctx, {
      path: 'widget.icon',
      label: __('Launcher icon', 'kotlinskidev-accessibility'),
      help: __('Pick an image from the media library, or keep the default universal access icon.', 'kotlinskidev-accessibility'),
    }),
    createToggleField(ctx, {
      path: 'widget.iconBorder',
      label: __('Show a border around the icon', 'kotlinskidev-accessibility'),
    })
  );
