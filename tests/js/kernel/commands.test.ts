import { bootKernel, type KernelApi } from '../../../src/ts/frontend/kernel';
import type { GroupName, InlineConfig, KA11yCommand, PanelData } from '../../../src/ts/shared/types';
import { createConfig, feature } from '../helpers';

const inline = (): InlineConfig =>
  ({
    v: '0.2.0',
    locale: 'en_US',
    rtl: false,
    storage: { mode: 'local', ttlDays: 365, key: 'ka11y-cmd' },
    shortcut: { enabled: true, combo: 'Alt+Shift+A', parsed: null },
    load: { strategy: 'interaction', prefetch: 'hover', pageCss: 'linked', deviceSkip: true },
    hiddenMedia: '',
    chunks: { base: 'https://example.test/build/', ver: { kernel: '1', panel: '1', content: '1', color: '1', orientation: '1', page: 'p1' } },
    data: [],
    strings: {},
    advanced: { excludeSelectors: '' },
    assets: { dyslexicFontUrl: '' },
  }) as InlineConfig;

const panelData = (): PanelData => {
  const config = createConfig();
  return {
    hash: 'abcdef012345',
    locale: 'en_US',
    features: { ...config.features, darkContrast: feature() },
    profiles: config.profiles,
    widget: config.widget,
    theme: config.theme,
    tokens: config.tokens,
    hideToolbar: config.hideToolbar,
    statementUrl: '',
    customCss: '',
    strings: {},
    panel: {
      columns: 3,
      sections: { profiles: true, content: true, color: true, orientation: true, skip: true },
      languageSwitcher: true,
    },
    layout: { sheetQuery: '(max-width:768px)' },
    locales: [],
    icons: {},
  };
};

const GROUPS: Record<string, GroupName> = {};

const boot = (): { kernel: KernelApi; getData: jest.Mock } => {
  const getData = jest.fn(() => Promise.resolve(panelData()));
  const kernel = bootKernel({ config: inline(), groupOf: (key) => GROUPS[key] ?? null, loadGroup: () => Promise.resolve(), getData });
  return { kernel, getData };
};

const cmd = (action: string, source: KA11yCommand['source'] = 'api'): KA11yCommand => ({ action, source });

const stored = (): unknown => JSON.parse(localStorage.getItem('ka11y-cmd') ?? 'null');

const collect = (): { events: CustomEvent[]; stop(): void } => {
  const events: CustomEvent[] = [];
  const handler = (event: Event): void => void events.push(event as CustomEvent);
  document.addEventListener('ka11y:change', handler);
  return { events, stop: () => document.removeEventListener('ka11y:change', handler) };
};

