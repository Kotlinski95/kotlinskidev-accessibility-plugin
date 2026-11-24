import type { FeatureModule } from '../../apply';
import { createOverlay, setPointerY } from './overlay';
import { trackPointerY, whenPointerActive } from './pointer-tracker';
import type { PointerTracker } from './pointer-tracker';

let overlays: HTMLElement[] = [];
let waiting: PointerTracker | null = null;
let tracker: PointerTracker | null = null;

const startTracking = (y: number): void => {
  waiting = null;
  const created = [
    createOverlay('ka11y-overlay ka11y-overlay--mask-top'),
    createOverlay('ka11y-overlay ka11y-overlay--mask-bottom'),
  ];
  overlays = created;
  tracker = trackPointerY((pointerY) => created.forEach((overlay) => setPointerY(overlay, pointerY)), y);
};

const on = (): void => {
  if (waiting || tracker) return;
  waiting = whenPointerActive(startTracking);
};

const off = (): void => {
  waiting?.stop();
  tracker?.stop();
  overlays.forEach((overlay) => overlay.remove());
  waiting = null;
  tracker = null;
  overlays = [];
};

export const readingMask: FeatureModule = { key: 'readingMask', on, off };
