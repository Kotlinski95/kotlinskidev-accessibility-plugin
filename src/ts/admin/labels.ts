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

export const presetLabel = (preset: string): string =>
  lookup(
    {
      recommended: __('Recommended', 'kotlinskidev-accessibility'),
      compatibility: __('Compatibility', 'kotlinskidev-accessibility'),
      custom: __('Custom', 'kotlinskidev-accessibility'),
    },
    preset
  );

export const strategyLabel = (strategy: string): string =>
  lookup(
    {
      interaction: __('On first interaction', 'kotlinskidev-accessibility'),
      idle: __('When the browser is idle', 'kotlinskidev-accessibility'),
      defer: __('Deferred script', 'kotlinskidev-accessibility'),
      async: __('Asynchronous script', 'kotlinskidev-accessibility'),
      eager: __('Immediately', 'kotlinskidev-accessibility'),
    },
    strategy
  );

export const scriptPositionLabel = (position: string): string =>
  lookup(
    {
      head: __('In the head', 'kotlinskidev-accessibility'),
      footer: __('In the footer', 'kotlinskidev-accessibility'),
    },
    position
  );

export const fetchPriorityLabel = (priority: string): string =>
  lookup(
    {
      low: __('Low', 'kotlinskidev-accessibility'),
      auto: __('Automatic', 'kotlinskidev-accessibility'),
      high: __('High', 'kotlinskidev-accessibility'),
    },
    priority
  );

export const prefetchLabel = (prefetch: string): string =>
  lookup(
    {
      none: __('Never', 'kotlinskidev-accessibility'),
      hover: __('When the pointer nears the button', 'kotlinskidev-accessibility'),
      idle: __('When the browser is idle', 'kotlinskidev-accessibility'),
    },
    prefetch
  );

export const pageCssLabel = (mode: string): string =>
  lookup(
    {
      lazy: __('Load when the panel opens', 'kotlinskidev-accessibility'),
      linked: __('Linked stylesheet', 'kotlinskidev-accessibility'),
      inline: __('Inline in the page', 'kotlinskidev-accessibility'),
    },
    mode
  );

export const optOutLabel = (optimizer: string): string =>
  lookup(
    {
      cloudflare: __('Cloudflare Rocket Loader', 'kotlinskidev-accessibility'),
      'wp-rocket': __('WP Rocket', 'kotlinskidev-accessibility'),
      litespeed: __('LiteSpeed Cache', 'kotlinskidev-accessibility'),
      'jetpack-boost': __('Jetpack Boost', 'kotlinskidev-accessibility'),
      'asset-cleanup': __('Asset CleanUp', 'kotlinskidev-accessibility'),
    },
    optimizer
  );

export const launcherLabel = (mode: string): string =>
  lookup(
    {
      floating: __('Floating button', 'kotlinskidev-accessibility'),
      inline: __('Inside a page element', 'kotlinskidev-accessibility'),
      hidden: __('No launcher button (use your own triggers)', 'kotlinskidev-accessibility'),
    },
    mode
  );

export const urlActionLabel = (action: string): string =>
  lookup(
    {
      open: __('Open the panel', 'kotlinskidev-accessibility'),
      feature: __('Turn on a feature', 'kotlinskidev-accessibility'),
      profile: __('Apply a profile', 'kotlinskidev-accessibility'),
    },
    action
  );

export const snippetKindLabel = (kind: string): string =>
  lookup(
    {
      html: __('HTML', 'kotlinskidev-accessibility'),
      link: __('Link', 'kotlinskidev-accessibility'),
      shortcode: __('Shortcode', 'kotlinskidev-accessibility'),
      php: __('PHP', 'kotlinskidev-accessibility'),
      javascript: __('JavaScript', 'kotlinskidev-accessibility'),
      url: __('URL', 'kotlinskidev-accessibility'),
    },
    kind
  );

export const dialogActionLabel = (action: string): string =>
  lookup(
    {
      open: __('Open the panel', 'kotlinskidev-accessibility'),
      close: __('Close the panel', 'kotlinskidev-accessibility'),
      toggle: __('Open or close the panel', 'kotlinskidev-accessibility'),
      reset: __('Reset all adjustments', 'kotlinskidev-accessibility'),
      statement: __('Go to the accessibility statement', 'kotlinskidev-accessibility'),
      hide: __('Hide the toolbar', 'kotlinskidev-accessibility'),
      show: __('Show the toolbar', 'kotlinskidev-accessibility'),
    },
    action
  );
