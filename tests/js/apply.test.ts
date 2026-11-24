import { createApplier, registerFeature, unregisterFeature } from '../../src/ts/frontend/apply';
import { createStore } from '../../src/ts/frontend/store';

describe('apply', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    document.documentElement.removeAttribute('class');
    document.documentElement.removeAttribute('style');
    unregisterFeature('fake');
  });

  it('applies and exactly reverts classes and vars', () => {
    const root = document.documentElement;
    root.classList.add('keep');
    root.style.setProperty('color', 'red');
    const before = root.outerHTML;
    const store = createStore();
    const applier = createApplier(store, root);
    store.set({ classes: new Set(['ka11y-a', 'foreign']), vars: { '--ka11y-x': '2', '--other': '1' } });
    expect(root.classList.contains('ka11y-a')).toBe(true);
    expect(root.classList.contains('foreign')).toBe(false);
    expect(root.style.getPropertyValue('--ka11y-x')).toBe('2');
    expect(root.style.getPropertyValue('--other')).toBe('');
    store.reset();
    expect(root.outerHTML).toBe(before);
    applier.destroy();
  });

  it('leaves no empty class or style attributes after revert', () => {
    const root = document.documentElement;
    const store = createStore();
    createApplier(store, root);
    store.set({ classes: new Set(['ka11y-a']), vars: { '--ka11y-x': '1' } });
    store.reset();
    expect(root.hasAttribute('class')).toBe(false);
    expect(root.hasAttribute('style')).toBe(false);
  });

  it('updates a changed var value', () => {
    const root = document.documentElement;
    const store = createStore();
    createApplier(store, root);
    store.set({ vars: { '--ka11y-x': '1' } });
    store.set({ vars: { '--ka11y-x': '3' } });
    expect(root.style.getPropertyValue('--ka11y-x')).toBe('3');
  });

  it('drives registered features on level changes', () => {
    const on = jest.fn();
    const off = jest.fn();
    registerFeature({ key: 'fake', on, off });
    const store = createStore();
    createApplier(store, document.documentElement);
    store.setLevel('fake', 2);
    expect(on).toHaveBeenCalledWith(2);
    store.setLevel('fake', 2);
    expect(on).toHaveBeenCalledTimes(1);
    store.setLevel('fake', 3);
    expect(on).toHaveBeenLastCalledWith(3);
    store.setLevel('fake', false);
    expect(off).toHaveBeenCalledTimes(1);
    store.setLevel('fake', false);
    expect(off).toHaveBeenCalledTimes(1);
  });

  it('applies features already active at creation', () => {
    const on = jest.fn();
    registerFeature({ key: 'fake', on, off: jest.fn() });
    const store = createStore({ levels: { fake: true } });
    createApplier(store, document.documentElement);
    expect(on).toHaveBeenCalledWith(true);
  });

  it('destroy reverts everything and stops listening', () => {
    const off = jest.fn();
    registerFeature({ key: 'fake', on: jest.fn(), off });
    const root = document.documentElement;
    const store = createStore();
    const applier = createApplier(store, root);
    store.setLevel('fake', true);
    applier.destroy();
    expect(off).toHaveBeenCalledTimes(1);
    expect(root.classList.contains('ka11y-fake')).toBe(false);
    store.setLevel('fake', true);
    expect(root.classList.contains('ka11y-fake')).toBe(false);
  });
});
