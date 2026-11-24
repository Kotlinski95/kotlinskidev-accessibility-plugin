import { HOST_ID, OVERLAY_ATTR } from './overlay';

const FILTER_VAR = '--ka11y-filter';
const FILTER_ORDER = ['highContrast', 'monochrome', 'saturation'] as const;
const SKIPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'NOSCRIPT', 'TEMPLATE']);

interface OriginalFilter {
  value: string;
  priority: string;
}

const parts = new Map<string, string>();
const originals = new Map<HTMLElement, OriginalFilter>();
let observer: MutationObserver | null = null;

const isFilterTarget = (node: Node): node is HTMLElement =>
  node instanceof HTMLElement &&
  node.parentElement === document.body &&
  node.id !== HOST_ID &&
  !node.hasAttribute(OVERLAY_ATTR) &&
  !SKIPPED_TAGS.has(node.tagName);

const applyTo = (element: HTMLElement): void => {
  if (originals.has(element)) return;
  originals.set(element, {
    value: element.style.getPropertyValue('filter'),
    priority: element.style.getPropertyPriority('filter'),
  });
  element.style.setProperty('filter', `var(${FILTER_VAR})`);
};

const restore = (element: HTMLElement, original: OriginalFilter): void => {
  if (original.value === '') element.style.removeProperty('filter');
  else element.style.setProperty('filter', original.value, original.priority);
  if (element.getAttribute('style') === '') element.removeAttribute('style');
};

const onBodyMutation = (records: MutationRecord[]): void => {
  records.forEach((record) => {
    record.addedNodes.forEach((node) => {
      if (isFilterTarget(node)) applyTo(node);
    });
  });
};

const startObserving = (): void => {
  if (observer) return;
  observer = new MutationObserver(onBodyMutation);
  observer.observe(document.body, { childList: true });
};

const clearAll = (): void => {
  observer?.disconnect();
  observer = null;
  originals.forEach((original, element) => restore(element, original));
  originals.clear();
  const root = document.documentElement;
  root.style.removeProperty(FILTER_VAR);
  if (root.getAttribute('style') === '') root.removeAttribute('style');
};

const composeFilter = (): string =>
  FILTER_ORDER.map((key) => parts.get(key))
    .filter((value): value is string => value !== undefined)
    .join(' ');

const refresh = (): void => {
  if (parts.size === 0 || !document.body) {
    clearAll();
    return;
  }
  document.documentElement.style.setProperty(FILTER_VAR, composeFilter());
  [...document.body.children].forEach((child) => {
    if (isFilterTarget(child)) applyTo(child);
  });
  startObserving();
};

export const setFilterPart = (key: string, value: string): void => {
  parts.set(key, value);
  refresh();
};

export const clearFilterPart = (key: string): void => {
  parts.delete(key);
  refresh();
};
