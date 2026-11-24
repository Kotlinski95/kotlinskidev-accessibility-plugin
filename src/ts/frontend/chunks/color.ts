import type { FeatureModule } from '../apply';
import { bindContrastExclusivity } from '../features/color-orientation/exclusivity';
import { darkContrast } from '../features/color-orientation/dark-contrast';
import { highContrast } from '../features/color-orientation/high-contrast';
import { lightContrast } from '../features/color-orientation/light-contrast';
import { monochrome } from '../features/color-orientation/monochrome';
import { saturation } from '../features/color-orientation/saturation';
import type { KernelApi } from '../kernel';

export const features: readonly FeatureModule[] = [darkContrast, lightContrast, highContrast, monochrome, saturation];

export const init = (kernel: KernelApi): void => {
  bindContrastExclusivity(kernel.store);
};
