import type { FeatureLevel } from '../../../shared/types';
import { createTextScaler } from './text-scaler';
import type { ScaleResult } from './text-scaler';

export const LINE_HEIGHT_TARGETS: readonly number[] = [1.5, 1.75, 2];

const NORMAL_RATIO = 1.2;

const targetOf = (level: FeatureLevel): number => {
  const index = typeof level === 'number' ? level - 1 : 0;
  return LINE_HEIGHT_TARGETS[Math.min(Math.max(index, 0), LINE_HEIGHT_TARGETS.length - 1)] ?? 1.5;
};

const measure = (computed: CSSStyleDeclaration): number | null => {
  const raw = computed.lineHeight;
  if (raw === 'normal') return NORMAL_RATIO;
  const value = parseFloat(raw);
  if (Number.isNaN(value)) return null;
  if (!raw.endsWith('px')) return value;
  const size = parseFloat(computed.fontSize);
  return Number.isNaN(size) || size <= 0 ? null : value / size;
};

const resolve = (original: number, level: FeatureLevel): ScaleResult => ({
  value: String(Math.max(original, targetOf(level))),
  ratio: 1,
});

export const lineHeight = createTextScaler({
  key: 'lineHeight',
  property: 'line-height',
  inheritsScale: false,
  textScope: 'subtree',
  measure,
  resolve,
});
