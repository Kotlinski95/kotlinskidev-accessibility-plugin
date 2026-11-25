import { OPEN_HASH } from '../frontend/hash-open';
import { matchesCombo } from '../frontend/shortcut';
import { ACTION_PATTERN } from '../shared/actions';
import type { InlineConfig, KA11yCommand } from '../shared/types';
import { launcherOf } from './dsd';

export interface TriggerOptions {
  config: InlineConfig;
  host: HTMLElement;
  push(command: KA11yCommand): void;
  prefetch(): void;
  hiddenKey: string;
}

const INTENT_EVENTS = ['pointerenter', 'focusin', 'touchstart'];

export const HIDDEN_ATTRIBUTE = 'data-ka11y-hidden';

export const ACTION_HASH = '#ka11y/';

const decode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
};

export const resolveTrigger = (element: Element | null | undefined, config: InlineConfig): string | null => {
  try {
    const target = element as Element;
    const href = target.getAttribute('href') ?? '';
    const action =
      (target.localName !== 'html' && target.getAttribute('data-ka11y')) ||
      (href.startsWith(ACTION_HASH)
        ? decode(href.slice(ACTION_HASH.length))
        : href === OPEN_HASH || target.classList.contains('ka11y-open')
          ? 'open'
          : target.matches(config.triggers?.s ?? '')
            ? 'toggle'
            : '');
    return ACTION_PATTERN.test(action) && !action.startsWith('trigger') ? action : null;
  } catch {
    return null;
  }
};

export const wireAria = (config: InlineConfig): void => {
  document.querySelectorAll<HTMLElement>(`${window.kotlinskidevA11yRuntime?.q ?? '[data-ka11y]'},${config.triggers?.s || '#ka11y-root'}`).forEach((element) => {
    const name = resolveTrigger(element, config)?.split(':')[0];
    if (!name) return;
    const attributes = {
      ...(element.localName === 'button' ? {} : { role: 'button' }),
      ...(element.tabIndex < 0 ? { tabindex: '0' } : {}),
      ...(/^(open|toggle|close)$/.test(name) && { 'aria-controls': 'ka11y-root' }),
      ...(/^(open|toggle)$/.test(name) && { 'aria-expanded': 'false', 'aria-haspopup': 'dialog' }),
      ...(/^(feature|profile)$/.test(name) && { 'aria-pressed': 'false' }),
    };
    Object.entries(attributes).forEach(([key, value]) => element.hasAttribute(key) || element.setAttribute(key, value));
  });
};

export const isHidden = (): boolean => document.documentElement.hasAttribute(HIDDEN_ATTRIBUTE);

export const setToolbarHidden = (host: HTMLElement, hiddenKey: string, hidden: boolean): void => {
  document.documentElement.toggleAttribute(HIDDEN_ATTRIBUTE, hidden);
  host.hidden = hidden;
  try {
    if (hidden) sessionStorage.setItem(hiddenKey, '1');
    else {
      sessionStorage.removeItem(hiddenKey);
      localStorage.removeItem(hiddenKey);
    }
  } catch {
    return;
  }
};

export const showToolbar = (host: HTMLElement, hiddenKey: string): void => setToolbarHidden(host, hiddenKey, false);

export const bindTriggers = ({ config, host, push, prefetch, hiddenKey }: TriggerOptions): void => {
  const shortcut = config.shortcut.enabled ? config.shortcut.parsed : null;
  const prefetchOnIntent = config.load.prefetch === 'hover';

  const onHostClick = (): void => push({ action: 'toggle', source: 'launcher', opener: launcherOf(host) });

  const onIntent = (event: Event): void => {
    if ((event as PointerEvent).pointerType === 'touch') return;
    INTENT_EVENTS.forEach((type) => host.removeEventListener(type, onIntent));
    prefetch();
  };

  const openFromHash = (): void => {
    showToolbar(host, hiddenKey);
    push({ action: 'open', source: 'hash' });
  };

  const onHashChange = (): void => {
    if (location.hash === OPEN_HASH) openFromHash();
    else if (location.hash.startsWith(ACTION_HASH)) push({ action: decode(location.hash.slice(ACTION_HASH.length)), source: 'url' });
  };

  const onKeydown = (event: KeyboardEvent): void => {
    const target = event.target as HTMLElement;
    if ([' ', 'Enter'].includes(event.key) && !(event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) && target.matches?.('[role=button]:not(button)') && resolveTrigger(target, config)) {
      event.preventDefault();
      target.click();
      return;
    }
    if (!shortcut || !matchesCombo(shortcut, event)) return;
    event.preventDefault();
    if (!isHidden()) push({ action: 'toggle', source: 'shortcut' });
  };

  host.addEventListener('click', onHostClick);
  if (prefetchOnIntent) INTENT_EVENTS.forEach((type) => host.addEventListener(type, onIntent, { passive: true }));
  addEventListener('hashchange', onHashChange);
  document.addEventListener('keydown', onKeydown);
  onHashChange();
};
