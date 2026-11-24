import type { FeatureLevel } from '../shared/types';
import { featureClassBase, isLevelActive } from './feature-utils';

export interface StoreState {
  classes: Set<string>;
  vars: Record<string, string>;
  levels: Record<string, FeatureLevel>;
  open: boolean;
}

export type StoreListener = (state: StoreState, previous: StoreState) => void;

export interface Store {
  getState(): StoreState;
  subscribe(listener: StoreListener): () => void;
  set(patch: Partial<StoreState>): void;
  toggle(key: string): void;
  setLevel(key: string, level: FeatureLevel): void;
  reset(): void;
}

const emptyState = (): StoreState => ({ classes: new Set(), vars: {}, levels: {}, open: false });

const isLevelClass = (name: string, base: string): boolean =>
  name === base || (name.startsWith(`${base}-`) && /^\d+$/.test(name.slice(base.length + 1)));

const classesForLevel = (key: string, level: FeatureLevel): string[] => {
  const base = featureClassBase(key);
  if (!isLevelActive(level)) return [];
  return typeof level === 'number' ? [base, `${base}-${level}`] : [base];
};

export const createStore = (initial: Partial<StoreState> = {}): Store => {
  let state: StoreState = { ...emptyState(), ...initial };
  const listeners = new Set<StoreListener>();

  const commit = (next: StoreState): void => {
    const previous = state;
    state = next;
    listeners.forEach((listener) => listener(state, previous));
  };

  const getState = (): StoreState => state;

  const subscribe = (listener: StoreListener): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const set = (patch: Partial<StoreState>): void => {
    commit({
      classes: new Set(patch.classes ?? state.classes),
      vars: { ...(patch.vars ?? state.vars) },
      levels: { ...(patch.levels ?? state.levels) },
      open: patch.open ?? state.open,
    });
  };

  const setLevel = (key: string, level: FeatureLevel): void => {
    const base = featureClassBase(key);
    const classes = new Set([...state.classes].filter((name) => !isLevelClass(name, base)));
    classesForLevel(key, level).forEach((name) => classes.add(name));
    const levels = Object.fromEntries(Object.entries(state.levels).filter(([name]) => name !== key));
    if (isLevelActive(level)) levels[key] = level;
    set({ classes, levels });
  };

  const toggle = (key: string): void => {
    setLevel(key, !isLevelActive(state.levels[key]));
  };

  const reset = (): void => {
    set({ classes: new Set(), vars: {}, levels: {} });
  };

  return { getState, subscribe, set, toggle, setLevel, reset };
};
