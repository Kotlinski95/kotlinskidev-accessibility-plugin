import type { Dialog } from '../../../src/ts/frontend/a11y-dialog';
import type { ChunkName, ChunkRecord, GroupName, InlineConfig, PanelData } from '../../../src/ts/shared/types';

export const BASE = 'https://example.test/build/';

export const inlineConfig = (overrides: Partial<InlineConfig> = {}): InlineConfig => ({
  v: '0.2.0',
  locale: 'en_US',
  rtl: false,
  storage: { mode: 'local', ttlDays: 365, key: 'ka11y' },
  shortcut: {
    enabled: true,
    combo: 'Alt+Shift+A',
    parsed: { alt: true, shift: true, ctrl: false, meta: false, key: 'a', code: 'KeyA' },
  },
  load: { strategy: 'interaction', prefetch: 'hover', pageCss: 'lazy', deviceSkip: true },
  hiddenMedia: '',
  chunks: {
    base: BASE,
    ver: { kernel: 'k1', panel: 'p1', content: 'c1', color: 'o1', orientation: 'r1', page: 'g1' },
  },
  data: ['https://example.test/uploads/panel.json', 'https://example.test/rest/panel-data'],
  strings: { open: 'Open accessibility settings', loadError: 'Could not load. Try again.' },
  advanced: { excludeSelectors: '' },
  assets: { dyslexicFontUrl: '' },
  ...overrides,
});

export const GROUPS: Record<string, GroupName> = { biggerText: 'content', darkContrast: 'color', readingLine: 'orientation' };

export const panelData = (): PanelData => ({
  hash: 'abcdef012345',
  locale: 'en_US',
  features: {},
  profiles: {},
  widget: {
    position: { desktop: 'bottom-right', tablet: 'bottom-right', mobile: 'bottom-right' },
    offsetX: { desktop: 0, tablet: 0, mobile: 0 },
    offsetY: { desktop: 0, tablet: 0, mobile: 0 },
    size: 'md',
    icon: '',
    iconBorder: false,
  },
  theme: { mode: 'auto', darkSelector: '', lightSelector: '', followPrefersColorScheme: true },
  tokens: {
    primary: '#000',
    onPrimary: '#fff',
    primaryDark: '#fff',
    onPrimaryDark: '#000',
    headerBg: '#000',
    onHeader: '#fff',
    canvasLight: '#fff',
    canvasDark: '#000',
    surfaceLight: '#fff',
    surfaceDark: '#000',
    textLight: '#000',
    textDark: '#fff',
    radius: '4px',
    zIndex: 1,
    fontFamily: 'sans-serif',
  },
  hideToolbar: { allow: true, days: [1] },
  statementUrl: '',
  customCss: '',
  strings: { panelTitle: 'Accessibility' },
  panel: {
    columns: 3,
    sections: { profiles: true, content: true, color: true, orientation: true, skip: true },
    languageSwitcher: true,
  },
  layout: { sheetQuery: '(max-width:768px)' },
  locales: [],
  icons: {},
});

export const jsonResponse = (body: unknown, ok = true): Response =>
  ({ ok, status: ok ? 200 : 404, json: () => Promise.resolve(body) }) as unknown as Response;

export const flush = async (): Promise<void> => {
  for (let index = 0; index < 100; index += 1) await Promise.resolve();
};

export interface Fakes {
  dialog: jest.Mocked<Dialog>;
  kernelApi: { store: object; addFeatures: jest.Mock; ensurePageCss: jest.Mock };
  bootKernel: jest.Mock;
  mount: jest.Mock;
  kernelRecord: ChunkRecord;
  panelRecord: ChunkRecord;
  groupRecord(name: GroupName): ChunkRecord;
}

