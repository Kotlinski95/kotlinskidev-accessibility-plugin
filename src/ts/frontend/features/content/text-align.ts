import type { FeatureLevel } from '../../../shared/types';
import type { FeatureModule } from '../../apply';

export const ALIGNMENTS: readonly string[] = ['left', 'center', 'right'];

const alignClass = (alignment: string): string => `ka11y-align-${alignment}`;

const alignmentOf = (level: FeatureLevel): string => {
  const index = typeof level === 'number' ? level - 1 : 0;
  return ALIGNMENTS[Math.min(Math.max(index, 0), ALIGNMENTS.length - 1)] ?? 'left';
};

const clearAlignments = (): void => {
  document.documentElement.classList.remove(...ALIGNMENTS.map(alignClass));
  if (document.documentElement.classList.length === 0) document.documentElement.removeAttribute('class');
};

const on = (level: FeatureLevel): void => {
  clearAlignments();
  document.documentElement.classList.add(alignClass(alignmentOf(level)));
};

const off = (): void => {
  clearAlignments();
};

export const textAlign: FeatureModule = { key: 'textAlign', on, off };
