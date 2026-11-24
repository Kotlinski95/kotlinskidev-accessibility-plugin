import { __ } from '@wordpress/i18n';

export const DEVICES: readonly string[] = ['desktop', 'tablet', 'mobile'];

const lookup = (table: Readonly<Record<string, string>>, value: string): string => table[value] ?? value;

export const deviceLabel = (device: string): string =>
  lookup(
    {
      desktop: __('Desktop', 'kotlinskidev-accessibility'),
      tablet: __('Tablet', 'kotlinskidev-accessibility'),
      mobile: __('Mobile', 'kotlinskidev-accessibility'),
    },
    device
  );

export const positionLabel = (position: string): string =>
  lookup(
    {
      'bottom-right': __('Bottom right', 'kotlinskidev-accessibility'),
      'bottom-left': __('Bottom left', 'kotlinskidev-accessibility'),
      'top-right': __('Top right', 'kotlinskidev-accessibility'),
      'top-left': __('Top left', 'kotlinskidev-accessibility'),
      'middle-right': __('Middle right', 'kotlinskidev-accessibility'),
      'middle-left': __('Middle left', 'kotlinskidev-accessibility'),
    },
    position
  );

export const sizeLabel = (size: string): string =>
  lookup(
    {
      sm: __('Small', 'kotlinskidev-accessibility'),
      md: __('Medium', 'kotlinskidev-accessibility'),
      lg: __('Large', 'kotlinskidev-accessibility'),
    },
    size
  );

export const themeModeLabel = (mode: string): string =>
  lookup(
    {
      auto: __('Automatic', 'kotlinskidev-accessibility'),
      light: __('Light', 'kotlinskidev-accessibility'),
      dark: __('Dark', 'kotlinskidev-accessibility'),
    },
    mode
  );

export const visibilityModeLabel = (mode: string): string =>
  lookup(
    {
      everywhere: __('Everywhere', 'kotlinskidev-accessibility'),
      only_on: __('Only on the pages listed below', 'kotlinskidev-accessibility'),
      except_on: __('Everywhere except the pages listed below', 'kotlinskidev-accessibility'),
    },
    mode
  );

export const storageModeLabel = (mode: string): string =>
  lookup(
    {
      local: __('Local storage', 'kotlinskidev-accessibility'),
      cookie: __('Cookie', 'kotlinskidev-accessibility'),
      none: __('Do not remember choices', 'kotlinskidev-accessibility'),
    },
    mode
  );

export const loadStrategyLabel = (strategy: string): string =>
  lookup(
    {
      interaction: __('On first interaction', 'kotlinskidev-accessibility'),
      defer: __('Deferred script', 'kotlinskidev-accessibility'),
      idle: __('When the browser is idle', 'kotlinskidev-accessibility'),
      async: __('Asynchronous script', 'kotlinskidev-accessibility'),
      eager: __('Immediately', 'kotlinskidev-accessibility'),
    },
    strategy
  );
