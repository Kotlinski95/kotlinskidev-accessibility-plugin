import { createFilterFeature } from './filter-feature';

export const SATURATION_LOW = 0.5;
export const SATURATION_HIGH = 2;

export const saturation = createFilterFeature('saturation', (level) =>
  `saturate(${typeof level === 'number' && level >= 2 ? SATURATION_HIGH : SATURATION_LOW})`
);
