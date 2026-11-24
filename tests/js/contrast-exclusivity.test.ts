import { bindContrastExclusivity } from '../../src/ts/frontend/features/color-orientation';
import { init, features } from '../../src/ts/frontend/chunks/color';
import type { KernelApi } from '../../src/ts/frontend/kernel';
import { createStore } from '../../src/ts/frontend/store';

describe('contrast exclusivity', () => {
  it('turns the other contrast modes off through the store', () => {
    const store = createStore();
    bindContrastExclusivity(store);
    store.setLevel('darkContrast', true);
    expect(store.getState().levels).toEqual({ darkContrast: true });
    store.setLevel('highContrast', true);
    expect(store.getState().levels).toEqual({ highContrast: true });
    store.setLevel('lightContrast', true);
    expect(store.getState().levels).toEqual({ lightContrast: true });
    expect(store.getState().classes.has('ka11y-dark-contrast')).toBe(false);
    expect(store.getState().classes.has('ka11y-light-contrast')).toBe(true);
  });

  it('leaves unrelated features alone', () => {
    const store = createStore();
    bindContrastExclusivity(store);
    store.setLevel('biggerText', 2);
    store.setLevel('darkContrast', true);
    expect(store.getState().levels).toEqual({ biggerText: 2, darkContrast: true });
  });

  it('is bound by the color chunk init through the kernel store', () => {
    const store = createStore();
    init({ store } as unknown as KernelApi);
    store.setLevel('darkContrast', true);
    store.setLevel('highContrast', true);
    expect(store.getState().levels).toEqual({ highContrast: true });
  });

  it('the color chunk lists the five color features', () => {
    expect(features.map((feature) => feature.key)).toEqual([
      'darkContrast',
      'lightContrast',
      'highContrast',
      'monochrome',
      'saturation',
    ]);
  });
});