describe('kernel commands', () => {
  beforeEach(() => {
    localStorage.clear();
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    document.documentElement.className = '';
    document.documentElement.removeAttribute('style');
    window.kotlinskidevA11y = { strings: {} } as never;
  });

  it('toggles a feature on and off', async () => {
    const { kernel } = boot();
    await kernel.run(cmd('feature:highlightLinks'));
    expect(kernel.state().features).toEqual({ highlightLinks: 1 });
    await kernel.run(cmd('feature:highlightLinks'));
    expect(kernel.state().features).toEqual({});
  });

  it('sets a level and clamps it to the level count', async () => {
    const { kernel } = boot();
    await kernel.run(cmd('feature:biggerText:2'));
    expect(kernel.state().features).toEqual({ biggerText: 2 });
    await kernel.run(cmd('feature:biggerText:99'));
    expect(kernel.state().features.biggerText).toBeGreaterThanOrEqual(2);
    await kernel.run(cmd('feature:biggerText:0'));
    expect(kernel.state().features).toEqual({});
  });

  it('drops disabled, unknown and prototype keys without events', async () => {
    const { kernel } = boot();
    const seen = collect();
    await kernel.run(cmd('feature:hideImages'));
    await kernel.run(cmd('feature:nothing'));
    await kernel.run(cmd('feature:__proto__'));
    await kernel.run(cmd('feature:constructor'));
    await kernel.run(cmd('profile:toString'));
    await kernel.run(cmd('profile:unknown'));
    seen.stop();
    expect(kernel.state().features).toEqual({});
    expect(seen.events).toHaveLength(0);
  });

  it('toggles a profile and applies it from a url without toggling off', async () => {
    const { kernel } = boot();
    await kernel.run(cmd('profile:visionImpaired'));
    expect(kernel.state().profile).toBe('visionImpaired');
    await kernel.run(cmd('profile:visionImpaired'));
    expect(kernel.state().profile).toBeNull();
    await kernel.run(cmd('profile:visionImpaired', 'url'));
    await kernel.run(cmd('profile:visionImpaired', 'url'));
    expect(kernel.state().profile).toBe('visionImpaired');
  });

  it('loads panel data once through getData', async () => {
    const { kernel, getData } = boot();
    await kernel.run(cmd('feature:highlightLinks'));
    await kernel.run(cmd('profile:visionImpaired'));
    expect(getData).toHaveBeenCalledTimes(1);
  });

  it('resets state and clears storage', async () => {
    const { kernel } = boot();
    await kernel.run(cmd('feature:highlightLinks'));
    expect(stored()).not.toBeNull();
    await kernel.run(cmd('reset'));
    expect(kernel.state().features).toEqual({});
    expect(stored()).toBeNull();
  });

  it('does not save url commands and saves the full state on the next other change', async () => {
    const { kernel } = boot();
    await kernel.run(cmd('profile:visionImpaired', 'url'));
    expect(kernel.state().profile).toBe('visionImpaired');
    expect(stored()).toBeNull();
    kernel.store.setLevel('saturation', true);
    const saved = stored() as { levels: Record<string, unknown>; profile: string };
    expect(saved.profile).toBe('visionImpaired');
    expect(Object.keys(saved.levels).sort()).toEqual(['biggerText', 'highlightLinks', 'saturation']);
  });

  it('saves api commands immediately', async () => {
    const { kernel } = boot();
    await kernel.run(cmd('feature:highlightLinks', 'api'));
    expect(stored()).not.toBeNull();
  });

  it('fires ka11y:change with state and source', async () => {
    const { kernel } = boot();
    const seen = collect();
    await kernel.run(cmd('feature:highlightLinks', 'trigger'));
    kernel.store.setLevel('saturation', true);
    seen.stop();
    expect(seen.events[0]?.detail).toEqual({ state: { api: 1, open: false, profile: null, features: { highlightLinks: 1 } }, source: 'trigger' });
    expect(seen.events[1]?.detail.source).toBe('panel');
  });

  it('fires ka11y:change with source restore at boot', () => {
    localStorage.setItem('ka11y-cmd', JSON.stringify({ classes: ['ka11y-highlight-links'], vars: {}, levels: { highlightLinks: true }, exp: Date.now() + 100000 }));
    const seen = collect();
    boot();
    seen.stop();
    expect(seen.events).toHaveLength(1);
    expect(seen.events[0]?.detail).toEqual({ state: { api: 1, open: false, profile: null, features: { highlightLinks: 1 } }, source: 'restore' });
  });

  it('syncs aria-pressed for key, key with level and profile triggers', async () => {
    document.body.innerHTML =
      '<button data-ka11y="feature:biggerText" id="a"></button><button data-ka11y="feature:biggerText:2" id="b"></button><button data-ka11y="feature:biggerText:1" id="c"></button><a href="#ka11y/profile:visionImpaired" id="d"></a><button data-ka11y="open" id="e"></button>';
    const { kernel } = boot();
    await kernel.run(cmd('feature:biggerText:2'));
    const pressed = (id: string): string | null => document.getElementById(id)?.getAttribute('aria-pressed') ?? null;
    expect([pressed('a'), pressed('b'), pressed('c'), pressed('d'), pressed('e')]).toEqual(['true', 'true', 'false', 'false', null]);
    await kernel.run(cmd('profile:visionImpaired'));
    expect(pressed('d')).toBe('true');
  });

  it('reports public state with true as 1', () => {
    const { kernel } = boot();
    kernel.store.setLevel('highlightLinks', true);
    kernel.store.setLevel('biggerText', 3);
    kernel.store.set({ open: true });
    expect(kernel.state()).toEqual({ api: 1, open: true, profile: null, features: { highlightLinks: 1, biggerText: 3 } });
  });

  it('exposes the panel data after ensureData and fetches it only once', async () => {
    const { kernel, getData } = boot();
    expect(kernel.data()).toBeNull();
    await kernel.ensureData();
    await kernel.ensureData();
    expect(kernel.data()?.hash).toBe(panelData().hash);
    expect(getData).toHaveBeenCalledTimes(1);
  });
});
