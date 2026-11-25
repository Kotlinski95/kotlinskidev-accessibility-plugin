import type { CommandSource, FeatureConfig, FeatureLevel, KA11yCommand, PublicState } from '../../shared/types';
import { parseAction } from '../../shared/actions';
import { levelCountOf } from '../feature-groups';
import { isLevelActive } from '../feature-utils';
import type { Profiles } from '../profiles';
import type { Store, StoreState } from '../store';

export type ChangeSource = CommandSource | 'panel' | 'restore';

export interface CommandDeps {
  store: Store;
  profiles(): Profiles | null;
  features(): Record<string, FeatureConfig> | null;
  load(): Promise<void>;
  within(source: ChangeSource, work: () => void): void;
}

const TRIGGER_SELECTOR = '[data-ka11y]:not(html),a[href^="#ka11y/"]';

const HASH_PREFIX_LENGTH = 7;

export const publicState = (state: StoreState): PublicState => ({
  api: 1,
  open: state.open,
  profile: state.profile,
  features: Object.fromEntries(
    Object.entries(state.levels)
      .filter(([, level]) => isLevelActive(level))
      .map(([key, level]) => [key, level === true ? 1 : (level as number)])
  ),
});

const triggerAction = (element: Element): string => {
  const href = element.getAttribute('href') ?? '';
  try {
    return element.getAttribute('data-ka11y') || decodeURIComponent(href.slice(HASH_PREFIX_LENGTH));
  } catch {
    return '';
  }
};

const isPressed = (action: string, state: PublicState): boolean => {
  const parsed = parseAction(action);
  if (parsed === null || parsed.key === null) return false;
  if (parsed.name === 'profile') return state.profile === parsed.key;
  if (parsed.name !== 'feature' || !Object.hasOwn(state.features, parsed.key)) return false;
  return parsed.level === null || state.features[parsed.key] === parsed.level;
};

export const syncPressed = (state: StoreState): void => {
  const snapshot = publicState(state);
  document.querySelectorAll(TRIGGER_SELECTOR).forEach((element) => {
    const parsed = parseAction(triggerAction(element));
    if (parsed?.name === 'feature' || parsed?.name === 'profile') {
      element.setAttribute('aria-pressed', String(isPressed(triggerAction(element), snapshot)));
    }
  });
};

export const announceChange = (state: StoreState, source: ChangeSource): void => {
  document.dispatchEvent(new CustomEvent('ka11y:change', { detail: { state: publicState(state), source } }));
};

const levelsDiffer = (state: StoreState, previous: StoreState): boolean => {
  const keys = new Set([...Object.keys(state.levels), ...Object.keys(previous.levels)]);
  return [...keys].some((key) => state.levels[key] !== previous.levels[key]);
};

export const hasPublicChange = (state: StoreState, previous: StoreState): boolean =>
  state.profile !== previous.profile || levelsDiffer(state, previous);

const featureLevel = (key: string, requested: number | null, config: FeatureConfig, current: FeatureLevel | undefined): FeatureLevel => {
  const count = levelCountOf(key);
  if (requested === null) {
    if (isLevelActive(current)) return false;
    const preferred = typeof config.default === 'number' ? config.default : 1;
    return count === 1 ? true : Math.min(Math.max(preferred, 1), count);
  }
  if (requested === 0) return false;
  return count === 1 ? true : Math.min(requested, count);
};

export const runCommand = async (deps: CommandDeps, command: KA11yCommand): Promise<void> => {
  const parsed = parseAction(command.action);
  if (parsed === null) return;
  const source: ChangeSource = command.source ?? 'api';
  const { store } = deps;
  if (parsed.name === 'reset') {
    deps.within(source, () => store.reset());
    return;
  }
  if (parsed.key === null || (parsed.name !== 'feature' && parsed.name !== 'profile')) return;
  const key = parsed.key;
  await deps.load();
  if (parsed.name === 'feature') {
    const features = deps.features();
    if (features === null || !Object.hasOwn(features, key) || features[key]?.enabled !== true) return;
    const config = features[key] as FeatureConfig;
    deps.within(source, () => store.setLevel(key, featureLevel(key, parsed.level, config, store.getState().levels[key])));
    return;
  }
  const profiles = deps.profiles();
  if (profiles === null || !profiles.keys().includes(key)) return;
  deps.within(source, () => {
    if (source !== 'url') profiles.toggle(key);
    else if (!profiles.isActive(key)) profiles.apply(key);
  });
};
