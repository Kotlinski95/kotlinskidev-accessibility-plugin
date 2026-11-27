import { contrastRatio, parseColor } from '../../../src/ts/admin/contrast';
import { formatThemeReference, matchThemePalette, parseThemeReference, resolveColor } from '../../../src/ts/admin/theme-color';

const item = (slug: string, color = '#000000') => ({
  slug,
  name: slug,
  color,
  var: `--wp--preset--color--${slug}`,
});

describe('theme color references', () => {
  it('round-trips a reference', () => {
    const value = formatThemeReference('primary-dark', '#7AA7FF');
    expect(value).toBe('var(--wp--preset--color--primary-dark, #7aa7ff)');
    expect(parseThemeReference(value)).toEqual({
      slug: 'primary-dark',
      fallback: '#7aa7ff',
    });
  });

  it('rejects anything else', () => {
    expect(parseThemeReference('var(--x);}body{')).toBeNull();
    expect(parseThemeReference('#fff')).toBeNull();
    expect(parseThemeReference('var(--wp--preset--color--a, red)')).toBeNull();
  });

  it('resolves to the fallback for contrast', () => {
    expect(resolveColor('var(--wp--preset--color--a, #ffffff)')).toBe('#ffffff');
    expect(parseColor('var(--wp--preset--color--a, #000000)')).toEqual([0, 0, 0]);
    expect(contrastRatio('var(--wp--preset--color--a, #000000)', '#ffffff')).toBeCloseTo(21, 0);
  });
});

describe('matchThemePalette', () => {
  it('prefers primary, then accent, then the first color', () => {
    expect(matchThemePalette([item('x'), item('accent'), item('primary')])?.primary.slug).toBe('primary');
    expect(matchThemePalette([item('x'), item('accent')])?.primary.slug).toBe('accent');
    expect(matchThemePalette([item('x'), item('y')])?.primary.slug).toBe('x');
  });

  it('maps primary-dark when present and returns null for an empty palette', () => {
    expect(matchThemePalette([item('primary'), item('primary-dark')])?.primaryDark?.slug).toBe('primary-dark');
    expect(matchThemePalette([item('primary')])?.primaryDark).toBeNull();
    expect(matchThemePalette([])).toBeNull();
  });
});
