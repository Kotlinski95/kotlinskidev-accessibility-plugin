import type { FeatureModule } from '../../apply';
import { features as colorFeatures } from '../../chunks/color';
import { features as orientationFeatures } from '../../chunks/orientation';
export { bindContrastExclusivity, CONTRAST_KEYS } from './exclusivity';
export { findLandmarks, focusLandmark } from './landmarks';
export type { Landmark, LandmarkKind } from './landmarks';

export const colorOrientationFeatures: FeatureModule[] = [...colorFeatures, ...orientationFeatures];
