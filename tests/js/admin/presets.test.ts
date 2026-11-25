import { failingPairs } from '../../../src/ts/admin/contrast';
import { PRESET_NAMES, PRESET_TOKEN_KEYS, isManagedPreset, matchesPreset, presetTokens } from '../../../src/ts/admin/presets';

describe('presets', () => {
  it.each(PRESET_NAMES)('%s defines every token and passes the contrast check in light and dark', (name) => {
    const tokens = presetTokens(name, {});
    expect(tokens).not.toBeNull();
    expect(Object.keys(tokens ?? {}).sort()).toEqual([...PRESET_TOKEN_KEYS].sort());
    expect(failingPairs(tokens ?? {})).toEqual([]);
  });

  it('brand follows the current primary color for the header', () => {
    const tokens = presetTokens('brand', { primary: '#7a1f1f', onPrimary: '#ffffff' });
    expect(tokens?.headerBg).toBe('#7a1f1f');
    expect(tokens?.onHeader).toBe('#ffffff');
    expect(tokens?.primary).toBe('#7a1f1f');
  });

  it('contrast is black and white with yellow on black', () => {
    const tokens = presetTokens('contrast', {});
    expect(tokens).toMatchObject({ headerBg: '#000000', onHeader: '#ffffff', primary: '#000000', onPrimary: '#ffff00' });
  });

  it('returns null for custom and unknown presets', () => {
    expect(presetTokens('custom', {})).toBeNull();
    expect(presetTokens('other', {})).toBeNull();
    expect(isManagedPreset('custom')).toBe(false);
    expect(isManagedPreset('soft')).toBe(true);
  });

  it('detects whether tokens still match a preset', () => {
    const classic = { ...presetTokens('classic', {}) };
    expect(matchesPreset('classic', classic)).toBe(true);
    expect(matchesPreset('classic', { ...classic, primary: '#123456' })).toBe(false);
    expect(matchesPreset('custom', classic)).toBe(false);
  });
});
