import type { Api } from '../../../src/ts/admin/api';
import type { FormContext } from '../../../src/ts/admin/context';
import { createNotices } from '../../../src/ts/admin/notices';
import { createFormState } from '../../../src/ts/admin/state';
import type { AdminConfig, DefinitionMap, FieldDefinition, SchemaPayload, SettingsTree } from '../../../src/ts/admin/types';

export const FEATURES = [
  'biggerText',
  'lineHeight',
  'letterSpacing',
  'fontWeight',
  'readableFont',
  'dyslexicFont',
  'textAlign',
  'highlightLinks',
  'bigCursor',
  'textMagnifier',
  'cognitiveReading',
  'darkContrast',
  'lightContrast',
  'highContrast',
  'monochrome',
  'saturation',
  'readingLine',
  'readingMask',
  'readPage',
  'keyboardNavigation',
  'hideImages',
  'muteSounds',
  'highlightTitles',
  'highlightAll',
  'stopAnimations',
  'skipToContent',
];

export const PROFILES = ['visionImpaired', 'seizureSafe'];

export const OPTIMIZERS = ['cloudflare', 'wp-rocket', 'litespeed', 'jetpack-boost', 'asset-cleanup'];

export const samplePresets = (): SchemaPayload['presets'] => ({
  recommended: { strategy: 'interaction', position: 'footer', fetchPriority: 'low', prefetch: 'hover', pageCss: 'lazy', deviceSkip: true, optOut: [] },
  compatibility: { strategy: 'eager', position: 'footer', fetchPriority: 'auto', prefetch: 'none', pageCss: 'linked', deviceSkip: false, optOut: OPTIMIZERS },
});

const POSITIONS = ['bottom-right', 'bottom-left', 'top-right', 'top-left', 'middle-right', 'middle-left'];
const DEVICES = ['desktop', 'tablet', 'mobile'];

const definition = (type: string, sanitize: string, fallback: unknown, extra: Partial<FieldDefinition> = {}): FieldDefinition => ({
  type,
  sanitize,
  default: fallback,
  ...extra,
});

const assign = (tree: SettingsTree, path: string, value: unknown): void => {
  const segments = path.split('.');
  const last = segments.pop() as string;
  let cursor = tree;
  for (const segment of segments) {
    cursor[segment] = (cursor[segment] as SettingsTree | undefined) ?? {};
    cursor = cursor[segment] as SettingsTree;
  }
  cursor[last] = value;
};

