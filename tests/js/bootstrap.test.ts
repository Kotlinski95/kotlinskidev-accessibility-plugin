import type { SavedState, StorageMode } from '../../src/ts/shared/types';

const KEY = 'ka11y';

const runBootstrap = async (): Promise<void> => {
  jest.resetModules();
  await import('../../src/ts/bootstrap/index');
};

const loadBootstrap = async (mode: StorageMode): Promise<void> => {
  window.kotlinskidevA11y = { storage: { mode, key: KEY, ttlDays: 365 } } as Window['kotlinskidevA11y'];
  await runBootstrap();
};

const state = (overrides: Partial<SavedState> = {}): string =>
  JSON.stringify({
    classes: ['ka11y-high-contrast', 'unrelated'],
    vars: { '--ka11y-font-scale': '1.25', '--other': 'x' },
    exp: Date.now() + 60000,
    ...overrides,
  });

describe('bootstrap', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    document.documentElement.removeAttribute('style');
    document.documentElement.removeAttribute('data-ka11y');
    localStorage.clear();
    document.cookie = `${KEY}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    window.history.replaceState({}, '', '/');
    delete window.kotlinskidevA11yOff;
  });

  it('applies saved classes and vars from localStorage', async () => {
    localStorage.setItem(KEY, state());
    await loadBootstrap('local');
    const root = document.documentElement;
    expect(root.classList.contains('ka11y-high-contrast')).toBe(true);
    expect(root.classList.contains('unrelated')).toBe(false);
    expect(root.style.getPropertyValue('--ka11y-font-scale')).toBe('1.25');
    expect(root.style.getPropertyValue('--other')).toBe('');
  });

  it('applies saved state from a cookie', async () => {
    document.cookie = `${KEY}=${encodeURIComponent(state())}`;
    await loadBootstrap('cookie');
    expect(document.documentElement.classList.contains('ka11y-high-contrast')).toBe(true);
  });

  it('ignores expired state', async () => {
    localStorage.setItem(KEY, state({ exp: Date.now() - 1000 }));
    await loadBootstrap('local');
    expect(document.documentElement.className).toBe('');
    expect(document.documentElement.getAttribute('style')).toBeNull();
  });

  it('ignores corrupt JSON', async () => {
    localStorage.setItem(KEY, '{not json');
    await expect(loadBootstrap('local')).resolves.toBeUndefined();
    expect(document.documentElement.dataset.ka11y).toBe('error');
    expect(document.documentElement.className).toBe('');
  });

  it('does nothing when mode is none', async () => {
    localStorage.setItem(KEY, state());
    await loadBootstrap('none');
    expect(document.documentElement.className).toBe('');
  });

  it('does nothing without config', async () => {
    delete window.kotlinskidevA11y;
    await runBootstrap();
    expect(document.documentElement.className).toBe('');
  });

  it('reset url clears localStorage state and restores nothing', async () => {
    localStorage.setItem(KEY, state());
    window.history.replaceState({}, '', '/?ka11y=reset');
    await loadBootstrap('local');
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(document.documentElement.className).toBe('');
    expect(document.documentElement.getAttribute('style')).toBeNull();
  });

  it('reset url clears the cookie state and restores nothing', async () => {
    document.cookie = `${KEY}=${encodeURIComponent(state())}; path=/`;
    window.history.replaceState({}, '', '/?ka11y=reset');
    await loadBootstrap('cookie');
    expect(document.cookie).not.toContain(KEY);
    expect(document.documentElement.className).toBe('');
  });

  it('reset url clears both stores whatever the storage mode', async () => {
    localStorage.setItem(KEY, state());
    document.cookie = `${KEY}=${encodeURIComponent(state())}; path=/`;
    window.history.replaceState({}, '', '/?ka11y=reset');
    await loadBootstrap('cookie');
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(document.cookie).not.toContain(KEY);
  });

  it('off url applies nothing, keeps saved state and sets the page flag', async () => {
    localStorage.setItem(KEY, state());
    window.history.replaceState({}, '', '/?ka11y=off');
    await loadBootstrap('local');
    expect(window.kotlinskidevA11yOff).toBe(true);
    expect(document.documentElement.className).toBe('');
    expect(localStorage.getItem(KEY)).not.toBeNull();
  });

  it('off url sets the flag even without storage config', async () => {
    delete window.kotlinskidevA11y;
    window.history.replaceState({}, '', '/?ka11y=off');
    await runBootstrap();
    expect(window.kotlinskidevA11yOff).toBe(true);
  });

  it('an unknown ka11y value restores state as usual', async () => {
    localStorage.setItem(KEY, state());
    window.history.replaceState({}, '', '/?ka11y=other');
    await loadBootstrap('local');
    expect(document.documentElement.classList.contains('ka11y-high-contrast')).toBe(true);
    expect(window.kotlinskidevA11yOff).toBeUndefined();
  });
});
