import type { FeatureLevel } from '../shared/types';
import { levelCountOf } from './feature-groups';

export const PROFILE_LEVELS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  visionImpaired: { biggerText: 2 },
  seizureSafe: { saturation: 1 },
  adhdFriendly: {},
  blindness: {},
  epilepsySafe: {},
};

export const profileLevelFor = (profile: string, feature: string): FeatureLevel => {
  const count = levelCountOf(feature);
  if (count === 1) return true;
  const preset = PROFILE_LEVELS[profile]?.[feature] ?? 1;
  return Math.min(Math.max(preset, 1), count);
};
