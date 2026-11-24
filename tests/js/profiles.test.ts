import { createProfiles } from '../../src/ts/frontend/profiles';
import { createStore } from '../../src/ts/frontend/store';
import { feature } from './helpers';

const profileConfig = {
  vision: { enabled: true, features: ['biggerText', 'highlightLinks', 'hideImages'] },
  off: { enabled: false, features: ['biggerText'] },
};

const features = { biggerText: feature(), highlightLinks: feature(), hideImages: feature(false) };

describe('profiles', () => {
  it('lists only enabled profiles', () => {
    expect(createProfiles(createStore(), profileConfig, features).keys()).toEqual(['vision']);
  });

  it('applies enabled features at their first level', () => {
    const store = createStore();
    const profiles = createProfiles(store, profileConfig, features);
    profiles.apply('vision');
    expect(store.getState().levels).toEqual({ biggerText: 1, highlightLinks: true });
    expect(profiles.isActive('vision')).toBe(true);
  });

  it('clears a profile', () => {
    const store = createStore();
    const profiles = createProfiles(store, profileConfig, features);
    profiles.apply('vision');
    profiles.clear('vision');
    expect(store.getState().levels).toEqual({});
    expect(profiles.isActive('vision')).toBe(false);
  });

  it('toggles', () => {
    const store = createStore();
    const profiles = createProfiles(store, profileConfig, features);
    profiles.toggle('vision');
    expect(profiles.isActive('vision')).toBe(true);
    profiles.toggle('vision');
    expect(profiles.isActive('vision')).toBe(false);
  });

  it('is inactive when a member is off', () => {
    const store = createStore();
    const profiles = createProfiles(store, profileConfig, features);
    profiles.apply('vision');
    store.setLevel('highlightLinks', false);
    expect(profiles.isActive('vision')).toBe(false);
  });

  it('applies all listed features when no feature config is given', () => {
    const store = createStore();
    createProfiles(store, profileConfig).apply('vision');
    expect(Object.keys(store.getState().levels).sort()).toEqual(['biggerText', 'hideImages', 'highlightLinks']);
  });

  it('handles unknown profiles', () => {
    const profiles = createProfiles(createStore(), profileConfig, features);
    profiles.apply('nope');
    expect(profiles.isActive('nope')).toBe(false);
  });
});
