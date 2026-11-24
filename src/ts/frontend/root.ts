import type { KotlinskidevA11yConfig } from '../shared/types';

export const ROOT_ID = 'ka11y-root';

export const resolveHost = (doc: Document, config: KotlinskidevA11yConfig): HTMLElement => {
  const existing = doc.getElementById(ROOT_ID);
  const host = existing ?? doc.createElement('div');
  if (!existing) {
    host.id = ROOT_ID;
    doc.body.append(host);
  }
  host.dir = config.rtl ? 'rtl' : 'ltr';
  host.lang = config.locale.replace(/_/g, '-');
  return host;
};

export const resolveShadow = (host: HTMLElement): ShadowRoot => host.shadowRoot ?? host.attachShadow({ mode: 'open' });
