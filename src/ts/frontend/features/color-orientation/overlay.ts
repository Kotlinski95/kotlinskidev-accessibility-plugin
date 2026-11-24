export const OVERLAY_ATTR = 'data-ka11y-overlay';
export const HOST_ID = 'ka11y-root';
const POINTER_VAR = '--ka11y-pointer-y';

export const createOverlay = (className: string): HTMLElement => {
  const overlay = document.createElement('div');
  overlay.className = className;
  overlay.setAttribute('aria-hidden', 'true');
  overlay.setAttribute(OVERLAY_ATTR, '');
  document.body.append(overlay);
  return overlay;
};

export const setPointerY = (overlay: HTMLElement, y: number): void => {
  overlay.style.setProperty(POINTER_VAR, `${Math.round(y)}px`);
};
