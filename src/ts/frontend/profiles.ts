import type { FeatureConfig, FeatureLevel, ProfileConfig } from '../shared/types';
import { isLevelActive } from './feature-utils';
import { profileLevelFor } from './profile-levels';
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

  const featuresOf = (key: string): string[] =>
    keys().includes(key) ? (profiles[key]?.features ?? []).filter(isAllowed) : [];

  const releaseOwned = (): void => {
    const { owned, levels } = store.getState();
    Object.entries(owned).forEach(([feature, level]) => {
      if (levels[feature] === level) store.setLevel(feature, false);
    });
    store.set({ profile: null, owned: {} });
  };

  const apply = (key: string): void => {
    const members = featuresOf(key);
    if (members.length === 0) return;
    releaseOwned();
    const owned: Record<string, FeatureLevel> = {};
    members.forEach((feature) => {
      if (isLevelActive(store.getState().levels[feature])) return;
      const level = profileLevelFor(key, feature);
      store.setLevel(feature, level);
      if (store.getState().levels[feature] === level) owned[feature] = level;
    });
    store.set({ profile: key, owned });
  };

  const clear = (key: string): void => {
    if (store.getState().profile === key) releaseOwned();
  };

  const isActive = (key: string): boolean => {
    const { profile, owned, levels } = store.getState();
    return profile === key && Object.entries(owned).every(([feature, level]) => levels[feature] === level);
  };

  const toggle = (key: string): void => {
    if (store.getState().profile === key && isActive(key)) clear(key);
    else apply(key);
  };

  return { keys, featuresOf, apply, clear, toggle, isActive };
};
