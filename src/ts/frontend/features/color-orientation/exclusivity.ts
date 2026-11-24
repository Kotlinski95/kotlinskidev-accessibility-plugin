import { isLevelActive } from '../../feature-utils';
import type { Store, StoreState } from '../../store';

export const CONTRAST_KEYS: readonly string[] = ['darkContrast', 'lightContrast', 'highContrast'];

const activeContrastKeys = (state: StoreState): string[] =>
  CONTRAST_KEYS.filter((key) => isLevelActive(state.levels[key]));

export const bindContrastExclusivity = (store: Store): (() => void) => {
  const onStateChange = (state: StoreState, previous: StoreState): void => {
    const added = activeContrastKeys(state).filter((key) => !isLevelActive(previous.levels[key]));
    const winner = added[added.length - 1];
    if (winner === undefined) return;
    CONTRAST_KEYS.filter((key) => key !== winner && isLevelActive(state.levels[key])).forEach((key) =>
      store.setLevel(key, false)
    );
  };
  return store.subscribe(onStateChange);
};
