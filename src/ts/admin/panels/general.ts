import { __ } from '@wordpress/i18n';
import type { FormContext } from '../context';
import { h } from '../dom';
import { createDeviceMatrixField } from '../fields/device-matrix';
import { createLauncherVisibilityField } from '../fields/launcher-visibility';
import { createMediaField } from '../fields/media';
import { createNumberField } from '../fields/number';
import { createSelectField, enumChoices } from '../fields/select';
import { createToggleField } from '../fields/toggle';
import { createColorField } from '../fields/color';
import { DEVICES, deviceLabel, positionLabel, shapeLabel, sizeLabel } from '../labels';

export const buildGeneralPanel = (ctx: FormContext): HTMLElement =>
  h(
    'div',
    { class: 'ka11y-panel ka11y-panel--general' },
    createLauncherVisibilityField(ctx, {
      path: 'widget.launcher',
      label: __('Show the floating accessibility button', 'kotlinskidev-accessibility'),
      help: __('Turn off to hide the button. The panel still opens from your own triggers and the keyboard shortcut.', 'kotlinskidev-accessibility'),
      inlineHelp: __('The button is currently placed inside a page element. Change this in the Triggers tab, or tick the box to float it again.', 'kotlinskidev-accessibility'),
    }),
    createDeviceMatrixField(ctx, {
      label: __('Button corner, offset and size per device', 'kotlinskidev-accessibility'),
      deviceHeader: __('Device', 'kotlinskidev-accessibility'),
      devices: DEVICES,
      deviceLabel,
      columns: [
        {
          basePath: 'widget.position',
          label: __('Corner', 'kotlinskidev-accessibility'),
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
        {
          basePath: 'widget.sizesRem',
          label: __('Launcher size (rem)', 'kotlinskidev-accessibility'),
          kind: 'decimal',
        },
      ],
    }),
    createSelectField(ctx, {
      path: 'widget.size',
      label: __('Launcher size', 'kotlinskidev-accessibility'),
      choices: enumChoices(ctx, 'widget.size', sizeLabel),
    }),
    createNumberField(ctx, {
      path: 'widget.sizeRem',
      label: __('Launcher size (rem)', 'kotlinskidev-accessibility'),
      help: __('Leave empty to use the size above. A value from 1.5 to 5 overrides it; 2.5 matches the cookie banner button. The icon scales with the button.', 'kotlinskidev-accessibility'),
      decimal: true,
      step: 0.1,
      placeholder: __('Automatic', 'kotlinskidev-accessibility'),
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
