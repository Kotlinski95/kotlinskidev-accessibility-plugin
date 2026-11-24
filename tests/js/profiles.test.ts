import { createApplier, unregisterFeature } from '../../src/ts/frontend/apply';
import type { Applier } from '../../src/ts/frontend/apply';
import { allFeatures, registerAllFeatures } from '../../src/ts/frontend/features';
import { bindContrastExclusivity } from '../../src/ts/frontend/features/color-orientation';
import { createProfiles } from '../../src/ts/frontend/profiles';
import { createStorage } from '../../src/ts/frontend/storage';
import { createStore } from '../../src/ts/frontend/store';
import type { FeatureConfig, ProfileConfig } from '../../src/ts/shared/types';
import { feature } from './helpers';

const PRESETS: Record<string, string[]> = {
  visionImpaired: ['biggerText', 'highContrast', 'readableFont', 'highlightLinks', 'bigCursor'],
  seizureSafe: ['stopAnimations', 'muteSounds', 'saturation'],
  adhdFriendly: ['readingMask', 'stopAnimations', 'highlightTitles', 'muteSounds'],
  blindness: ['keyboardNavigation', 'readPage', 'highlightAll', 'skipToContent'],
  epilepsySafe: ['stopAnimations', 'muteSounds', 'monochrome'],
};

const profileConfig = (): Record<string, ProfileConfig> =>
  Object.fromEntries(Object.entries(PRESETS).map(([key, list]) => [key, { enabled: true, features: list }]));

const featureConfig = (): Record<string, FeatureConfig> =>
  Object.fromEntries(allFeatures.map((module) => [module.key, feature()]));

