import { createFormState, readPath, writePath } from '../../../src/ts/admin/state';

jest.mock('@wordpress/i18n', () => jest.requireActual('./wp-mocks').i18nMock, { virtual: true });

describe('form state', () => {
  it('reads and writes dotted paths', () => {
    const tree = { a: { b: 1 } };
    writePath(tree, 'a.c.d', 2);
    expect(readPath(tree, 'a.b')).toBe(1);
    expect(readPath(tree, 'a.c.d')).toBe(2);
    expect(readPath(tree, 'x.y')).toBeUndefined();
  });

  it('turns an empty list into an object when writing beneath it', () => {
    const tree = { labels: [] as unknown[] };
    writePath(tree, 'labels.pl_PL', { open: 'Otworz' });
    expect(JSON.parse(JSON.stringify(tree))).toEqual({ labels: { pl_PL: { open: 'Otworz' } } });
  });

  it('tracks dirty state and notifies', () => {
    const state = createFormState({ a: { b: 1 } });
    const listener = jest.fn();
    state.subscribe(listener);
    expect(state.isDirty()).toBe(false);
    state.set('a.b', 2);
    expect(state.isDirty()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    state.set('a.b', 1);
    expect(state.isDirty()).toBe(false);
  });

  it('load resets the baseline', () => {
    const state = createFormState({ a: 1 });
    state.set('a', 5);
    state.load({ a: 5 });
    expect(state.isDirty()).toBe(false);
    expect(state.snapshot()).toEqual({ a: 5 });
  });

  it('snapshot is detached from internal state', () => {
    const state = createFormState({ a: { b: 1 } });
    const snapshot = state.snapshot() as { a: { b: number } };
    snapshot.a.b = 9;
    expect(state.get('a.b')).toBe(1);
  });

  it('unsubscribes listeners', () => {
    const state = createFormState({ a: 1 });
    const listener = jest.fn();
    const off = state.subscribe(listener);
    off();
    state.set('a', 2);
    expect(listener).not.toHaveBeenCalled();
  });
});
