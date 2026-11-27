import { createThemeResolver } from '../../src/ts/frontend/theme';
import type { ThemeConfig } from '../../src/ts/shared/types';

const baseConfig: ThemeConfig = {
  mode: 'auto',
  darkSelector: 'html.dark, html.dark-mode, html[data-theme="dark"], body.dark, body.dark-mode',
  lightSelector: 'html.light, html.light-mode, html[data-theme="light"], body.light, body.light-mode',
  followPrefersColorScheme: true,
};

type Listener = () => void;

const mockMatchMedia = (initial: boolean) => {
  const listeners = new Set<Listener>();
  const query = {
    matches: initial,
    addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
  };
  window.matchMedia = jest.fn().mockReturnValue(query);
  return {
    set: (value: boolean) => {
      query.matches = value;
      listeners.forEach((listener) => listener());
    },
  };
};

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('theme', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    document.body.className = '';
  });

  it('uses fixed modes without looking at the page', () => {
    mockMatchMedia(true);
    const host = document.createElement('div');
    expect(createThemeResolver({ host, config: { ...baseConfig, mode: 'light' } }).resolve()).toBe('light');
    expect(host.dataset.theme).toBe('light');
    expect(createThemeResolver({ host, config: { ...baseConfig, mode: 'dark' } }).resolve()).toBe('dark');
    expect(host.dataset.theme).toBe('dark');
  });

  it('follows prefers-color-scheme and reacts to changes', () => {
    const media = mockMatchMedia(false);
    const host = document.createElement('div');
    createThemeResolver({ host, config: baseConfig });
    expect(host.dataset.theme).toBe('light');
    media.set(true);
    expect(host.dataset.theme).toBe('dark');
  });

  it('ignores prefers-color-scheme when disabled', () => {
    mockMatchMedia(true);
    const host = document.createElement('div');
    createThemeResolver({ host, config: { ...baseConfig, followPrefersColorScheme: false } });
    expect(host.dataset.theme).toBe('light');
  });

  it('class selectors beat the media query', () => {
    mockMatchMedia(true);
    document.documentElement.classList.add('light-mode');
    const host = document.createElement('div');
    createThemeResolver({ host, config: baseConfig });
    expect(host.dataset.theme).toBe('light');
  });

  it('reacts to html and body class changes', async () => {
    mockMatchMedia(false);
    const host = document.createElement('div');
    createThemeResolver({ host, config: baseConfig });
    document.documentElement.classList.add('dark-mode');
    await flush();
    expect(host.dataset.theme).toBe('dark');
    document.documentElement.classList.remove('dark-mode');
    document.body.classList.add('light-mode');
    await flush();
    expect(host.dataset.theme).toBe('light');
    document.body.classList.remove('light-mode');
    document.body.classList.add('dark-mode');
    await flush();
    expect(host.dataset.theme).toBe('dark');
  });

  it('survives invalid selectors and missing matchMedia', () => {
    Reflect.deleteProperty(window, 'matchMedia');
    const host = document.createElement('div');
    const resolver = createThemeResolver({ host, config: { ...baseConfig, darkSelector: '[[bad' } });
    expect(resolver.resolve()).toBe('light');
  });

  it('stops observing after destroy', async () => {
    mockMatchMedia(false);
    const host = document.createElement('div');
    const resolver = createThemeResolver({ host, config: baseConfig });
    resolver.destroy();
    document.documentElement.classList.add('dark-mode');
    await flush();
    expect(host.dataset.theme).toBe('light');
  });
});
