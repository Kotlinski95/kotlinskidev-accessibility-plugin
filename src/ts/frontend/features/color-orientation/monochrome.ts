import { createFilterFeature } from './filter-feature';

export const monochrome = createFilterFeature('monochrome', () => 'grayscale(1)');
