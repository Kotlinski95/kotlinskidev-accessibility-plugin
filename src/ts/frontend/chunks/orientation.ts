import type { FeatureModule } from '../apply';
import { hideImages } from '../features/color-orientation/hide-images';
import { highlightAll } from '../features/color-orientation/highlight-all';
import { highlightTitles } from '../features/color-orientation/highlight-titles';
import { keyboardNavigation } from '../features/color-orientation/keyboard-navigation';
import { muteSounds } from '../features/color-orientation/mute-sounds';
import { readPage } from '../features/color-orientation/read-page';
import { readingLine } from '../features/color-orientation/reading-line';
import { readingMask } from '../features/color-orientation/reading-mask';
import { skipToContent } from '../features/color-orientation/skip-to-content';
import { stopAnimations } from '../features/color-orientation/stop-animations';

export const features: readonly FeatureModule[] = [
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
