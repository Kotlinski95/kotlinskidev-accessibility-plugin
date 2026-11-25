import { h } from './dom';

export type NoticeKind = 'success' | 'error' | 'warning';

export interface Notices {
  element: HTMLElement;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  clear: () => void;
}

export const createNotices = (): Notices => {
  const element = h('div', { class: 'ka11y-notices', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });

  const show = (kind: NoticeKind, message: string): void => {
    element.replaceChildren(h('div', { class: `notice notice-${kind} inline ka11y-notice` }, h('p', {}, message)));
  };

  return {
    element,
    success: (message) => show('success', message),
    error: (message) => show('error', message),
    warning: (message) => show('warning', message),
    clear: () => element.replaceChildren(),
  };
};