export const sampleDefinitions = (): DefinitionMap => {
  const defs: DefinitionMap = {};
  for (const key of FEATURES) {
    defs[`features.${key}.enabled`] = definition('boolean', 'bool', true);
    defs[`features.${key}.default`] = definition('integer', 'level', false, { min: 0, max: 10 });
  }
  for (const key of PROFILES) {
    defs[`profiles.${key}.enabled`] = definition('boolean', 'bool', true);
    defs[`profiles.${key}.features`] = definition('array', 'enum_list', ['biggerText'], { enum: FEATURES });
  }
  for (const device of DEVICES) {
    defs[`widget.position.${device}`] = definition('string', 'enum', 'bottom-right', { enum: POSITIONS });
    defs[`widget.offsetX.${device}`] = definition('integer', 'int', 20, { min: 0, max: 500 });
    defs[`widget.offsetY.${device}`] = definition('integer', 'int', 20, { min: 0, max: 500 });
    defs[`visibility.devices.${device}`] = definition('boolean', 'bool', true);
  }
  defs['widget.size'] = definition('string', 'enum', 'md', { enum: ['sm', 'md', 'lg'] });
  defs['widget.icon'] = definition('string', 'icon', 'universal');
  defs['widget.iconBorder'] = definition('boolean', 'bool', false);
  defs['visibility.breakpoints.tablet'] = definition('integer', 'int', 1024, { min: 320, max: 4096 });
  defs['visibility.breakpoints.mobile'] = definition('integer', 'int', 768, { min: 320, max: 4096 });
  defs['visibility.excludePostIds'] = definition('array', 'int_list', []);
  defs['visibility.excludePostTypes'] = definition('array', 'text_list', []);
  defs['visibility.excludeRoles'] = definition('array', 'text_list', []);
  defs['visibility.excludeUrlPatterns'] = definition('array', 'text_list', []);
  defs['visibility.excludeTemplates'] = definition('array', 'text_list', []);
  defs['visibility.mode'] = definition('string', 'enum', 'everywhere', { enum: ['everywhere', 'only_on', 'except_on'] });
  defs['visibility.includePostIds'] = definition('array', 'int_list', []);
  defs['visibility.includePostTypes'] = definition('array', 'text_list', []);
  defs['visibility.includeTemplates'] = definition('array', 'text_list', []);
  defs['visibility.includeRoles'] = definition('array', 'text_list', []);
  defs['visibility.includeUrlPatterns'] = definition('array', 'text_list', []);
  defs['theme.mode'] = definition('string', 'enum', 'auto', { enum: ['auto', 'light', 'dark'] });
  defs['theme.darkSelector'] = definition('string', 'text', 'html.dark-mode');
  defs['theme.lightSelector'] = definition('string', 'text', 'html.light-mode');
  defs['theme.followPrefersColorScheme'] = definition('boolean', 'bool', true);
  const tokenDefaults: Record<string, string> = {
    primary: '#0b57d0',
    onPrimary: '#ffffff',
    primaryDark: '#7aa7ff',
    onPrimaryDark: '#0b1a33',
    headerBg: '#16181d',
    onHeader: '#ffffff',
    canvasLight: '#f2f4f7',
    canvasDark: '#101114',
    surfaceLight: '#ffffff',
    surfaceDark: '#1b1b1f',
    textLight: '#1b1b1f',
    textDark: '#f2f2f2',
  };
  for (const [token, value] of Object.entries(tokenDefaults)) defs[`tokens.${token}`] = definition('string', 'color', value);
  defs['panel.columns'] = definition('integer', 'int', 3, { min: 2, max: 3 });
  for (const section of ['profiles', 'content', 'color', 'orientation', 'skip']) defs[`panel.sections.${section}`] = definition('boolean', 'bool', true);
  defs['panel.languageSwitcher'] = definition('boolean', 'bool', true);
  defs['panel.preset'] = definition('string', 'enum', 'classic', { enum: ['classic', 'brand', 'soft', 'contrast', 'custom'] });
  defs['tokens.radius'] = definition('string', 'length', '12px');
  defs['tokens.zIndex'] = definition('integer', 'int', 2147483000, { min: 0, max: 2147483647 });
  defs['tokens.fontFamily'] = definition('string', 'text', 'inherit');
  defs.customCss = definition('string', 'css', '');
  defs['storage.mode'] = definition('string', 'enum', 'local', { enum: ['local', 'cookie', 'none'] });
  defs['storage.ttlDays'] = definition('integer', 'int', 365, { min: 1, max: 3650 });
  defs['storage.key'] = definition('string', 'key', 'ka11y');
  defs['statement.pageId'] = definition('integer', 'int', 0, { min: 0, max: 9999999 });
  defs['statement.url'] = definition('string', 'url', '');
  defs['statement.content'] = definition('object', 'html_map', {});
  defs['shortcut.enabled'] = definition('boolean', 'bool', true);
  defs['shortcut.combo'] = definition('string', 'combo', 'Alt+Shift+A');
  defs['hideToolbar.allow'] = definition('boolean', 'bool', true);
  defs['hideToolbar.days'] = definition('array', 'int_list', [1, 7, 30]);
  defs.labels = definition('object', 'label_map', {});
  defs['advanced.excludeSelectors'] = definition('string', 'text', '#wpadminbar');
  defs['widget.launcher'] = definition('string', 'enum', 'floating', { enum: ['floating', 'inline', 'hidden'] });
  defs['widget.mount'] = definition('string', 'selector', '');
  defs['triggers.selectors'] = definition('array', 'selector_list', [], { max: 10 });
  defs['triggers.urlActions'] = definition('array', 'enum_list', ['open', 'feature', 'profile'], { enum: ['open', 'feature', 'profile'] });
  defs['performance.preset'] = definition('string', 'enum', 'recommended', { enum: ['recommended', 'compatibility', 'custom'] });
  defs['performance.strategy'] = definition('string', 'enum', 'interaction', {
    enum: ['interaction', 'idle', 'defer', 'async', 'eager'],
  });
  defs['performance.position'] = definition('string', 'enum', 'footer', { enum: ['head', 'footer'] });
  defs['performance.fetchPriority'] = definition('string', 'enum', 'low', { enum: ['low', 'auto', 'high'] });
  defs['performance.prefetch'] = definition('string', 'enum', 'hover', { enum: ['none', 'hover', 'idle'] });
  defs['performance.pageCss'] = definition('string', 'enum', 'lazy', { enum: ['lazy', 'linked', 'inline'] });
  defs['performance.deviceSkip'] = definition('boolean', 'bool', true);
  defs['performance.optOut'] = definition('array', 'enum_list', [], { enum: OPTIMIZERS });
  return defs;
};

