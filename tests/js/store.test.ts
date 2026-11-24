import { createStore } from '../../src/ts/frontend/store';

describe('store', () => {
  it('starts empty and closed', () => {
    const state = createStore().getState();
    expect(state.classes.size).toBe(0);
    expect(state.vars).toEqual({});
    expect(state.levels).toEqual({});
    expect(state.open).toBe(false);
  });

  it('notifies subscribers with next and previous state', () => {
    const store = createStore();
    const listener = jest.fn();
    store.subscribe(listener);
    store.set({ open: true });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].open).toBe(true);
    expect(listener.mock.calls[0][1].open).toBe(false);
  });

  it('stops notifying after unsubscribe', () => {
    const store = createStore();
    const listener = jest.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.set({ open: true });
    expect(listener).not.toHaveBeenCalled();
  });

  it('sets boolean level and its class', () => {
    const store = createStore();
    store.setLevel('highlightLinks', true);
    expect(store.getState().levels.highlightLinks).toBe(true);
    expect(store.getState().classes.has('ka11y-highlight-links')).toBe(true);
  });

  it('sets numeric level with level class and replaces previous', () => {
    const store = createStore();
    store.setLevel('biggerText', 1);
    store.setLevel('biggerText', 2);
    const { classes, levels } = store.getState();
    expect(levels.biggerText).toBe(2);
    expect([...classes].sort()).toEqual(['ka11y-bigger-text', 'ka11y-bigger-text-2']);
  });

  it('removes level and classes when turned off', () => {
    const store = createStore();
    store.setLevel('biggerText', 3);
    store.setLevel('biggerText', 0);
    expect(store.getState().levels).toEqual({});
    expect(store.getState().classes.size).toBe(0);
  });

  it('toggles a feature', () => {
    const store = createStore();
    store.toggle('highlightLinks');
    expect(store.getState().levels.highlightLinks).toBe(true);
    store.toggle('highlightLinks');
    expect(store.getState().levels.highlightLinks).toBeUndefined();
  });

  it('reset clears everything except open', () => {
    const store = createStore();
    store.setLevel('biggerText', 1);
    store.set({ vars: { '--ka11y-x': '1' }, open: true });
    store.reset();
    const state = store.getState();
    expect(state.classes.size).toBe(0);
    expect(state.vars).toEqual({});
    expect(state.levels).toEqual({});
    expect(state.open).toBe(true);
  });

  it('does not mutate previous state', () => {
    const store = createStore();
    const before = store.getState();
    store.setLevel('biggerText', 1);
    expect(before.classes.size).toBe(0);
    expect(before.levels).toEqual({});
  });
});
