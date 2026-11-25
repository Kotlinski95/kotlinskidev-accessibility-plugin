export type TriggerCheckStatus = 'skipped' | 'found' | 'warning' | 'error' | 'unreachable';

export interface TriggerCheckInput {
  launcher: unknown;
  shortcutEnabled: boolean;
  selectors: readonly string[];
  homeUrl: string;
}

export interface TriggerCheckResult {
  status: TriggerCheckStatus;
}

export type FetchLike = (url: string, init: { credentials: 'omit' }) => Promise<{ ok: boolean; text: () => Promise<string> }>;

export const BASE_TRIGGER_SELECTOR = '[data-ka11y]:not(html),a[href^="#ka11y/"],a[href="#kotlinskidev-a11y"],.ka11y-open';

export const matchesSelector = (doc: Document, selector: string): boolean => {
  try {
    return doc.querySelector(selector) !== null;
  } catch {
    return false;
  }
};

export const hasTrigger = (doc: Document, selectors: readonly string[]): boolean =>
  [BASE_TRIGGER_SELECTOR, ...selectors].some((selector) => matchesSelector(doc, selector));

export const isValidSelector = (selector: string): boolean => {
  try {
    document.createDocumentFragment().querySelector(selector);
    return true;
  } catch {
    return false;
  }
};

export const SELECTOR_LIST_MAX_ITEMS = 10;
export const SELECTOR_LIST_MAX_LENGTH = 300;
export const SELECTOR_MAX_LENGTH = 200;

export type SelectorIssue = 'invalid' | 'broad' | 'long';

const BARE_SELECTORS: readonly string[] = ['html', 'body', '*'];

export const selectorIssue = (selector: string): SelectorIssue | null => {
  if (selector.length > SELECTOR_MAX_LENGTH) return 'long';
  if (!isValidSelector(selector)) return 'invalid';
  const broad = selector.split(',').some((item) => BARE_SELECTORS.includes(item.trim().toLowerCase()));
  return broad ? 'broad' : null;
};

export const exceedsSelectorList = (selectors: readonly string[]): boolean =>
  selectors.length > SELECTOR_LIST_MAX_ITEMS || selectors.join(',').length > SELECTOR_LIST_MAX_LENGTH;

const classify = (found: boolean, shortcutEnabled: boolean): TriggerCheckStatus => {
  if (found) return 'found';
  return shortcutEnabled ? 'warning' : 'error';
};

export const checkTriggers = async (input: TriggerCheckInput, fetcher: FetchLike = (url, init) => fetch(url, init)): Promise<TriggerCheckResult> => {
  if (input.launcher !== 'hidden') return { status: 'skipped' };
  try {
    const response = await fetcher(input.homeUrl, { credentials: 'omit' });
    if (!response.ok) return { status: 'unreachable' };
    const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
    return { status: classify(hasTrigger(doc, input.selectors), input.shortcutEnabled) };
  } catch {
    return { status: 'unreachable' };
  }
};
