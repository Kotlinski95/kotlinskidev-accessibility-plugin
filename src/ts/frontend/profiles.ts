import type { FeatureConfig, ProfileConfig } from '../shared/types';
import { isLevelActive } from './feature-utils';
import { levelCountOf } from './feature-groups';
import type { Store } from './store';

export interface Profiles {
  keys(): string[];
  featuresOf(key: string): string[];
  apply(key: string): void;
  clear(key: string): void;
  toggle(key: string): void;
  isActive(key: string): boolean;
}

export const createProfiles = (
  store: Store,
  profiles: Record<string, ProfileConfig>,
  features?: Record<string, FeatureConfig>
): Profiles => {
  const isAllowed = (feature: string): boolean => features === undefined || features[feature]?.enabled === true;

  const keys = (): string[] => Object.keys(profiles).filter((key) => profiles[key]?.enabled === true);

  const featuresOf = (key: string): string[] => (profiles[key]?.features ?? []).filter(isAllowed);

  const apply = (key: string): void => {
    featuresOf(key).forEach((feature) => store.setLevel(feature, levelCountOf(feature) > 1 ? 1 : true));
  };

  const clear = (key: string): void => {
    featuresOf(key).forEach((feature) => store.setLevel(feature, false));
  };

  const isActive = (key: string): boolean => {
    const members = featuresOf(key);
    const { levels } = store.getState();
    return members.length > 0 && members.every((feature) => isLevelActive(levels[feature]));
  };

  const toggle = (key: string): void => {
    if (isActive(key)) clear(key);
    else apply(key);
  };

  return { keys, featuresOf, apply, clear, toggle, isActive };
};
