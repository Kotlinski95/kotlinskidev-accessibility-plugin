import type { KernelExports } from '../frontend/kernel';

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
  profile?: string;
  owned?: Record<string, FeatureLevel>;
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

export type LoadStrategy = 'interaction' | 'idle' | 'defer' | 'async' | 'eager';

export type PrefetchMode = 'hover' | 'idle' | 'none';

export type PageCssMode = 'lazy' | 'linked' | 'inline';

export type ChunkName = 'kernel' | 'panel' | 'content' | 'color' | 'orientation';

export type GroupName = 'content' | 'color' | 'orientation';

export interface ParsedCombo {
  alt: boolean;
  shift: boolean;
  ctrl: boolean;
  meta: boolean;
  key: string;
  code: string;
}

export interface InlineShortcutConfig {
  enabled: boolean;
  combo: string;
  parsed: ParsedCombo | null;
}

export interface LoadConfig {
  strategy: LoadStrategy;
  prefetch: PrefetchMode;
  pageCss: PageCssMode;
  deviceSkip: boolean;
}

export interface ChunksConfig {
  base: string;
  ver: Record<ChunkName | 'page', string>;
}

export interface InlineConfig {
  v: string;
  locale: string;
  rtl: boolean;
  storage: StorageConfig;
  shortcut: InlineShortcutConfig;
  load: LoadConfig;
  hiddenMedia: string;
  chunks: ChunksConfig;
  data: string[];
  strings: Record<string, string>;
  advanced: AdvancedConfig;
  assets: AssetsConfig;
  css?: string | null;
  hk?: string;
}

export interface PanelData {
  hash: string;
  locale: string;
  features: Record<string, FeatureConfig>;
  profiles: Record<string, ProfileConfig>;
  widget: WidgetConfig;
  theme: ThemeConfig;
  tokens: TokensConfig;
  hideToolbar: HideToolbarConfig;
  statementUrl: string;
  customCss: string;
  strings: Record<string, string>;
}

export type ChunkFactory = (kernel: KernelExports | undefined) => unknown;

export type ChunkRecord = [name: ChunkName, abi: number, factory: ChunkFactory];

export interface ChunkSink {
  push(...records: ChunkRecord[]): number;
}

export interface RuntimeHandoff {
  s: string[];
  c: ChunkRecord[] | ChunkSink;
  e?: (event: MouseEvent) => void;
}

export type CommandSource = 'early' | 'launcher' | 'hash' | 'shortcut' | 'api' | 'trigger' | 'url';

export interface KA11yCommand {
  action: string;
  source?: CommandSource;
  opener?: HTMLElement | null;
}

export interface KA11yQueue {
  push(...commands: KA11yCommand[]): number;
}

export type PublicFeatureLevel = number;

export interface PublicState {
  api: 1;
  open: boolean;
  profile: string | null;
  features: Record<string, PublicFeatureLevel>;
}

export type ApiEventName = 'ready' | 'open' | 'close' | 'change';

export interface KotlinskidevA11yApi {
  api: 1;
  open(opener?: HTMLElement | null): void;
  close(): void;
  toggle(target?: string, opener?: HTMLElement | null): void;
  set(feature: string, level: number | boolean): void;
  reset(): void;
  getState(): Promise<PublicState>;
  on(event: ApiEventName, listener: (detail: unknown) => void): () => void;
}

declare global {
  interface Window {
    kotlinskidevA11y?: KotlinskidevA11yConfig;
    kotlinskidevA11yOff?: boolean;
    kotlinskidevA11yRuntime?: RuntimeHandoff;
    kotlinskidevA11yQueue?: KA11yCommand[] | KA11yQueue;
  }
}
