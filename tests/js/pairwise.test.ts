import { CONTRAST_KEYS } from '../../src/ts/frontend/features/color-orientation/exclusivity';
import { FEATURE_LEVELS } from '../e2e/support/schema';
import { coveredPairs, EXCLUSIVE_GROUPS, generatePairwise, validPairs } from '../e2e/support/pairwise';

describe('pairwise generator', () => {
  const rows = generatePairwise(FEATURE_LEVELS);

  it('covers every valid pair of feature levels', () => {
    const covered = coveredPairs(FEATURE_LEVELS, rows);
    const missing = validPairs(FEATURE_LEVELS).filter((pair) => !covered.has(pair));
    expect(missing).toEqual([]);
  });

  it('never enables two exclusive contrast features together', () => {
    rows.forEach((row) => {
      const active = CONTRAST_KEYS.filter((key) => (row[key] ?? 0) > 0);
      expect(active.length).toBeLessThanOrEqual(1);
    });
  });

  it('keeps levels within each feature range and lists every feature', () => {
    rows.forEach((row) => {
      expect(Object.keys(row)).toEqual(Object.keys(FEATURE_LEVELS));
      Object.entries(row).forEach(([key, level]) => {
        expect(level).toBeGreaterThanOrEqual(0);
        expect(level).toBeLessThanOrEqual(FEATURE_LEVELS[key] ?? 0);
      });
    });
  });

  it('is deterministic', () => {
    expect(generatePairwise(FEATURE_LEVELS)).toEqual(rows);
  });

  it('stays far smaller than the full product', () => {
    expect(rows.length).toBeLessThan(60);
  });

  it('excludes invalid pairs from the required set', () => {
    const pairs = validPairs({ darkContrast: 1, lightContrast: 1, biggerText: 1 }, EXCLUSIVE_GROUPS);
    expect(pairs).not.toContain('darkContrast=1|lightContrast=1');
    expect(pairs).toContain('darkContrast=1|lightContrast=0');
  });

  it('covers a small known space completely', () => {
    const levels = { a: 2, b: 1, c: 1 };
    const small = generatePairwise(levels, []);
    const covered = coveredPairs(levels, small);
    expect(validPairs(levels, []).every((pair) => covered.has(pair))).toBe(true);
  });
});