describe('profiles with real features', () => {
  let applier: Applier;

  const setup = (profiles = profileConfig(), features = featureConfig()) => {
    const store = createStore();
    bindContrastExclusivity(store);
    registerAllFeatures();
    applier = createApplier(store);
    return { store, profiles: createProfiles(store, profiles, features) };
  };

  afterEach(() => {
    applier.destroy();
    allFeatures.forEach((module) => unregisterFeature(module.key));
    localStorage.clear();
    document.documentElement.removeAttribute('class');
    document.documentElement.removeAttribute('style');
  });

  it('applies each preset through the store and the document', () => {
    const { store, profiles } = setup();
    Object.entries(PRESETS).forEach(([key, list]) => {
      profiles.apply(key);
      expect(Object.keys(store.getState().levels).sort()).toEqual([...list].sort());
      expect(profiles.isActive(key)).toBe(true);
      profiles.clear(key);
      expect(store.getState().levels).toEqual({});
      expect(store.getState().classes.size).toBe(0);
      expect(document.documentElement.classList.contains('ka11y-stop-animations')).toBe(false);
    });
  });

  it('sets multi-level features at the intended level', () => {
    const { store, profiles } = setup();
    profiles.apply('visionImpaired');
    expect(store.getState().levels.biggerText).toBe(2);
    expect(document.documentElement.classList.contains('ka11y-bigger-text-2')).toBe(true);
    profiles.apply('seizureSafe');
    expect(store.getState().levels.saturation).toBe(1);
  });

  it('lists only enabled profiles and marks buttons state through isActive', () => {
    const config = profileConfig();
    config.blindness = { enabled: false, features: PRESETS.blindness ?? [] };
    const { profiles } = setup(config);
    expect(profiles.keys()).not.toContain('blindness');
    profiles.apply('blindness');
    expect(profiles.isActive('blindness')).toBe(false);
  });

  it('toggle removes exactly what the profile added', () => {
    const { store, profiles } = setup();
    store.setLevel('highlightLinks', true);
    store.setLevel('biggerText', 3);
    profiles.toggle('visionImpaired');
    expect(store.getState().levels.biggerText).toBe(3);
    expect(Object.keys(store.getState().owned).sort()).toEqual(['bigCursor', 'highContrast', 'readableFont']);
    profiles.toggle('visionImpaired');
    expect(store.getState().levels).toEqual({ highlightLinks: true, biggerText: 3 });
    expect(store.getState().profile).toBeNull();
  });

  it('does not remove a feature the user changed after applying', () => {
    const { store, profiles } = setup();
    profiles.apply('visionImpaired');
    store.setLevel('biggerText', 3);
    profiles.clear('visionImpaired');
    expect(store.getState().levels).toEqual({ biggerText: 3 });
  });

  it('switching profiles releases the previous one first', () => {
    const { store, profiles } = setup();
    profiles.apply('seizureSafe');
    profiles.apply('adhdFriendly');
    expect(profiles.isActive('seizureSafe')).toBe(false);
    expect(store.getState().levels.saturation).toBeUndefined();
    expect(store.getState().levels.readingMask).toBe(true);
    expect(store.getState().levels.stopAnimations).toBe(true);
  });

  it('reset clears the active profile', () => {
    const { store, profiles } = setup();
    profiles.apply('blindness');
    store.reset();
    expect(store.getState().profile).toBeNull();
    expect(profiles.isActive('blindness')).toBe(false);
  });

  it('skips features that are disabled in config', () => {
    const features = featureConfig();
    features.bigCursor = feature(false);
    features.highContrast = feature(false);
    const { store, profiles } = setup(profileConfig(), features);
    profiles.apply('visionImpaired');
    expect(Object.keys(store.getState().levels).sort()).toEqual(['biggerText', 'highlightLinks', 'readableFont']);
    expect(profiles.featuresOf('visionImpaired')).not.toContain('bigCursor');
  });

  it('does nothing when every member is disabled', () => {
    const features = Object.fromEntries(Object.keys(featureConfig()).map((key) => [key, feature(false)]));
    const { store, profiles } = setup(profileConfig(), features);
    profiles.apply('epilepsySafe');
    expect(store.getState().profile).toBeNull();
    expect(store.getState().levels).toEqual({});
  });

  it('persists the active profile and restores it on load', () => {
    const config = { mode: 'local' as const, ttlDays: 1, key: 'ka11y' };
    const first = setup();
    const storage = createStorage(config);
    first.store.subscribe((state) => storage.save(state));
    first.store.setLevel('muteSounds', true);
    first.profiles.apply('visionImpaired');
    applier.destroy();

    const loaded = createStorage(config).load();
    expect(loaded?.profile).toBe('visionImpaired');
    const second = setup();
    second.store.set(loaded ?? {});
    expect(second.profiles.isActive('visionImpaired')).toBe(true);
    expect(second.store.getState().levels.biggerText).toBe(2);
    second.profiles.toggle('visionImpaired');
    expect(second.store.getState().levels).toEqual({ muteSounds: true });
  });

  it('does not persist a profile key when none is active', () => {
    const config = { mode: 'local' as const, ttlDays: 1, key: 'ka11y' };
    const { store } = setup();
    store.subscribe((state) => createStorage(config).save(state));
    store.setLevel('muteSounds', true);
    expect(JSON.parse(localStorage.getItem('ka11y') ?? '{}')).not.toHaveProperty('profile');
  });

  it('keeps contrast exclusive when a profile applies high contrast', () => {
    const { store, profiles } = setup();
    store.setLevel('darkContrast', true);
    profiles.apply('visionImpaired');
    expect(store.getState().levels.darkContrast).toBeUndefined();
    expect(store.getState().levels.highContrast).toBe(true);
  });

  it('keeps the profile owned contrast when it was not displaced', () => {
    const { store, profiles } = setup();
    profiles.apply('visionImpaired');
    store.setLevel('lightContrast', true);
    expect(store.getState().levels.highContrast).toBeUndefined();
    expect(profiles.isActive('visionImpaired')).toBe(false);
    profiles.clear('visionImpaired');
    expect(store.getState().levels.lightContrast).toBe(true);
    expect(store.getState().levels.biggerText).toBeUndefined();
  });

  it('handles unknown profiles', () => {
    const { profiles } = setup();
    profiles.apply('nope');
    expect(profiles.isActive('nope')).toBe(false);
  });
});
