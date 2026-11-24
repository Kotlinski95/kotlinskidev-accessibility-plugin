import { mountAltText } from './alt-text';

const MOUNT_ID = 'kotlinskidev-a11y-alt-text';

const onReady = (): void => {
  const root = document.getElementById(MOUNT_ID);
  const config = window.kotlinskidevA11yAltText;
  if (root === null || config === undefined) return;
  mountAltText(root, config);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', onReady);
} else {
  onReady();
}
