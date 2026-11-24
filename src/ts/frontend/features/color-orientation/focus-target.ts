const temporary = new Set<HTMLElement>();

const releaseOne = (element: HTMLElement): void => {
  if (!temporary.delete(element)) return;
  element.removeAttribute('tabindex');
  element.removeEventListener('blur', onTemporaryBlur);
};

function onTemporaryBlur(this: HTMLElement): void {
  releaseOne(this);
}

export const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const releaseTemporaryFocusTargets = (): void => {
  [...temporary].forEach(releaseOne);
};

export const moveFocusTo = (element: HTMLElement): void => {
  if (element.tabIndex < 0 && !element.hasAttribute('tabindex')) {
    element.setAttribute('tabindex', '-1');
    temporary.add(element);
    element.addEventListener('blur', onTemporaryBlur);
  }
  element.focus({ preventScroll: true });
  if (typeof element.scrollIntoView === 'function') {
    element.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }
};
