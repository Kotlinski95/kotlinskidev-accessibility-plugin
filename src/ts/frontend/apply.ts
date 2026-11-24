import type { FeatureLevel } from '../shared/types';
import { isLevelActive } from './feature-utils';
import type { Store, StoreState } from './store';

export interface FeatureModule {
  key: string;
  on(level: FeatureLevel): void;
  off(): void;
}

export interface Applier {
  sync(state: StoreState): void;
  destroy(): void;
}

const CLASS_PREFIX = 'ka11y-';
const VAR_PREFIX = '--ka11y-';

const registry = new Map<string, FeatureModule>();

export const registerFeature = (module: FeatureModule): void => {
  registry.set(module.key, module);
};

export const unregisterFeature = (key: string): void => {
  registry.delete(key);
};

export const getFeature = (key: string): FeatureModule | undefined => registry.get(key);

export const createApplier = (store: Store, root: HTMLElement = document.documentElement): Applier => {
  const appliedClasses = new Set<string>();
  const appliedVars = new Map<string, string>();
  const activeLevels = new Map<string, FeatureLevel>();

  const syncClasses = (classes: Set<string>): void => {
    const wanted = [...classes].filter((name) => name.startsWith(CLASS_PREFIX));
    [...appliedClasses]
      .filter((name) => !wanted.includes(name))
      .forEach((name) => {
        root.classList.remove(name);
        appliedClasses.delete(name);
      });
    wanted.forEach((name) => {
      root.classList.add(name);
      appliedClasses.add(name);
    });
    if (root.classList.length === 0) root.removeAttribute('class');
  };

  const syncVars = (vars: Record<string, string>): void => {
    const wanted = Object.entries(vars).filter(([name]) => name.startsWith(VAR_PREFIX));
    const wantedNames = wanted.map(([name]) => name);
    [...appliedVars.keys()]
      .filter((name) => !wantedNames.includes(name))
      .forEach((name) => {
        root.style.removeProperty(name);
        appliedVars.delete(name);
      });
    wanted.forEach(([name, value]) => {
      if (appliedVars.get(name) === value) return;
      root.style.setProperty(name, value);
      appliedVars.set(name, value);
    });
    if (root.getAttribute('style') === '') root.removeAttribute('style');
  };

  const syncFeatures = (levels: Record<string, FeatureLevel>): void => {
    registry.forEach((module) => {
      const level = levels[module.key];
      if (isLevelActive(level) && level !== undefined) {
        if (activeLevels.get(module.key) === level) return;
        activeLevels.set(module.key, level);
        module.on(level);
        return;
      }
      if (activeLevels.delete(module.key)) module.off();
    });
  };

  const sync = (state: StoreState): void => {
    syncClasses(state.classes);
    syncVars(state.vars);
    syncFeatures(state.levels);
  };

  const onStateChange = (state: StoreState): void => sync(state);

  const unsubscribe = store.subscribe(onStateChange);
  sync(store.getState());

  const destroy = (): void => {
    unsubscribe();
    sync({ classes: new Set(), vars: {}, levels: {}, open: false });
  };

  return { sync, destroy };
};
