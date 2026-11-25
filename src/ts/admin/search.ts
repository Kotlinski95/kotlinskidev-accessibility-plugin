import { __, _n, sprintf } from '@wordpress/i18n';
import { PATH_ATTRIBUTE, h, uid } from './dom';
import type { TabsApi } from './tabs';

export const MAX_RESULTS = 30;
const CONTROL = 'input:not([aria-hidden="true"]):not([type="hidden"]), select, textarea, button';
const LABEL = '.ka11y-field__label, .ka11y-toggle__label, legend';
const HELP = '.ka11y-field__help';
const FOUND_CLASS = 'is-found';

export interface SearchEntry {
  path: string;
  label: string;
  tabId: string;
  tabLabel: string;
  haystack: string;
  element: HTMLElement;
}

export const normalize = (text: string): string => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const compact = (text: string): string => normalize(text).replace(/[^\p{L}\p{N}]/gu, '');

const labelOf = (element: HTMLElement, path: string): string => {
  const explicit = element.getAttribute('aria-label') ?? element.querySelector(CONTROL)?.getAttribute('aria-label');
  const text = explicit ?? element.querySelector(LABEL)?.textContent;
  return text !== undefined && text !== null && text.trim() !== '' ? text.trim() : path;
};

export const buildIndex = (root: HTMLElement): SearchEntry[] => {
  const seen = new Set<string>();
  const entries: SearchEntry[] = [];
  root.querySelectorAll<HTMLElement>(`[${PATH_ATTRIBUTE}]`).forEach((element) => {
    const path = element.getAttribute(PATH_ATTRIBUTE) ?? '';
    const panel = element.closest<HTMLElement>('[data-ka11y-tab]');
    if (path === '' || panel === null || seen.has(path)) return;
    seen.add(path);
    const label = labelOf(element, path);
    const help = element.querySelector(HELP)?.textContent ?? '';
    const tabButton = document.getElementById(panel.getAttribute('aria-labelledby') ?? '');
    entries.push({ path, label, tabId: panel.dataset.ka11yTab ?? '', tabLabel: tabButton?.textContent ?? '', haystack: `${label} ${path} ${help}`, element });
  });
  return entries;
};

export const matchEntries = (entries: readonly SearchEntry[], query: string): SearchEntry[] => {
  const terms = normalize(query)
    .split(/\s+/)
    .filter((term) => term !== '');
  if (terms.length === 0) return [];
  return entries.filter((entry) => {
    const text = normalize(entry.haystack);
    const squeezed = compact(entry.haystack);
    return terms.every((term) => text.includes(term) || squeezed.includes(compact(term)));
  });
};

export const statusText = (query: string, count: number): string => {
  if (query.trim() === '') return '';
  if (count === 0) return __('No settings found.', 'kotlinskidev-accessibility');
  return sprintf(_n('%d setting found.', '%d settings found.', count, 'kotlinskidev-accessibility'), count);
};

export interface SearchBox {
  element: HTMLElement;
  input: HTMLInputElement;
  clear: () => void;
}

export const createSearch = (getForm: () => TabsApi | undefined): SearchBox => {
  const id = uid('ka11y-search');
  const input = h('input', { type: 'search', class: 'regular-text ka11y-search__input', id, autocomplete: 'off', 'aria-describedby': `${id}-status` });
  const status = h('p', { class: 'ka11y-search__status', id: `${id}-status`, role: 'status', 'aria-live': 'polite' });
  const list = h('ul', { class: 'ka11y-search__results', 'aria-label': __('Search results', 'kotlinskidev-accessibility') });
  const element = h(
    'div',
    { class: 'ka11y-search', role: 'search' },
    h('label', { class: 'ka11y-search__label', for: id }, __('Search settings', 'kotlinskidev-accessibility')),
    input,
    status,
    list
  );
  list.hidden = true;
  let highlighted: HTMLElement | null = null;

  const clearHighlight = (): void => {
    highlighted?.classList.remove(FOUND_CLASS);
    highlighted = null;
  };

  const reveal = (entry: SearchEntry): void => {
    getForm()?.select(entry.tabId);
    clearHighlight();
    const target = entry.element.matches(CONTROL) ? entry.element : entry.element.querySelector<HTMLElement>(CONTROL);
    highlighted = entry.element.closest<HTMLElement>('.ka11y-field') ?? entry.element;
    highlighted.classList.add(FOUND_CLASS);
    if (typeof entry.element.scrollIntoView === 'function') entry.element.scrollIntoView({ block: 'center' });
    target?.focus();
    target?.addEventListener('blur', clearHighlight, { once: true });
  };

  const render = (): void => {
    const form = getForm();
    const found = form === undefined ? [] : matchEntries(buildIndex(form.element), input.value);
    status.textContent = statusText(input.value, found.length);
    list.replaceChildren(
      ...found.slice(0, MAX_RESULTS).map((entry) => {
        const choose = h('button', { type: 'button', class: 'button-link ka11y-search__result' }, entry.label);
        choose.addEventListener('click', () => reveal(entry));
        return h('li', {}, choose, h('span', { class: 'ka11y-search__where' }, ` ${entry.tabLabel}`));
      })
    );
    list.hidden = found.length === 0;
  };

  const clear = (): void => {
    input.value = '';
    clearHighlight();
    render();
  };

  input.addEventListener('input', render);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && input.value !== '') {
      event.preventDefault();
      clear();
    }
  });

  return { element, input, clear };
};
