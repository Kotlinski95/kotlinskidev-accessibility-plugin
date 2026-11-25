import type { InlineConfig } from '../shared/types';

export const mountLauncher = (config: InlineConfig, host: HTMLElement): void => {
  if (config.launcher?.mode !== 'inline') return;
  try {
    (document.querySelector(config.launcher.mount) as Element).append(host);
  } catch {
    host.setAttribute('data-ka11y-launcher', 'floating');
    console.warn('[kotlinskidev-a11y] launcher mount not found');
  }
};
