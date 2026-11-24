import type { SavedState, StorageMode } from '../../src/ts/shared/types';

const KEY = 'ka11y';

const detachEarlyClicks = (): void => {
  const listener = window.kotlinskidevA11yRuntime?.e;
  if (listener) document.removeEventListener('click', listener, true);
};

const runBootstrap = async (): Promise<void> => {
  detachEarlyClicks();
  jest.resetModules();
  await import('../../src/ts/bootstrap/index');
};

const CSS_URL = 'https://example.test/build/frontend.css?ver=abc';

const loadBootstrap = async (mode: StorageMode, extra: Record<string, unknown> = {}): Promise<void> => {
  window.kotlinskidevA11y = { storage: { mode, key: KEY, ttlDays: 365 }, ...extra } as unknown as Window['kotlinskidevA11y'];
  await runBootstrap();
};

const setReadyState = (value: DocumentReadyState | null): void => {
  if (value === null) {
    Reflect.deleteProperty(document, 'readyState');
    return;
  }
  Object.defineProperty(document, 'readyState', { configurable: true, get: () => value });
};

const withLevels = (levels: Record<string, boolean | number>): string => state({ levels });

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
    detachEarlyClicks();
    delete window.kotlinskidevA11yRuntime;
    delete window.kotlinskidevA11yQueue;
    document.documentElement.removeAttribute('data-ka11y-hidden');
    document.getElementById('kotlinskidev-a11y-frontend-css')?.remove();
    document.getElementById('ka11y-root')?.remove();
    sessionStorage.clear();
    setReadyState(null);
    jest.restoreAllMocks();
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

  it('still installs the early click capture when stored state is corrupt', async () => {
    localStorage.setItem(KEY, '{not json');
    await loadBootstrap('local');
    expect(typeof window.kotlinskidevA11yRuntime?.e).toBe('function');
  });

  it('still installs the early click capture when the cookie cannot be decoded', async () => {
    document.cookie = `${KEY}=%E0%A4%A; path=/`;
    await loadBootstrap('cookie');
    expect(document.documentElement.dataset.ka11y).toBe('error');
    expect(typeof window.kotlinskidevA11yRuntime?.e).toBe('function');
  });

  it('still installs the early click capture when storage access throws', async () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    await loadBootstrap('local');
    expect(typeof window.kotlinskidevA11yRuntime?.e).toBe('function');
  });

  it.each([
    ['url(', 'url(https://evil.test/x.png)'],
    ['image-set(', 'image-set("a.png" 1x)'],
    ['expression', 'expression(alert(1))'],
    ['a semicolon', '1;color:red'],
    ['an opening brace', '1{'],
    ['a closing brace', '1}'],
    ['an overlong value', 'a'.repeat(201)],
  ])('rejects a stored var containing %s', async (_label, value) => {
    localStorage.setItem(KEY, state({ vars: { '--ka11y-font-scale': value, '--ka11y-ok': '1.5' } }));
    await loadBootstrap('local');
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--ka11y-font-scale')).toBe('');
    expect(root.style.getPropertyValue('--ka11y-ok')).toBe('1.5');
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

  it('reset url clears the session hidden key', async () => {
    sessionStorage.setItem(`${KEY}-hidden`, '1');
    window.history.replaceState({}, '', '/?ka11y=reset');
    await loadBootstrap('local');
    expect(sessionStorage.getItem(`${KEY}-hidden`)).toBeNull();
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

  describe('runtime handoff', () => {
    it('creates the runtime and lists the active level keys', async () => {
      localStorage.setItem(KEY, withLevels({ readingLine: true, biggerText: 2, muteSounds: false, lineHeight: 0 }));
      await loadBootstrap('local');
      expect(window.kotlinskidevA11yRuntime?.s).toEqual(['readingLine', 'biggerText']);
      expect(window.kotlinskidevA11yRuntime?.c).toEqual([]);
    });

    it('keeps an existing runtime and its chunk records', async () => {
      const records: unknown[] = ['kept'];
      window.kotlinskidevA11yRuntime = { s: [], c: records as never };
      await loadBootstrap('local');
      expect(window.kotlinskidevA11yRuntime?.c).toBe(records);
    });

    it('lists nothing without saved levels or when state is expired', async () => {
      localStorage.setItem(KEY, state());
      await loadBootstrap('local');
      expect(window.kotlinskidevA11yRuntime?.s).toEqual([]);
      localStorage.setItem(KEY, state({ exp: Date.now() - 1, levels: { readingLine: true } }));
      await loadBootstrap('local');
      expect(window.kotlinskidevA11yRuntime?.s).toEqual([]);
    });
  });

  describe('page css', () => {
    it('writes a parser-inserted link while the document is loading', async () => {
      setReadyState('loading');
      const write = jest.spyOn(document, 'write').mockImplementation(() => undefined);
      localStorage.setItem(KEY, withLevels({ readingLine: true }));
      await loadBootstrap('local', { css: CSS_URL });
      expect(write).toHaveBeenCalledTimes(1);
      expect(write).toHaveBeenCalledWith(`<link rel="stylesheet" id="kotlinskidev-a11y-frontend-css" href="${CSS_URL}">`);
      expect(document.getElementById('kotlinskidev-a11y-frontend-css')).toBeNull();
    });

    it('appends a link element once the document has been parsed', async () => {
      const write = jest.spyOn(document, 'write').mockImplementation(() => undefined);
      localStorage.setItem(KEY, withLevels({ readingLine: true }));
      await loadBootstrap('local', { css: CSS_URL });
      const link = document.getElementById('kotlinskidev-a11y-frontend-css') as HTMLLinkElement;
      expect(write).not.toHaveBeenCalled();
      expect(link.rel).toBe('stylesheet');
      expect(link.getAttribute('href')).toBe(CSS_URL);
      expect(link.parentElement).toBe(document.head);
    });

    it('escapes quotes and angle brackets in the document.write link', async () => {
      setReadyState('loading');
      const write = jest.spyOn(document, 'write').mockImplementation(() => undefined);
      localStorage.setItem(KEY, withLevels({ readingLine: true }));
      await loadBootstrap('local', { css: 'https://x.test/a.css?"><script>alert(1)</script>' });
      const html = write.mock.calls[0]?.[0] as string;
      expect(html).toContain('href="https://x.test/a.css?&quot;');
      expect(html.match(/"/g)).toHaveLength(6);
    });

    it('keeps markup out of the appended link', async () => {
      localStorage.setItem(KEY, withLevels({ readingLine: true }));
      await loadBootstrap('local', { css: 'https://x.test/a.css?"><b>' });
      expect(document.head.querySelector('b')).toBeNull();
      expect(document.getElementById('kotlinskidev-a11y-frontend-css')).not.toBeNull();
    });

    it('adds no stylesheet when css is null, absent, or no feature is active', async () => {
      localStorage.setItem(KEY, withLevels({ readingLine: true }));
      await loadBootstrap('local', { css: null });
      await loadBootstrap('local');
      localStorage.setItem(KEY, state());
      await loadBootstrap('local', { css: CSS_URL });
      expect(document.getElementById('kotlinskidev-a11y-frontend-css')).toBeNull();
    });
  });

  describe('hidden toolbar flag', () => {
    it('sets the attribute from sessionStorage', async () => {
      sessionStorage.setItem(`${KEY}-hidden`, '1');
      await loadBootstrap('local');
      expect(document.documentElement.hasAttribute('data-ka11y-hidden')).toBe(true);
    });

    it('sets the attribute from a future localStorage expiry only', async () => {
      localStorage.setItem(`${KEY}-hidden`, String(Date.now() + 60000));
      await loadBootstrap('local');
      expect(document.documentElement.hasAttribute('data-ka11y-hidden')).toBe(true);
      document.documentElement.removeAttribute('data-ka11y-hidden');
      localStorage.setItem(`${KEY}-hidden`, String(Date.now() - 1));
      await loadBootstrap('local');
      expect(document.documentElement.hasAttribute('data-ka11y-hidden')).toBe(false);
    });

    it('uses the configured hk key', async () => {
      sessionStorage.setItem('custom-hidden', '1');
      await loadBootstrap('local', { hk: 'custom-hidden' });
      expect(document.documentElement.hasAttribute('data-ka11y-hidden')).toBe(true);
    });

    it('is left unset by default', async () => {
      await loadBootstrap('local');
      expect(document.documentElement.hasAttribute('data-ka11y-hidden')).toBe(false);
    });
  });

  describe('off url', () => {
    it('hides the inert launcher and installs no click capture', async () => {
      window.history.replaceState({}, '', '/?ka11y=off');
      await loadBootstrap('local');
      expect(document.documentElement.hasAttribute('data-ka11y-hidden')).toBe(true);
      expect(window.kotlinskidevA11yRuntime?.e).toBeUndefined();
    });
  });

  describe('early click capture', () => {
    const mountHost = (): HTMLElement => {
      const host = document.createElement('div');
      host.id = 'ka11y-root';
      host.innerHTML = '<span class="inner"></span>';
      document.body.append(host);
      return host;
    };

    it('queues open for a click on the host and stores the listener', async () => {
      await loadBootstrap('local');
      const host = mountHost();
      host.querySelector('.inner')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      expect(window.kotlinskidevA11yQueue).toEqual([{ action: 'open', source: 'early' }]);
      expect(typeof window.kotlinskidevA11yRuntime?.e).toBe('function');
    });

    it('prevents default and queues open for the hash anchor', async () => {
      await loadBootstrap('local');
      const anchor = document.createElement('a');
      anchor.href = '#kotlinskidev-a11y';
      document.body.append(anchor);
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      anchor.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      expect(window.kotlinskidevA11yQueue).toEqual([{ action: 'open', source: 'early' }]);
      anchor.remove();
    });

    it('ignores unrelated clicks and appends to an existing queue', async () => {
      window.kotlinskidevA11yQueue = [{ action: 'close' }];
      await loadBootstrap('local');
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(window.kotlinskidevA11yQueue).toEqual([{ action: 'close' }]);
      mountHost().dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(window.kotlinskidevA11yQueue).toEqual([{ action: 'close' }, { action: 'open', source: 'early' }]);
    });

    it('stops capturing once the loader removes the listener', async () => {
      await loadBootstrap('local');
      const listener = window.kotlinskidevA11yRuntime?.e as (event: MouseEvent) => void;
      document.removeEventListener('click', listener, true);
      mountHost().dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(window.kotlinskidevA11yQueue).toBeUndefined();
    });
  });
});
