const LAUNCHER_SELECTOR = '.ka11y-launcher';

export const ensureShadow = (host: HTMLElement): ShadowRoot => {
  if (host.shadowRoot) return host.shadowRoot;
  const shadow = host.attachShadow({ mode: 'open' });
  const template = host.querySelector('template');
  if (template) {
    shadow.append(template.content);
    template.remove();
  }
  return shadow;
};

export const launcherOf = (host: HTMLElement): HTMLElement | null =>
  host.shadowRoot ? host.shadowRoot.querySelector<HTMLElement>(LAUNCHER_SELECTOR) : null;
