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

const ARIA: Record<string, string[]> = {
  open: ['aria-controls', 'ka11y-root', 'aria-expanded', 'false', 'aria-haspopup', 'dialog'],
  close: ['aria-controls', 'ka11y-root'],
  feature: ['aria-pressed', 'false'],
};

export const wireAria = (config: InlineConfig): void => {
  document.querySelectorAll('[data-ka11y]:not(html),a[href^="#ka11y/"]').forEach((element) => {
    const action = resolveTrigger(element, config) ?? '';
    const name = action.split(':')[0] as string;
    const pairs = [...(element.localName === 'a' ? ['role', 'button'] : []), ...(ARIA[name === 'toggle' ? 'open' : name === 'profile' ? 'feature' : name] ?? [])];
    for (let index = 0; index < pairs.length; index += 2) {
      if (!element.hasAttribute(pairs[index] as string)) element.setAttribute(pairs[index] as string, pairs[index + 1] as string);
    }
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
    const target = event.target;
    if (event.key === ' ' && target instanceof Element && target.matches('a[role="button"]') && resolveTrigger(target, config)) {
      event.preventDefault();
      (target as HTMLElement).click();
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
