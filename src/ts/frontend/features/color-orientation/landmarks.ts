import { moveFocusTo } from './focus-target';
import { HOST_ID } from './overlay';

export type LandmarkKind = 'main' | 'navigation' | 'footer';

export interface Landmark {
  kind: LandmarkKind;
  element: HTMLElement;
  label: string;
}

const LANDMARK_SELECTORS: Readonly<Record<LandmarkKind, string>> = {
  main: 'main, [role="main"]',
  navigation: 'nav, [role="navigation"]',
  footer: 'footer, [role="contentinfo"]',
};

const isListed = (element: HTMLElement): boolean =>
  element.closest(`[hidden], [inert], #${HOST_ID}`) === null;

export const findLandmarks = (root: ParentNode = document): Landmark[] => {
  const seen = new Set<HTMLElement>();
  const landmarks: Landmark[] = [];
  (Object.keys(LANDMARK_SELECTORS) as LandmarkKind[]).forEach((kind) => {
    root.querySelectorAll<HTMLElement>(LANDMARK_SELECTORS[kind]).forEach((element) => {
      if (seen.has(element) || !isListed(element)) return;
      seen.add(element);
      landmarks.push({ kind, element, label: element.getAttribute('aria-label') ?? '' });
    });
  });
  return landmarks;
};

export const focusLandmark = (landmark: Landmark): void => moveFocusTo(landmark.element);