export const createFakes = (): Fakes => {
  const dialog = { open: jest.fn(), close: jest.fn(), toggle: jest.fn(), isOpen: jest.fn(), destroy: jest.fn() };
  const kernelApi = { store: {}, addFeatures: jest.fn(), ensurePageCss: jest.fn() };
  const bootKernel = jest.fn(() => kernelApi);
  const mount = jest.fn(() => ({ dialog }));
  const record = (name: ChunkName, exported: unknown): ChunkRecord => [name, 1, () => exported];
  return {
    dialog,
    kernelApi,
    bootKernel,
    mount,
    kernelRecord: record('kernel', { bootKernel }),
    panelRecord: record('panel', { mount }),
    groupRecord: (name) => record(name, { features: [] }),
  };
};

export interface Env {
  scripts: HTMLScriptElement[];
  deliver(script: HTMLScriptElement, ...records: ChunkRecord[]): void;
  deliverByName(name: string, ...records: ChunkRecord[]): HTMLScriptElement;
  fail(script: HTMLScriptElement): void;
  dispose(): void;
}

export const createEnv = (): Env => {
  const scripts: HTMLScriptElement[] = [];
  const append = jest.spyOn(document.head, 'append').mockImplementation((...nodes: (Node | string)[]) => {
    nodes.forEach((node) => {
      if (node instanceof HTMLScriptElement) scripts.push(node);
    });
  });
  const tracked: Array<[EventTarget, string, EventListenerOrEventListenerObject, boolean | AddEventListenerOptions | undefined]> = [];
  const targets: EventTarget[] = [document, window];
  const originals = targets.map((target) => target.addEventListener);
  targets.forEach((target) => {
    const original = target.addEventListener.bind(target);
    target.addEventListener = (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void => {
      tracked.push([target, type, listener, options]);
      original(type, listener, options);
    };
  });

  const deliver = (script: HTMLScriptElement, ...records: ChunkRecord[]): void => {
    const runtime = window.kotlinskidevA11yRuntime;
    if (runtime) runtime.c.push(...records);
    script.onload?.(new Event('load'));
  };

  const deliverByName = (name: string, ...records: ChunkRecord[]): HTMLScriptElement => {
    const script = scripts.find((candidate) => candidate.src.includes(`/${name}.js`));
    if (!script) throw new Error(`no script for ${name}`);
    deliver(script, ...records);
    return script;
  };

  const fail = (script: HTMLScriptElement): void => {
    script.onerror?.(new Event('error'));
  };

  const dispose = (): void => {
    tracked.forEach(([target, type, listener, options]) => target.removeEventListener(type, listener, options));
    targets.forEach((target, index) => {
      target.addEventListener = originals[index] as typeof target.addEventListener;
    });
    append.mockRestore();
    delete window.kotlinskidevA11y;
    delete window.kotlinskidevA11yOff;
    delete window.kotlinskidevA11yRuntime;
    delete window.kotlinskidevA11yQueue;
    delete (globalThis as unknown as { fetch?: unknown }).fetch;
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('data-ka11y-hidden');
    history.replaceState(null, '', '/');
    sessionStorage.clear();
    localStorage.clear();
    jest.useRealTimers();
    jest.restoreAllMocks();
  };

  return { scripts, deliver, deliverByName, fail, dispose };
};

export const mountHost = (withShadow = true): HTMLElement => {
  const host = document.createElement('div');
  host.id = 'ka11y-root';
  const launcher = document.createElement('button');
  launcher.className = 'ka11y-launcher';
  launcher.setAttribute('aria-label', 'Open accessibility settings');
  if (withShadow) {
    host.attachShadow({ mode: 'open' }).append(launcher);
  } else {
    const template = document.createElement('template');
    template.content.append(launcher);
    host.append(template);
  }
  document.body.append(host);
  return host;
};

export const configure = (config: InlineConfig): void => {
  window.kotlinskidevA11y = config as unknown as typeof window.kotlinskidevA11y;
};

export const stubFetch = (implementation: (url: string) => Promise<Response>): jest.Mock => {
  const mock = jest.fn(implementation);
  (globalThis as unknown as { fetch: unknown }).fetch = mock;
  return mock;
};
