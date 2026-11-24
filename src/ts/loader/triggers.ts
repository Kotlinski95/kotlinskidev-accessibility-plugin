import { OPEN_HASH } from '../frontend/hash-open';
import { matchesCombo } from '../frontend/shortcut';
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

const isHidden = (): boolean => document.documentElement.hasAttribute(HIDDEN_ATTRIBUTE);

export const showToolbar = (host: HTMLElement, hiddenKey: string): void => {
  document.documentElement.removeAttribute(HIDDEN_ATTRIBUTE);
  host.hidden = false;
  try {
    sessionStorage.removeItem(hiddenKey);
    localStorage.removeItem(hiddenKey);
  } catch {
    return;
  }
};

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
  };

  const onDocumentClick = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !target.closest(`a[href="${OPEN_HASH}"]`)) return;
    event.preventDefault();
    openFromHash();
  };

  const onKeydown = (event: KeyboardEvent): void => {
    if (!shortcut || !matchesCombo(shortcut, event)) return;
    event.preventDefault();
    if (!isHidden()) push({ action: 'toggle', source: 'shortcut' });
  };

  host.addEventListener('click', onHostClick);
  if (prefetchOnIntent) INTENT_EVENTS.forEach((type) => host.addEventListener(type, onIntent, { passive: true }));
  addEventListener('hashchange', onHashChange);
  document.addEventListener('click', onDocumentClick, true);
  document.addEventListener('keydown', onKeydown);
  onHashChange();
};
