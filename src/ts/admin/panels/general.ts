import { __ } from '@wordpress/i18n';
import type { FormContext } from '../context';
import { h } from '../dom';
import { createDeviceMatrixField } from '../fields/device-matrix';
import { createMediaField } from '../fields/media';
import { createSelectField, enumChoices } from '../fields/select';
import { createToggleField } from '../fields/toggle';
import { DEVICES, deviceLabel, positionLabel, sizeLabel } from '../labels';

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
        { basePath: 'widget.offsetX', label: __('Horizontal offset (px)', 'kotlinskidev-accessibility'), kind: 'number' },
        { basePath: 'widget.offsetY', label: __('Vertical offset (px)', 'kotlinskidev-accessibility'), kind: 'number' },
      ],
    }),
    createSelectField(ctx, {
      path: 'widget.size',
      label: __('Launcher size', 'kotlinskidev-accessibility'),
      choices: enumChoices(ctx, 'widget.size', sizeLabel),
    }),
    createMediaField(ctx, {
      path: 'widget.icon',
      label: __('Launcher icon', 'kotlinskidev-accessibility'),
      help: __('Pick an image from the media library, or keep the default universal access icon.', 'kotlinskidev-accessibility'),
    }),
    createToggleField(ctx, { path: 'widget.iconBorder', label: __('Show a border around the icon', 'kotlinskidev-accessibility') })
  );
