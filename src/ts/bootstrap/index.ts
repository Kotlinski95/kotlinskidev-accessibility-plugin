import type { RuntimeHandoff, SavedState, StorageConfig } from '../shared/types';

interface BootstrapConfig {
  storage?: StorageConfig;
  css?: string | null;
  hk?: string;
}

const config = window.kotlinskidevA11y as unknown as BootstrapConfig | undefined;
const storage = config?.storage;
const recovery = new URLSearchParams(location.search).get('ka11y');
const root = document.documentElement;
const runtime: RuntimeHandoff = (window.kotlinskidevA11yRuntime = window.kotlinskidevA11yRuntime || { s: [], c: [] });
const unsafe = /url|set\(|expr|[;{}]|[^]{201}/i;

if (recovery === 'off') {
  window.kotlinskidevA11yOff = true;
  root.dataset.ka11yHidden = '';
} else if (storage) {
  try {
    const key = storage.key;
    const hiddenKey = config?.hk || `${key}-hidden`;
    if (sessionStorage.getItem(hiddenKey) === '1' || +(localStorage.getItem(hiddenKey) as string) > Date.now()) root.dataset.ka11yHidden = '';
    if (recovery === 'reset') {
      document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      localStorage.removeItem(key);
      sessionStorage.removeItem(hiddenKey);
    } else if (storage.mode !== 'none') {
      const cookie = document.cookie.split('; ').find((part) => part.startsWith(`${key}=`));
      const raw = storage.mode === 'cookie' ? cookie && decodeURIComponent(cookie.slice(key.length + 1)) : localStorage.getItem(key);
      const state: SavedState | null = raw ? JSON.parse(raw) : null;
      if (state && state.exp >= Date.now()) {
        state.classes.forEach((name) => name.startsWith('ka11y-') && root.classList.add(name));
        Object.entries(state.vars).forEach(([name, value]) => name.startsWith('--ka11y-') && !unsafe.test(value) && root.style.setProperty(name, value));
        const levels = state.levels || {};
        runtime.s = Object.keys(levels).filter((name) => levels[name]);
      }
    }
    if (runtime.s.length > 0 && config?.css) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.id = 'kotlinskidev-a11y-frontend-css';
      link.href = config.css;
      if (document.readyState === 'loading') document.write(link.outerHTML);
      else document.head.append(link);
    }
  } catch {
    root.dataset.ka11y = 'error';
  }
  runtime.e = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target.closest('a[href="#kotlinskidev-a11y"],#ka11y-root') : null;
    if (!target) return;
    if (target.id !== 'ka11y-root') event.preventDefault();
    (window.kotlinskidevA11yQueue = window.kotlinskidevA11yQueue || []).push({ action: 'open', source: 'early' });
  };
  document.addEventListener('click', runtime.e, true);
}
