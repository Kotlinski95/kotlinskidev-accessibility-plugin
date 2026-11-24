import { createStorage } from '../../src/ts/frontend/storage';
import { createStore } from '../../src/ts/frontend/store';
import type { StorageMode } from '../../src/ts/shared/types';

const KEY = 'ka11y-test';

const create = (mode: StorageMode, ttlDays = 365) => createStorage({ mode, ttlDays, key: KEY });

const populated = () => {
  const store = createStore();
  store.setLevel('biggerText', 2);
  store.set({ vars: { '--ka11y-font-scale': '1.25' } });
  return store.getState();
};

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = `${KEY}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    jest.useRealTimers();
  });

  it('round-trips through localStorage with bootstrap shape', () => {
    create('local').save(populated());
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    expect(raw.classes).toEqual(['ka11y-bigger-text', 'ka11y-bigger-text-2']);
    expect(raw.vars).toEqual({ '--ka11y-font-scale': '1.25' });
    expect(raw.levels).toEqual({ biggerText: 2 });
    expect(typeof raw.exp).toBe('number');
    const loaded = create('local').load();
    expect(loaded?.levels).toEqual({ biggerText: 2 });
    expect(loaded?.classes.has('ka11y-bigger-text')).toBe(true);
  });

  it('expires after ttl', () => {
    jest.useFakeTimers().setSystemTime(new Date('2030-01-01T00:00:00Z'));
    create('local', 1).save(populated());
    expect(create('local', 1).load()).not.toBeNull();
    jest.setSystemTime(new Date('2030-01-03T00:00:00Z'));
    expect(create('local', 1).load()).toBeNull();
  });

  it('sets expiry from ttlDays', () => {
    jest.useFakeTimers().setSystemTime(new Date('2030-01-01T00:00:00Z'));
    create('local', 2).save(populated());
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    expect(raw.exp).toBe(Date.now() + 2 * 86_400_000);
  });

  it('does nothing in none mode', () => {
    const storage = create('none');
    storage.save(populated());
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(document.cookie).not.toContain(KEY);
    expect(storage.load()).toBeNull();
  });

  it('round-trips through a cookie', () => {
    create('cookie').save(populated());
    expect(document.cookie).toContain(`${KEY}=`);
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(create('cookie').load()?.levels).toEqual({ biggerText: 2 });
  });

  it('removes the entry when state is empty', () => {
    const storage = create('local');
    storage.save(populated());
    storage.save(createStore().getState());
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('removes the cookie when state is empty', () => {
    const storage = create('cookie');
    storage.save(populated());
    storage.save(createStore().getState());
    expect(document.cookie).not.toContain(`${KEY}=%`);
    expect(create('cookie').load()).toBeNull();
  });

  it('returns null for corrupt or foreign data', () => {
    localStorage.setItem(KEY, '{bad');
    expect(create('local').load()).toBeNull();
    localStorage.setItem(KEY, JSON.stringify({ classes: ['x'], exp: 'no' }));
    expect(create('local').load()).toBeNull();
  });

  it('filters non ka11y names on load', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ classes: ['ka11y-a', 'other'], vars: { '--ka11y-a': '1', '--b': '2' }, exp: Date.now() + 1000 })
    );
    const loaded = create('local').load();
    expect([...(loaded?.classes ?? [])]).toEqual(['ka11y-a']);
    expect(loaded?.vars).toEqual({ '--ka11y-a': '1' });
  });

  it('survives storage failures', () => {
    const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => create('local').save(populated())).not.toThrow();
    spy.mockRestore();
  });
});
