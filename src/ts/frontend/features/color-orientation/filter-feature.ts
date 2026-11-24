import type { FeatureModule } from '../../apply';
import type { FeatureLevel } from '../../../shared/types';
import { clearFilterPart, setFilterPart } from './filter-manager';

export const createFilterFeature = (key: string, filterFor: (level: FeatureLevel) => string): FeatureModule => {
  const on = (level: FeatureLevel): void => setFilterPart(key, filterFor(level));
  const off = (): void => clearFilterPart(key);
  return { key, on, off };
};
