import type { FeatureModule } from '../../apply';
import { createOverlay, setPointerY } from './overlay';
import { trackPointerY } from './pointer-tracker';
import type { PointerTracker } from './pointer-tracker';

let overlay: HTMLElement | null = null;
let tracker: PointerTracker | null = null;

const on = (): void => {
  if (overlay) return;
  const line = createOverlay('ka11y-reading-line');
  overlay = line;
  tracker = trackPointerY((y) => setPointerY(line, y));
};

const off = (): void => {
  tracker?.stop();
  overlay?.remove();
  tracker = null;
  overlay = null;
};

export const readingLine: FeatureModule = { key: 'readingLine', on, off };
