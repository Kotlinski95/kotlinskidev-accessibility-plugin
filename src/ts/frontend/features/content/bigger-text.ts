import type { FeatureLevel } from '../../../shared/types';
import { createTextScaler } from './text-scaler';
import type { ScaleResult } from './text-scaler';

export const BIGGER_TEXT_FACTORS: readonly number[] = [1.1, 1.25, 1.5];

const factorOf = (level: FeatureLevel): number => {
  const index = typeof level === 'number' ? level - 1 : 0;
  return BIGGER_TEXT_FACTORS[Math.min(Math.max(index, 0), BIGGER_TEXT_FACTORS.length - 1)] ?? 1;
};

const measure = (computed: CSSStyleDeclaration): number | null => {
  const size = parseFloat(computed.fontSize);
  return Number.isNaN(size) ? null : size;
};

const resolve = (original: number, level: FeatureLevel): ScaleResult => {
  const ratio = factorOf(level);
  return { value: `${Math.round(original * ratio * 100) / 100}px`, ratio };
};

export const biggerText = createTextScaler({
  key: 'biggerText',
  property: 'font-size',
  inheritsScale: true,
  measure,
  resolve,
});
