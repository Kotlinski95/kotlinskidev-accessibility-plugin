import type { FeatureModule } from '../../apply';
import { darkContrast } from './dark-contrast';
import { hideImages } from './hide-images';
import { highContrast } from './high-contrast';
import { highlightAll } from './highlight-all';
import { highlightTitles } from './highlight-titles';
import { keyboardNavigation } from './keyboard-navigation';
import { lightContrast } from './light-contrast';
import { monochrome } from './monochrome';
import { muteSounds } from './mute-sounds';
import { readPage } from './read-page';
import { readingLine } from './reading-line';
import { readingMask } from './reading-mask';
import { saturation } from './saturation';
import { skipToContent } from './skip-to-content';
import { stopAnimations } from './stop-animations';

export { bindContrastExclusivity, CONTRAST_KEYS } from './exclusivity';
export { findLandmarks, focusLandmark } from './landmarks';
export type { Landmark, LandmarkKind } from './landmarks';

export const colorOrientationFeatures: FeatureModule[] = [
  darkContrast,
  lightContrast,
  highContrast,
  monochrome,
  saturation,
  readingLine,
  readingMask,
  readPage,
  keyboardNavigation,
  hideImages,
  muteSounds,
  highlightTitles,
  highlightAll,
  stopAnimations,
  skipToContent,
];
