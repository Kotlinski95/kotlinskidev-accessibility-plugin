import { createApplier } from './apply';
import { registerAllFeatures } from './features';
import { bindContrastExclusivity } from './features/color-orientation';
import { bindHashOpen } from './hash-open';
import { createHideToolbar } from './hide-toolbar';
import { createPanel } from './panel';
import { createProfiles } from './profiles';
import { resolveHost, resolveShadow } from './root';
import { bindShortcut } from './shortcut';
import { createStorage } from './storage';
import { createStore } from './store';
import { injectDocumentCustomCss } from './styles';
import { createThemeResolver } from './theme';

const boot = (): void => {
  const config = window.kotlinskidevA11y;
  if (!config || window.kotlinskidevA11yOff) return;

  const store = createStore();
  bindContrastExclusivity(store);
  const storage = createStorage(config.storage);
  const saved = storage.load();
  if (saved) store.set(saved);
  registerAllFeatures();
  createApplier(store);
  store.subscribe((state) => storage.save(state));

  injectDocumentCustomCss(document, config.customCss);

  const host = resolveHost(document, config);
  const shadow = resolveShadow(host);
  createThemeResolver({ host, config: config.theme });

  const profiles = createProfiles(store, config.profiles, config.features);
  const hideToolbar = createHideToolbar({ host, key: config.storage.key });
  const { dialog } = createPanel({ config, store, profiles, hideToolbar, host, shadow });

  const onHashOpen = (): void => {
    hideToolbar.show();
    dialog.open();
  };

  const onShortcutToggle = (): void => {
    if (!hideToolbar.isHidden()) dialog.toggle();
  };

  bindHashOpen({ onOpen: onHashOpen });
  bindShortcut({ config: config.shortcut, onToggle: onShortcutToggle });
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
