export const READABLE_SELECTOR = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, figcaption, dt, dd, td, th, label, a, button, summary';

const HOVERABLE_SELECTOR = `${READABLE_SELECTOR}, img[alt], input, select, textarea, [role="button"], [role="link"]`;
const INTERACTIVE_SELECTOR =
  'a, button, summary, input, select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="switch"], [role="tab"], [role="menuitem"], [tabindex]:not([tabindex="-1"])';
const BUTTON_INPUT_TYPES = ['button', 'submit', 'reset'];
const MAX_LENGTH = 1000;

export interface ReadTarget {
  element: Element;
  text: string;
}

const squash = (text: string | null | undefined): string => (text ?? '').replace(/\s+/g, ' ').trim();

const textOf = (element: Element): string =>
  squash(element instanceof HTMLElement && typeof element.innerText === 'string' ? element.innerText : element.textContent);

const referencedText = (element: Element): string =>
  squash(
    (element.getAttribute('aria-labelledby') ?? '')
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ')
  );

const isControl = (element: Element): element is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
  element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement;

const controlName = (control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string => {
  if (control instanceof HTMLInputElement) {
    if (control.type === 'hidden') return '';
    if (BUTTON_INPUT_TYPES.includes(control.type)) return squash(control.value);
    if (control.type === 'image') return squash(control.alt);
  }
  const label = squash(control.labels?.[0]?.textContent);
  if (label !== '') return label;
  const placeholder = control instanceof HTMLSelectElement ? '' : squash(control.placeholder);
  return placeholder !== '' ? placeholder : squash(control.title);
};

export const nameOf = (element: Element): string => {
  const name =
    squash(element.getAttribute('aria-label')) ||
    referencedText(element) ||
    (element instanceof HTMLImageElement ? squash(element.alt) : '') ||
    (isControl(element) ? controlName(element) : textOf(element)) ||
    squash(element.getAttribute('title'));
  return name.slice(0, MAX_LENGTH);
};

export const hoverTargetOf = (target: Element): ReadTarget | null => {
  let element = target.closest(HOVERABLE_SELECTOR);
  while (element) {
    const text = nameOf(element);
    if (text !== '') return { element, text };
    element = element.parentElement?.closest(HOVERABLE_SELECTOR) ?? null;
  }
  return null;
};

export const focusTargetOf = (target: Element): ReadTarget | null => {
  if (!target.matches(INTERACTIVE_SELECTOR) && !target.matches(HOVERABLE_SELECTOR) && target.getAttribute('aria-label') === null) return null;
  const text = nameOf(target);
  return text === '' ? null : { element: target, text };
};

export const touchTargetOf = (target: Element): ReadTarget | null => (target.closest(INTERACTIVE_SELECTOR) ? null : hoverTargetOf(target));
