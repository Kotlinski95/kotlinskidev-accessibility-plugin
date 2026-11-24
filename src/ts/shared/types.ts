export type StorageMode = 'local' | 'cookie' | 'none';

export type Device = 'desktop' | 'tablet' | 'mobile';

export type WidgetPosition =
  | 'bottom-right'
  | 'bottom-left'
  | 'top-right'
  | 'top-left'
  | 'middle-right'
  | 'middle-left';

export type ThemeMode = 'auto' | 'light' | 'dark';

export type WidgetSize = 'sm' | 'md' | 'lg';

export type FeatureLevel = boolean | number;

export interface SavedState {
  classes: string[];
  vars: Record<string, string>;
  levels?: Record<string, FeatureLevel>;
  exp: number;
}

export interface FeatureConfig {
  enabled: boolean;
  default: FeatureLevel;
}

export interface ProfileConfig {
  enabled: boolean;
  features: string[];
}

export interface WidgetConfig {
  position: Record<Device, WidgetPosition>;
  offsetX: Record<Device, number>;
  offsetY: Record<Device, number>;
  size: WidgetSize;
  icon: string;
  iconBorder: boolean;
}

export interface ThemeConfig {
  mode: ThemeMode;
  darkSelector: string;
  lightSelector: string;
  followPrefersColorScheme: boolean;
}

export interface TokensConfig {
  primary: string;
  onPrimary: string;
  surfaceLight: string;
  surfaceDark: string;
  textLight: string;
  textDark: string;
  radius: string;
  zIndex: number;
  fontFamily: string;
}

export interface StorageConfig {
  mode: StorageMode;
  ttlDays: number;
  key: string;
}

export interface ShortcutConfig {
  enabled: boolean;
  combo: string;
}

export interface HideToolbarConfig {
  allow: boolean;
  days: number[];
}

export interface AdvancedConfig {
  excludeSelectors: string;
}

export interface AssetsConfig {
  dyslexicFontUrl: string;
}

export interface KotlinskidevA11yConfig {
  v: string;
  features: Record<string, FeatureConfig>;
  profiles: Record<string, ProfileConfig>;
  widget: WidgetConfig;
  theme: ThemeConfig;
  tokens: TokensConfig;
  storage: StorageConfig;
  shortcut: ShortcutConfig;
  hideToolbar: HideToolbarConfig;
  statementUrl: string;
  strings: Record<string, string>;
  locale: string;
  rtl: boolean;
  customCss: string;
  advanced: AdvancedConfig;
  assets: AssetsConfig;
}

declare global {
  interface Window {
    kotlinskidevA11y?: KotlinskidevA11yConfig;
  }
}
