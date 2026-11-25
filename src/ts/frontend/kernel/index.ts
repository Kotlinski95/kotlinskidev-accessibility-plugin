import type { GroupName, InlineConfig, KA11yCommand, PanelData, PublicState } from '../../shared/types';
import { createApplier, registerFeature, type Applier, type FeatureModule } from '../apply';
import { isLevelActive } from '../feature-utils';
import { createProfiles, type Profiles } from '../profiles';
import { createStorage } from '../storage';
import { createStore, type Store, type StoreState } from '../store';
import { announceChange, hasPublicChange, publicState, runCommand, syncPressed, type ChangeSource } from './commands';

export type KernelExports = typeof import('./exports') & { bootKernel: typeof bootKernel };

export interface KernelBootOptions {
  config: InlineConfig;
  groupOf(key: string): GroupName | null;
  loadGroup(name: GroupName): Promise<void>;
  getData?(): Promise<PanelData>;
}

export interface FeatureChunk {
  features: readonly FeatureModule[];
  init?(kernel: KernelApi): void;
}

export interface KernelApi {
  store: Store;
  addFeatures(chunk: FeatureChunk): void;
  attachData(data: PanelData): void;
  profiles(): Profiles | null;
  ensurePageCss(): void;
  run(command: KA11yCommand): Promise<void>;
  state(): PublicState;
}

export const PAGE_CSS_ID = 'kotlinskidev-a11y-frontend-css';

const PAGE_CSS_FILE = 'frontend.css';

const pageCssUrl = (config: InlineConfig): string =>
  config.css ?? `${config.chunks.base}${PAGE_CSS_FILE}?ver=${encodeURIComponent(config.chunks.ver.page)}`;

const newlyActiveKeys = (state: StoreState, previous: StoreState): string[] =>
  Object.keys(state.levels).filter((key) => isLevelActive(state.levels[key]) && !isLevelActive(previous.levels[key]));

export const bootKernel = ({ config, groupOf, loadGroup, getData }: KernelBootOptions): KernelApi => {
  const store = createStore();
  const storage = createStorage(config.storage);
  const saved = storage.load();
  if (saved) store.set(saved);
  const applier: Applier = createApplier(store);
  const requestedGroups = new Set<GroupName>();
  let profiles: Profiles | null = null;
  let data: PanelData | null = null;
  let source: ChangeSource = 'panel';
  let suspended = false;

  const onStateSave = (state: StoreState): void => {
    if (suspended && source === 'url') return;
    suspended = false;
    storage.save(state);
  };

  const onPublicChange = (state: StoreState, previous: StoreState): void => {
    if (!hasPublicChange(state, previous)) return;
    syncPressed(state);
    announceChange(state, source);
  };

  const within = (next: ChangeSource, work: () => void): void => {
    source = next;
    if (next === 'url') suspended = true;
    try {
      work();
    } finally {
      source = 'panel';
    }
  };

  const ensurePageCss = (): void => {
    if (config.load.pageCss !== 'lazy' || document.getElementById(PAGE_CSS_ID)) return;
    const link = document.createElement('link');
    link.id = PAGE_CSS_ID;
    link.rel = 'stylesheet';
    link.href = pageCssUrl(config);
    document.head.append(link);
  };

  const requestGroup = (group: GroupName): void => {
    if (requestedGroups.has(group)) return;
    requestedGroups.add(group);
    const onRejected = (): void => {
      requestedGroups.delete(group);
    };
    loadGroup(group).catch(onRejected);
  };

  const onStateChange = (state: StoreState, previous: StoreState): void => {
    if (state.classes.size > 0) ensurePageCss();
    newlyActiveKeys(state, previous).forEach((key) => {
      const group = groupOf(key);
      if (group !== null) requestGroup(group);
    });
  };

  const addFeatures = (chunk: FeatureChunk): void => {
    chunk.features.forEach(registerFeature);
    chunk.init?.(api);
    applier.sync(store.getState());
  };

  const mergeLegacyConfig = (data: PanelData): void => {
    const target = window.kotlinskidevA11y;
    if (!target) return;
    const moved = {
      features: data.features,
      profiles: data.profiles,
      widget: data.widget,
      theme: data.theme,
      tokens: data.tokens,
      hideToolbar: data.hideToolbar,
      statementUrl: data.statementUrl,
      customCss: data.customCss,
    };
    Object.assign(target, moved, { strings: { ...target.strings, ...data.strings } });
  };

  const attachData = (panel: PanelData): void => {
    mergeLegacyConfig(panel);
    profiles = createProfiles(store, panel.profiles, panel.features);
    data = panel;
  };

  const loadData = async (): Promise<void> => {
    if (profiles === null && getData) attachData(await getData());
  };

  const run = (command: KA11yCommand): Promise<void> =>
    runCommand({ store, profiles: currentProfiles, features: () => data?.features ?? null, load: loadData, within }, command);

  const currentProfiles = (): Profiles | null => profiles;

  const api: KernelApi = {
    store,
    addFeatures,
    attachData,
    profiles: currentProfiles,
    ensurePageCss,
    run,
    state: () => publicState(store.getState()),
  };

  store.subscribe(onStateSave);
  store.subscribe(onStateChange);
  store.subscribe(onPublicChange);
  if (store.getState().classes.size > 0) ensurePageCss();
  if (saved) {
    syncPressed(store.getState());
    if (Object.keys(saved.levels).length > 0 || saved.profile !== null) announceChange(store.getState(), 'restore');
  }

  return api;
};