export const sampleDefaults = (): SettingsTree => {
  const tree: SettingsTree = {};
  for (const [path, def] of Object.entries(sampleDefinitions())) assign(tree, path, def.default);
  return tree;
};

export const sampleSchema = (): SchemaPayload => ({
  version: 1,
  definitions: sampleDefinitions(),
  defaults: sampleDefaults(),
  features: FEATURES,
  profiles: PROFILES,
  presets: samplePresets(),
});

export const sampleCost = (): AdminConfig['cost'] => ({
  manifest: {
    scripts: {
      loader: { file: 'loader.js', ver: '1', raw: 3000, gzip: 1000 },
      kernel: { file: 'kernel.js', ver: '1', raw: 6000, gzip: 2000 },
      panel: { file: 'panel.js', ver: '1', raw: 9000, gzip: 3000 },
      content: { file: 'content.js', ver: '1', raw: 3000, gzip: 1000 },
      color: { file: 'color.js', ver: '1', raw: 1500, gzip: 500 },
      orientation: { file: 'orientation.js', ver: '1', raw: 600, gzip: 200 },
    },
    styles: {
      page: { file: 'frontend.css', ver: '1', raw: 6000, gzip: 1500 },
      launcher: { file: 'launcher.css', ver: '1', raw: 1200, gzip: 400 },
    },
    inline: { bootstrap: { file: 'bootstrap.js', ver: '1', raw: 600, gzip: 300 } },
  },
  panelData: 2500,
  config: 800,
});

export const sampleConfig = (): AdminConfig => ({
  restRoot: 'https://example.test/wp-json/kotlinskidev-a11y/v1/',
  nonce: 'nonce',
  strings: {
    'features.biggerText.label': 'Bigger text',
    'profiles.visionImpaired': 'Vision impaired',
    panelTitle: 'Accessibility settings',
    open: 'Open accessibility settings',
    levelLow: 'Low',
    levelMedium: 'Medium',
    levelHigh: 'High',
  },
  locales: [
    { code: 'en_US', name: 'English' },
    { code: 'pl_PL', name: 'Polski' },
  ],
  profiles: PROFILES,
  features: FEATURES,
  version: '0.1.0',
  homeUrl: 'https://example.test/',
  cost: sampleCost(),
});

export const fakeApi = (overrides: Partial<Api> = {}): Api => ({
  getSettings: jest.fn().mockResolvedValue(sampleDefaults()),
  saveSettings: jest.fn().mockImplementation((settings: SettingsTree) => Promise.resolve(settings)),
  getSchema: jest.fn().mockResolvedValue(sampleSchema()),
  exportSettings: jest.fn().mockResolvedValue(sampleDefaults()),
  importSettings: jest.fn().mockImplementation((settings: SettingsTree) => Promise.resolve(settings)),
  resetSettings: jest.fn().mockResolvedValue(sampleDefaults()),
  ...overrides,
});

export const sampleContext = (settings: SettingsTree = sampleDefaults(), api: Api = fakeApi()): FormContext => ({
  state: createFormState(settings),
  schema: sampleSchema(),
  config: sampleConfig(),
  api,
  notices: createNotices(),
  reload: jest.fn(),
});

export const change = (element: HTMLElement, type: 'input' | 'change' = 'input'): void => {
  element.dispatchEvent(new Event(type, { bubbles: true }));
};

export const press = (element: HTMLElement, key: string, init: KeyboardEventInit = {}): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  element.dispatchEvent(event);
  return event;
};

export const at = <T>(list: ArrayLike<T>, index: number): T => {
  const item = list[index];
  if (item === undefined) throw new Error(`Missing item at ${index}`);
  return item;
};
