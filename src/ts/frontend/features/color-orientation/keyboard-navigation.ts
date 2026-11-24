import type { FeatureModule } from '../../apply';
import { featureClassBase } from '../../feature-utils';
import { moveFocusTo, releaseTemporaryFocusTargets } from './focus-target';
import { HOTKEY_SELECTORS, findNextTarget, hasModifier, isIgnoredTarget } from './hotkeys';
import { addRootClass, removeRootClass } from './root-class';

const CLASS_NAME = featureClassBase('keyboardNavigation');

let listening = false;
let lastTarget: HTMLElement | null = null;

const referenceElement = (): Element | null => {
  const active = document.activeElement;
  return active && active !== document.body && active !== document.documentElement ? active : lastTarget;
};

const onDocumentKeydown = (event: KeyboardEvent): void => {
  if (event.defaultPrevented || hasModifier(event) || isIgnoredTarget(event.target)) return;
  const selector = HOTKEY_SELECTORS[event.key.toLowerCase()];
  if (selector === undefined) return;
  const target = findNextTarget(selector, referenceElement());
  if (!target) return;
  event.preventDefault();
  lastTarget = target;
  moveFocusTo(target);
};

const on = (): void => {
  addRootClass(CLASS_NAME);
  if (listening) return;
  document.addEventListener('keydown', onDocumentKeydown);
  listening = true;
};

const off = (): void => {
  removeRootClass(CLASS_NAME);
  if (listening) document.removeEventListener('keydown', onDocumentKeydown);
  listening = false;
  lastTarget = null;
  releaseTemporaryFocusTargets();
};

export const keyboardNavigation: FeatureModule = { key: 'keyboardNavigation', on, off };
