import type { FeatureModule } from '../../apply';
import { createOverlay, setPointerY } from './overlay';
import { trackPointerY } from './pointer-tracker';
import type { PointerTracker } from './pointer-tracker';

let overlays: HTMLElement[] = [];
let tracker: PointerTracker | null = null;

const on = (): void => {
  if (tracker) return;
  const created = [createOverlay('ka11y-reading-mask ka11y-reading-mask--top'), createOverlay('ka11y-reading-mask ka11y-reading-mask--bottom')];
  overlays = created;
  tracker = trackPointerY((y) => created.forEach((overlay) => setPointerY(overlay, y)));
};

const off = (): void => {
  tracker?.stop();
  overlays.forEach((overlay) => overlay.remove());
  tracker = null;
  overlays = [];
};

export const readingMask: FeatureModule = { key: 'readingMask', on, off };
