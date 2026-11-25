import { bootKernel, type KernelBootOptions } from '../../src/ts/frontend/kernel';
import type { FeatureModule } from '../../src/ts/frontend/apply';
import { unregisterFeature } from '../../src/ts/frontend/apply';
import type { GroupName, InlineConfig, KotlinskidevA11yConfig, PanelData } from '../../src/ts/shared/types';
import { createConfig } from './helpers';

const inline = (overrides: Partial<InlineConfig> = {}): InlineConfig => ({
  v: '0.2.0',
  locale: 'en_US',
  rtl: false,
  storage: { mode: 'local', ttlDays: 365, key: 'ka11y-test' },
  shortcut: { enabled: true, combo: 'Alt+Shift+A', parsed: null },
  load: { strategy: 'interaction', prefetch: 'hover', pageCss: 'lazy', deviceSkip: true },
  hiddenMedia: '',
  chunks: {
    base: 'https://example.test/build/',
    ver: { kernel: '1', panel: '1', content: '1', color: '1', orientation: '1', page: 'p1' },
  },
  data: [],
  strings: { open: 'Open' },
  advanced: { excludeSelectors: '' },
  assets: { dyslexicFontUrl: '' },
  ...overrides,
});

const GROUPS: Record<string, GroupName> = { biggerText: 'content', darkContrast: 'color', readingLine: 'orientation' };

const boot = (config: InlineConfig = inline()) => {
  const loadGroup = jest.fn((): Promise<void> => Promise.resolve());
  const options: KernelBootOptions = { config, groupOf: (key) => GROUPS[key] ?? null, loadGroup };
  return { kernel: bootKernel(options), loadGroup };
};

const panelData = (): PanelData => {
  const config = createConfig();
  return {
    hash: 'abcdef012345',
    locale: 'en_US',
    features: config.features,
    profiles: config.profiles,
    widget: config.widget,
    theme: config.theme,
    tokens: config.tokens,
    hideToolbar: config.hideToolbar,
    statementUrl: 'https://example.test/s',
    customCss: '.y{}',
    strings: { panelTitle: 'Title' },
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

describe('kernel', () => {
  beforeEach(() => {
    localStorage.clear();
    document.head.innerHTML = '';
    document.documentElement.className = '';
    document.documentElement.removeAttribute('style');
    window.kotlinskidevA11y = { strings: { open: 'Open' } } as unknown as KotlinskidevA11yConfig;
  });

  it('restores the store from saved state', () => {
    const state = { classes: ['ka11y-highlight-links'], vars: {}, levels: { highlightLinks: true }, exp: Date.now() + 100000 };
    localStorage.setItem('ka11y-test', JSON.stringify(state));
    const { kernel } = boot();
    expect(kernel.store.getState().levels).toEqual({ highlightLinks: true });
  });

  it('loads a group once on first activation of one of its keys', () => {
    const { kernel, loadGroup } = boot();
    kernel.store.setLevel('biggerText', 1);
    kernel.store.setLevel('biggerText', 2);
    kernel.store.setLevel('darkContrast', true);
    expect(loadGroup).toHaveBeenCalledTimes(2);
    expect(loadGroup).toHaveBeenNthCalledWith(1, 'content');
    expect(loadGroup).toHaveBeenNthCalledWith(2, 'color');
  });

  it('does not load a group for keys outside any group', () => {
    const { kernel, loadGroup } = boot();
    kernel.store.setLevel('highlightLinks', true);
    expect(loadGroup).not.toHaveBeenCalled();
  });

  it('retries a group after loadGroup rejected', async () => {
    const loadGroup = jest.fn((): Promise<void> => Promise.reject(new Error('x')));
    const kernel = bootKernel({ config: inline(), groupOf: (key) => GROUPS[key] ?? null, loadGroup });
    kernel.store.setLevel('biggerText', 1);
    await Promise.resolve();
    await Promise.resolve();
    kernel.store.setLevel('biggerText', 0);
    kernel.store.setLevel('biggerText', 1);
    expect(loadGroup).toHaveBeenCalledTimes(2);
  });

  it('ensurePageCss appends one link in lazy mode', () => {
    const { kernel } = boot();
    kernel.ensurePageCss();
    kernel.ensurePageCss();
    const links = document.head.querySelectorAll('link#kotlinskidev-a11y-frontend-css');
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute('href')).toBe('https://example.test/build/frontend.css?ver=p1');
  });

  it('ensurePageCss is a no-op outside lazy mode', () => {
    const { kernel } = boot(inline({ load: { strategy: 'interaction', prefetch: 'hover', pageCss: 'linked', deviceSkip: true } }));
    kernel.ensurePageCss();
    expect(document.head.querySelector('link')).toBeNull();
  });

  it('adds the page css when the store gets its first ka11y class', () => {
    const { kernel } = boot();
    expect(document.head.querySelector('link')).toBeNull();
    kernel.store.setLevel('highlightLinks', true);
    expect(document.head.querySelector('link#kotlinskidev-a11y-frontend-css')).not.toBeNull();
  });

  it('attachData creates profiles', () => {
    const { kernel } = boot();
    expect(kernel.profiles()).toBeNull();
    kernel.attachData(panelData());
    expect(kernel.profiles()?.keys()).toEqual(['visionImpaired']);
  });

  it('addFeatures registers modules, runs init and syncs the applier', () => {
    const on = jest.fn();
    const off = jest.fn();
    const module: FeatureModule = { key: 'kernelTestFeature', on, off };
    const { kernel } = boot();
    kernel.store.setLevel('kernelTestFeature', true);
    const init = jest.fn();
    kernel.addFeatures({ features: [module], init });
    expect(init).toHaveBeenCalledWith(kernel);
    expect(on).toHaveBeenCalledWith(true);
    unregisterFeature('kernelTestFeature');
  });

  it('exposes run and state, and drops feature commands without panel data', async () => {
    const { kernel } = boot();
    expect(kernel.state()).toEqual({ api: 1, open: false, profile: null, features: {} });
    await kernel.run({ action: 'feature:biggerText', source: 'api' });
    expect(kernel.state().features).toEqual({});
    await kernel.run({ action: 'reset', source: 'api' });
    expect(kernel.state().features).toEqual({});
  });
});
