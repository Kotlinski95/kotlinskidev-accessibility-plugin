import type { ContrastTokens } from './contrast';

export const PRESET_NAMES: readonly string[] = ['classic', 'brand', 'soft', 'contrast'];
export const CUSTOM_PRESET = 'custom';

export const PRESET_TOKEN_KEYS: readonly string[] = [
  'primary',
  'onPrimary',
  'primaryDark',
  'onPrimaryDark',
  'headerBg',
  'onHeader',
  'canvasLight',
  'canvasDark',
  'surfaceLight',
  'surfaceDark',
  'textLight',
  'textDark',
];

export type PresetTokens = Readonly<Record<string, string>>;

const CLASSIC: PresetTokens = {
  primary: '#0b57d0',
  onPrimary: '#ffffff',
  primaryDark: '#7aa7ff',
  onPrimaryDark: '#0b1a33',
  headerBg: '#16181d',
  onHeader: '#ffffff',
  canvasLight: '#f2f4f7',
  canvasDark: '#101114',
  surfaceLight: '#ffffff',
  surfaceDark: '#1b1b1f',
  textLight: '#1b1b1f',
  textDark: '#f2f2f2',
};

const SOFT: PresetTokens = { ...CLASSIC, headerBg: '#e8ecf3', onHeader: '#1b1b1f', canvasLight: '#f7f8fa' };

const CONTRAST: PresetTokens = {
  primary: '#000000',
  onPrimary: '#ffff00',
  primaryDark: '#ffff00',
  onPrimaryDark: '#000000',
  headerBg: '#000000',
  onHeader: '#ffffff',
  canvasLight: '#ffffff',
  canvasDark: '#000000',
  surfaceLight: '#ffffff',
  surfaceDark: '#000000',
  textLight: '#000000',
  textDark: '#ffffff',
};

const stringOr = (value: unknown, fallback: string): string => (typeof value === 'string' && value !== '' ? value : fallback);

const brand = (current: ContrastTokens): PresetTokens => {
  const primary = stringOr(current.primary, CLASSIC.primary as string);
  const onPrimary = stringOr(current.onPrimary, CLASSIC.onPrimary as string);
  return {
    ...CLASSIC,
    primary,
    onPrimary,
    primaryDark: stringOr(current.primaryDark, CLASSIC.primaryDark as string),
    onPrimaryDark: stringOr(current.onPrimaryDark, CLASSIC.onPrimaryDark as string),
    headerBg: primary,
    onHeader: onPrimary,
  };
};

export const isManagedPreset = (preset: unknown): preset is string => typeof preset === 'string' && PRESET_NAMES.includes(preset);

export const presetTokens = (preset: string, current: ContrastTokens = {}): PresetTokens | null => {
  switch (preset) {
    case 'classic':
      return CLASSIC;
    case 'brand':
      return brand(current);
    case 'soft':
      return SOFT;
    case 'contrast':
      return CONTRAST;
    default:
      return null;
  }
};

export const matchesPreset = (preset: string, current: ContrastTokens): boolean => {
  const expected = presetTokens(preset, current);
  if (expected === null) return false;
  return PRESET_TOKEN_KEYS.every((key) => String(current[key] ?? '').toLowerCase() === (expected[key] ?? '').toLowerCase());
};
