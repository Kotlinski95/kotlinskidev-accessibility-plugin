import { createApi } from './api';
import { mountAdmin } from './app';
import type { AdminConfig } from './types';

const MOUNT_ID = 'kotlinskidev-a11y-admin';

const scoped = (config: AdminConfig): AdminConfig => ({ ...config, scope: config.scope === 'network' ? 'network' : 'site' });

const onReady = (): void => {
  const raw = window.kotlinskidevA11yAdmin;
  const root = document.getElementById(MOUNT_ID);
  if (raw === undefined || root === null) return;
  const config = scoped(raw);
  void mountAdmin(root, config, createApi(config));
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', onReady);
} else {
  onReady();
}
