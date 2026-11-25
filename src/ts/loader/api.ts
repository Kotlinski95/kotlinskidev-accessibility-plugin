import type { KernelApi } from '../frontend/kernel';
import type { ApiEventName, InlineConfig, KA11yCommand, KotlinskidevA11yApi, PublicState } from '../shared/types';

export interface ApiOptions {
  config: InlineConfig;
  push(command: KA11yCommand): void;
  ensureKernel(): Promise<KernelApi>;
  isOpen(): boolean;
}

interface StateKernel {
  state?(): PublicState;
}

export const installApi = ({ config, push, ensureKernel, isOpen }: ApiOptions): void => {
  const send = (action: string, opener?: HTMLElement | null): void => push({ action, source: 'api', opener });
  const detail = { api: 1, version: config.v };
  let ready = false;

  const api: KotlinskidevA11yApi = {
    api: 1,
    open: (opener) => send('open', opener),
    close: () => send('close'),
    toggle: (target = 'toggle', opener) => send(target, opener),
    set: (feature, level) => {
      const value = typeof level === 'boolean' ? +level : Math.trunc(level);
      if (Number.isFinite(value)) send(`feature:${feature}:${value}`);
    },
    reset: () => send('reset'),
    getState: () => ensureKernel().then((kernel) => ({ ...(kernel as KernelApi & StateKernel).state?.(), open: isOpen() }) as PublicState),
    on: (event: ApiEventName, listener) => {
      const type = `ka11y:${event}`;
      const handler = (raw: Event): void => listener((raw as CustomEvent).detail);
      document.addEventListener(type, handler);
      if (event === 'ready' && ready) queueMicrotask(() => listener(detail));
      return () => document.removeEventListener(type, handler);
    },
  };

  Object.assign(window.kotlinskidevA11y as object, api);
  document.dispatchEvent(new CustomEvent('ka11y:ready', { detail }));
  ready = true;
};
