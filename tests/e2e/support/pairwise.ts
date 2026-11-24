import { CONTRAST_KEYS } from '../../../src/ts/frontend/features/color-orientation/exclusivity';
import { FEATURE_LEVELS } from './schema';

export type Levels = Readonly<Record<string, number>>;
export type Combination = Readonly<Record<string, number>>;
export type ExclusiveGroups = ReadonlyArray<readonly string[]>;

export const EXCLUSIVE_GROUPS: ExclusiveGroups = [CONTRAST_KEYS];

const isValidPair = (groups: ExclusiveGroups, a: string, levelA: number, b: string, levelB: number): boolean =>
  levelA === 0 || levelB === 0 || !groups.some((group) => group.includes(a) && group.includes(b));

const pairKey = (a: string, levelA: number, b: string, levelB: number): string => `${a}=${levelA}|${b}=${levelB}`;

const allValidPairs = (keys: readonly string[], levels: Levels, groups: ExclusiveGroups): string[] => {
  const pairs: string[] = [];
  keys.forEach((a, indexA) => {
    keys.slice(indexA + 1).forEach((b) => {
      for (let levelA = 0; levelA <= (levels[a] ?? 0); levelA += 1) {
        for (let levelB = 0; levelB <= (levels[b] ?? 0); levelB += 1) {
          if (isValidPair(groups, a, levelA, b, levelB)) pairs.push(pairKey(a, levelA, b, levelB));
        }
      }
    });
  });
  return pairs;
};

const pairsOfRow = (keys: readonly string[], row: Record<string, number>): string[] => {
  const pairs: string[] = [];
  keys.forEach((a, indexA) => {
    keys.slice(indexA + 1).forEach((b) => pairs.push(pairKey(a, row[a] ?? 0, b, row[b] ?? 0)));
  });
  return pairs;
};

const gainFor = (
  keys: readonly string[],
  row: Record<string, number>,
  assigned: ReadonlySet<string>,
  key: string,
  level: number,
  uncovered: ReadonlySet<string>
): number => {
  let gain = 0;
  keys.forEach((other) => {
    if (!assigned.has(other) || other === key) return;
    const index = keys.indexOf(key);
    const otherIndex = keys.indexOf(other);
    const pair =
      index < otherIndex
        ? pairKey(key, level, other, row[other] ?? 0)
        : pairKey(other, row[other] ?? 0, key, level);
    if (uncovered.has(pair)) gain += 1;
  });
  return gain;
};

const parsePair = (pair: string): { a: string; levelA: number; b: string; levelB: number } => {
  const [left = '', right = ''] = pair.split('|');
  const [a = '', levelA = '0'] = left.split('=');
  const [b = '', levelB = '0'] = right.split('=');
  return { a, levelA: Number(levelA), b, levelB: Number(levelB) };
};

const completeRow = (
  keys: readonly string[],
  levels: Levels,
  groups: ExclusiveGroups,
  seed: string,
  uncovered: ReadonlySet<string>
): Record<string, number> => {
  const { a, levelA, b, levelB } = parsePair(seed);
  const row: Record<string, number> = { [a]: levelA, [b]: levelB };
  const assigned = new Set<string>([a, b]);
  keys
    .filter((key) => !assigned.has(key))
    .forEach((key) => {
      let bestLevel = 0;
      let bestGain = -1;
      for (let level = 0; level <= (levels[key] ?? 0); level += 1) {
        const compatible = [...assigned].every((other) => isValidPair(groups, key, level, other, row[other] ?? 0));
        if (!compatible) continue;
        const gain = gainFor(keys, row, assigned, key, level, uncovered);
        if (gain > bestGain) {
          bestGain = gain;
          bestLevel = level;
        }
      }
      row[key] = bestLevel;
      assigned.add(key);
    });
  return Object.fromEntries(keys.map((key) => [key, row[key] ?? 0]));
};

export const generatePairwise = (levels: Levels, groups: ExclusiveGroups = EXCLUSIVE_GROUPS): Combination[] => {
  const keys = Object.keys(levels);
  const uncovered = new Set(allValidPairs(keys, levels, groups));
  const rows: Combination[] = [];
  for (const seed of allValidPairs(keys, levels, groups)) {
    if (!uncovered.has(seed)) continue;
    const row = completeRow(keys, levels, groups, seed, uncovered);
    pairsOfRow(keys, row).forEach((pair) => uncovered.delete(pair));
    rows.push(row);
  }
  return rows;
};

export const validPairs = (levels: Levels, groups: ExclusiveGroups = EXCLUSIVE_GROUPS): string[] =>
  allValidPairs(Object.keys(levels), levels, groups);

export const coveredPairs = (levels: Levels, rows: readonly Combination[]): Set<string> => {
  const keys = Object.keys(levels);
  const covered = new Set<string>();
  rows.forEach((row) => pairsOfRow(keys, { ...row }).forEach((pair) => covered.add(pair)));
  return covered;
};

export const FEATURE_COMBINATIONS: readonly Combination[] = generatePairwise(FEATURE_LEVELS);
