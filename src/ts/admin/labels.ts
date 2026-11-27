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
      inherit: __('Same as launcher size', 'kotlinskidev-accessibility'),
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

export const tokenLabel = (token: string): string =>
  lookup(
    {
      primary: __('Primary color', 'kotlinskidev-accessibility'),
      onPrimary: __('Text on primary color', 'kotlinskidev-accessibility'),
      primaryDark: __('Primary color (dark)', 'kotlinskidev-accessibility'),
      onPrimaryDark: __('Text on primary color (dark)', 'kotlinskidev-accessibility'),
      headerBg: __('Header background', 'kotlinskidev-accessibility'),
      onHeader: __('Header text', 'kotlinskidev-accessibility'),
      canvasLight: __('Light canvas', 'kotlinskidev-accessibility'),
      canvasDark: __('Dark canvas', 'kotlinskidev-accessibility'),
      surfaceLight: __('Light surface', 'kotlinskidev-accessibility'),
      surfaceDark: __('Dark surface', 'kotlinskidev-accessibility'),
      textLight: __('Text on light surface', 'kotlinskidev-accessibility'),
      textDark: __('Text on dark surface', 'kotlinskidev-accessibility'),
    },
    token
  );

export const panelPresetLabel = (preset: string): string =>
  lookup(
    {
      classic: __('Classic', 'kotlinskidev-accessibility'),
      brand: __('Brand header', 'kotlinskidev-accessibility'),
      soft: __('Soft', 'kotlinskidev-accessibility'),
      contrast: __('High contrast', 'kotlinskidev-accessibility'),
      custom: __('Custom', 'kotlinskidev-accessibility'),
    },
    preset
  );

export const panelSectionLabel = (section: string): string =>
  lookup(
    {
      profiles: __('Show the profiles card', 'kotlinskidev-accessibility'),
      content: __('Show the content card', 'kotlinskidev-accessibility'),
      color: __('Show the color card', 'kotlinskidev-accessibility'),
      orientation: __('Show the orientation card', 'kotlinskidev-accessibility'),
      skip: __('Show the skip to content card', 'kotlinskidev-accessibility'),
    },
    section
  );

export const shapeLabel = (shape: string): string =>
  lookup(
    {
      circle: __('Circle', 'kotlinskidev-accessibility'),
      rounded: __('Rounded square', 'kotlinskidev-accessibility'),
      square: __('Square', 'kotlinskidev-accessibility'),
    },
    shape
  );

export const languageModeLabel = (mode: string): string =>
  lookup(
    {
      follow: __('Follow the page language', 'kotlinskidev-accessibility'),
      choose: __('Let visitors choose', 'kotlinskidev-accessibility'),
    },
    mode
  );

export const animationLabel = (animation: string): string =>
  lookup(
    {
      slide: __('Slide', 'kotlinskidev-accessibility'),
      fade: __('Fade', 'kotlinskidev-accessibility'),
      none: __('None', 'kotlinskidev-accessibility'),
    },
    animation
  );

export const panelSideLabel = (side: string): string =>
  lookup(
    {
      auto: __('Next to the launcher', 'kotlinskidev-accessibility'),
      left: __('Left', 'kotlinskidev-accessibility'),
      right: __('Right', 'kotlinskidev-accessibility'),
    },
    side
  );
