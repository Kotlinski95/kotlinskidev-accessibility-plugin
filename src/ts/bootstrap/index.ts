import type { SavedState } from '../shared/types';

const readCookie = (key: string): string | null => {
  const prefix = `${key}=`;
  const entry = document.cookie.split('; ').find((part) => part.startsWith(prefix));
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : null;
};

const apply = (state: SavedState): void => {
  if (state.exp < Date.now()) return;
  const root = document.documentElement;
  state.classes.forEach((name) => {
    if (name.startsWith('ka11y-')) root.classList.add(name);
  });
  Object.entries(state.vars).forEach(([name, value]) => {
    if (name.startsWith('--ka11y-')) root.style.setProperty(name, value);
  });
};

const storage = window.kotlinskidevA11y?.storage;
const recovery = new URLSearchParams(location.search).get('ka11y');

if (recovery === 'off') window.kotlinskidevA11yOff = true;
else if (storage) {
  try {
    if (recovery === 'reset') {
      document.cookie = `${storage.key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      localStorage.removeItem(storage.key);
    } else if (storage.mode !== 'none') {
      const raw = storage.mode === 'cookie' ? readCookie(storage.key) : localStorage.getItem(storage.key);
      if (raw) apply(JSON.parse(raw) as SavedState);
    }
  } catch {
    document.documentElement.dataset.ka11y = 'error';
  }
}
