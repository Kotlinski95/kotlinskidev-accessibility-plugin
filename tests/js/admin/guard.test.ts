import { installUnsavedGuard, unsavedCount, unsavedSummary, withUnsavedWarning } from '../../../src/ts/admin/guard';
import { createFormState } from '../../../src/ts/admin/state';

jest.mock('@wordpress/i18n', () => jest.requireActual('./wp-mocks').i18nMock, { virtual: true });

describe('unsaved changes guard', () => {
  it('counts changed definition paths', () => {
    const state = createFormState({ a: { b: 1, c: 2 }, d: 'x' });
    const paths = ['a.b', 'a.c', 'd'];
    expect(unsavedCount(state, paths)).toBe(0);
    state.set('a.b', 5);
    state.set('d', 'y');
    expect(unsavedCount(state, paths)).toBe(2);
    expect(state.changedPaths(paths)).toEqual(['a.b', 'd']);
    state.load({ a: { b: 5, c: 2 }, d: 'y' });
    expect(unsavedCount(state, paths)).toBe(0);
  });

  it('still reports one change when a dirty path is unknown to the schema', () => {
    const state = createFormState({ a: 1 });
    state.set('z', 1);
    expect(unsavedCount(state, ['a'])).toBe(1);
  });

  it('words the count in singular and plural', () => {
    expect(unsavedSummary(0)).toBe('');
    expect(unsavedSummary(1)).toBe('You have 1 unsaved change.');
    expect(unsavedSummary(3)).toBe('You have 3 unsaved changes.');
    expect(withUnsavedWarning('Reset?', 0)).toBe('Reset?');
    expect(withUnsavedWarning('Reset?', 2)).toBe('Reset? Your 2 unsaved changes will be lost.');
  });

  it('blocks leaving only while dirty and detaches cleanly', () => {
    const state = createFormState({ a: 1 });
    const remove = installUnsavedGuard(state);
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    state.set('a', 2);
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
    remove();
    const after = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });
});
