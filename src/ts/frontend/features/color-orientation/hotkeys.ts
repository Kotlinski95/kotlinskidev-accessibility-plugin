import { HOST_ID } from './overlay';

export const HOTKEY_SELECTORS: Readonly<Record<string, string>> = {
  h: 'h1, h2, h3, h4, h5, h6, [role="heading"]',
  f: 'form, [role="form"]',
  b: 'button, [role="button"], input[type="button"], input[type="submit"], input[type="reset"]',
  g: 'img, picture, svg[role="img"], [role="img"]',
  l: 'a[href], [role="link"]',
  m: 'nav, [role="navigation"], [role="menu"], [role="menubar"]',
};

const TYPING_SELECTOR =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="searchbox"], [role="combobox"]';

export const hasModifier = (event: KeyboardEvent): boolean =>
  event.ctrlKey || event.metaKey || event.altKey || event.shiftKey;

export const isIgnoredTarget = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest(`${TYPING_SELECTOR}, #${HOST_ID}`) !== null;

const isReachable = (element: HTMLElement): boolean => {
  if (element.closest(`[hidden], [inert], [aria-hidden="true"], #${HOST_ID}`)) return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
};

export const findNextTarget = (selector: string, reference: Element | null): HTMLElement | null => {
  const candidates = [...document.querySelectorAll<HTMLElement>(selector)].filter(isReachable);
  if (candidates.length === 0) return null;
  const following = candidates.find(
    (candidate) =>
      reference !== null &&
      candidate !== reference &&
      (reference.compareDocumentPosition(candidate) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
  );
  return following ?? candidates.find((candidate) => candidate !== reference) ?? candidates[0] ?? null;
};
