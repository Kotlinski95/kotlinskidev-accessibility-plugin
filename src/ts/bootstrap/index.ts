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

if (storage && storage.mode !== 'none') {
  try {
    const raw = storage.mode === 'cookie' ? readCookie(storage.key) : localStorage.getItem(storage.key);
    if (raw) apply(JSON.parse(raw) as SavedState);
  } catch {
    document.documentElement.dataset.ka11y = 'error';
  }
}
