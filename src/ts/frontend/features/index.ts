import { registerFeature } from '../apply';
import type { FeatureModule } from '../apply';
import { colorOrientationFeatures } from './color-orientation';
import { contentFeatures } from './content';

export const allFeatures: FeatureModule[] = [...contentFeatures, ...colorOrientationFeatures];

export const registerAllFeatures = (): void => {
  allFeatures.forEach(registerFeature);
};
