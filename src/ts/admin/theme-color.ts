export interface ThemePaletteColor {
  slug: string;
  name: string;
  color: string;
  var: string;
}

export interface ThemeReference {
  slug: string;
  fallback: string;
}

const VAR_PREFIX = '--wp--preset--color--';
const REFERENCE_PATTERN = /^var\(--wp--preset--color--([a-z0-9-]+)(?:,\s?(#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})))?\)$/i;

export const parseThemeReference = (value: unknown): ThemeReference | null => {
  if (typeof value !== 'string') return null;
  const match = REFERENCE_PATTERN.exec(value.trim());
  if (match === null) return null;
  return {
    slug: (match[1] as string).toLowerCase(),
    fallback: (match[2] ?? '').toLowerCase(),
  };
};

export const formatThemeReference = (slug: string, fallback: string): string => `var(${VAR_PREFIX}${slug}, ${fallback.toLowerCase()})`;

export const resolveColor = (value: unknown): unknown => {
  const reference = parseThemeReference(value);
  return reference === null ? value : reference.fallback;
};

export const themePaletteOf = (config: { themePalette?: unknown }): readonly ThemePaletteColor[] =>
  Array.isArray(config.themePalette)
    ? (config.themePalette as unknown[]).filter(
        (item): item is ThemePaletteColor =>
          typeof item === 'object' && item !== null && typeof (item as ThemePaletteColor).slug === 'string' && typeof (item as ThemePaletteColor).color === 'string'
      )
    : [];

export interface ThemeMatch {
  primary: ThemePaletteColor;
  primaryDark: ThemePaletteColor | null;
}

export const matchThemePalette = (palette: readonly ThemePaletteColor[]): ThemeMatch | null => {
  const bySlug = (slug: string): ThemePaletteColor | undefined => palette.find((item) => item.slug === slug);
  const primary = bySlug('primary') ?? bySlug('accent') ?? palette[0];
  if (primary === undefined) return null;
  return { primary, primaryDark: bySlug('primary-dark') ?? null };
};
