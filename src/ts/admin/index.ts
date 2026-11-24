import { createApi } from './api';
import { mountAdmin } from './app';

const MOUNT_ID = 'kotlinskidev-a11y-admin';

const onReady = (): void => {
  const config = window.kotlinskidevA11yAdmin;
  const root = document.getElementById(MOUNT_ID);
  if (config === undefined || root === null) return;
  void mountAdmin(root, config, createApi(config));
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', onReady);
} else {
  onReady();
}
