import { contrastRatio, failingPairs, formatRatio, pairsFor, parseColor, readPairs, relativeLuminance } from '../../../src/ts/admin/contrast';

describe('contrast', () => {
  it('parses short, long and alpha hex colors', () => {
    expect(parseColor('#fff')).toEqual([255, 255, 255]);
    expect(parseColor('#0b57d0')).toEqual([11, 87, 208]);
    expect(parseColor('#0b57d080')).toEqual([11, 87, 208]);
    expect(parseColor('red')).toBeNull();
    expect(parseColor(12)).toBeNull();
  });

  it('computes relative luminance extremes', () => {
    expect(relativeLuminance([0, 0, 0])).toBe(0);
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 5);
  });

  it('matches known WCAG ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
    expect(contrastRatio('#fff', '#0b57d0')).toBeCloseTo(6.4, 1);
    expect(contrastRatio('#ffffff', '#16181d')).toBeCloseTo(17.8, 1);
  });

  it('returns null for invalid colors and formats ratios without rounding up', () => {
    expect(contrastRatio('nope', '#fff')).toBeNull();
    expect(formatRatio(4.49)).toBe('4.4');
    expect(formatRatio(21)).toBe('21.0');
  });

  it('applies the text and UI minimums', () => {
    const tokens = { primary: '#0b57d0', onPrimary: '#777777', surfaceLight: '#ffffff' };
    const readings = readPairs(tokens);
    const onPrimary = readings.find((reading) => reading.foreground === 'onPrimary');
    const primary = readings.find((reading) => reading.foreground === 'primary' && reading.background === 'surfaceLight');
    expect(onPrimary?.minimum).toBe(4.5);
    expect(onPrimary?.pass).toBe(false);
    expect(primary?.minimum).toBe(3);
    expect(primary?.pass).toBe(true);
  });

  it('lists the pairs of a token and ignores incomplete ones when failing', () => {
    const tokens = { primary: '#0b57d0', onPrimary: '#ffffff', surfaceLight: '#ffffff' };
    expect(pairsFor('primary', tokens)).toHaveLength(2);
    expect(failingPairs(tokens)).toEqual([]);
    expect(failingPairs({ ...tokens, onPrimary: '#0c58d1' })).toHaveLength(1);
  });
});
