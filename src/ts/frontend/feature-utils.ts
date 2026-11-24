import type { FeatureLevel } from '../shared/types';

export const kebabCase = (name: string): string =>
  name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

export const isLevelActive = (level: FeatureLevel | undefined): boolean =>
  level === true || (typeof level === 'number' && level > 0);

export const featureClassBase = (key: string): string => `ka11y-${kebabCase(key)}`;
