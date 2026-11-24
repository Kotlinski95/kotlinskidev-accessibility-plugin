import { createStore } from '../../../../src/ts/frontend/store';
import { createApplier, registerFeature, unregisterFeature } from '../../../../src/ts/frontend/apply';
import {
  bindContrastExclusivity,
  colorOrientationFeatures,
} from '../../../../src/ts/frontend/features/color-orientation';
import { highContrast } from '../../../../src/ts/frontend/features/color-orientation/high-contrast';
import { monochrome } from '../../../../src/ts/frontend/features/color-orientation/monochrome';
import { saturation } from '../../../../src/ts/frontend/features/color-orientation/saturation';
import { flushObserver, resetDocument } from './helpers';

const buildPage = (): void => {
  document.body.innerHTML =
    '<header id="h"></header><main id="m" style="color: red;"></main><div id="ka11y-root"></div><script id="s"></script>';
};

describe('filters', () => {
  beforeEach(() => {
    resetDocument();
    buildPage();
  });

  afterEach(() => {
    highContrast.off();
    monochrome.off();
    saturation.off();
  });

  it('filters only direct body children except the host, never html or body', () => {
    const before = document.documentElement.outerHTML;
    highContrast.on(true);
    expect(document.getElementById('h')?.style.filter).toBe('var(--ka11y-filter)');
    expect(document.getElementById('m')?.style.filter).toBe('var(--ka11y-filter)');
    expect(document.getElementById('ka11y-root')?.style.filter).toBe('');
    expect(document.getElementById('s')?.style.filter).toBe('');
    expect(document.body.style.filter).toBe('');
    expect(document.documentElement.style.filter).toBe('');
    expect(document.documentElement.style.getPropertyValue('--ka11y-filter')).toBe('contrast(1.5)');
    highContrast.off();
    expect(document.documentElement.outerHTML).toBe(before);
  });

  it('combines all filters into one custom property in fixed order', () => {
    saturation.on(2);
    monochrome.on(true);
    highContrast.on(true);
    expect(document.documentElement.style.getPropertyValue('--ka11y-filter')).toBe(
      'contrast(1.5) grayscale(1) saturate(2)'
    );
    monochrome.off();
    expect(document.documentElement.style.getPropertyValue('--ka11y-filter')).toBe('contrast(1.5) saturate(2)');
  });

  it('maps saturation levels', () => {
    saturation.on(1);
    expect(document.documentElement.style.getPropertyValue('--ka11y-filter')).toBe('saturate(0.5)');
    saturation.on(2);
    expect(document.documentElement.style.getPropertyValue('--ka11y-filter')).toBe('saturate(2)');
  });

  it('restores an existing inline filter exactly', () => {
    const main = document.getElementById('m') as HTMLElement;
    main.style.setProperty('filter', 'blur(1px)');
    const before = main.outerHTML;
    monochrome.on(true);
    expect(main.style.filter).toBe('var(--ka11y-filter)');
    monochrome.off();
    expect(main.outerHTML).toBe(before);
  });

  it('re-applies to nodes appended to body later and not to overlays', async () => {
    highContrast.on(true);
    const late = document.createElement('section');
    const overlay = document.createElement('div');
    overlay.setAttribute('data-ka11y-overlay', '');
    const nested = document.createElement('p');
    document.getElementById('m')?.append(nested);
    document.body.append(late, overlay);
    await flushObserver();
    expect(late.style.filter).toBe('var(--ka11y-filter)');
    expect(overlay.style.filter).toBe('');
    expect(nested.style.filter).toBe('');
    highContrast.off();
    expect(late.hasAttribute('style')).toBe(false);
  });

  it('stops observing after the last filter is off', async () => {
    highContrast.on(true);
    highContrast.off();
    const late = document.createElement('section');
    document.body.append(late);
    await flushObserver();
    expect(late.style.filter).toBe('');
  });
});

describe('contrast exclusivity', () => {
  const keys = colorOrientationFeatures.map((module) => module.key);

  beforeEach(() => {
    resetDocument();
    keys.forEach(unregisterFeature);
  });

  it('exposes every expected feature key', () => {
    expect(keys).toEqual([
      'darkContrast',
      'lightContrast',
      'highContrast',
      'monochrome',
      'saturation',
      'readingLine',
      'readingMask',
      'readPage',
      'keyboardNavigation',
      'hideImages',
      'muteSounds',
      'highlightTitles',
      'highlightAll',
      'stopAnimations',
      'skipToContent',
    ]);
  });

  it('turns the other contrast modes off through the store', () => {
    const store = createStore();
    bindContrastExclusivity(store);
    store.setLevel('darkContrast', true);
    store.setLevel('lightContrast', true);
    expect(store.getState().levels).toEqual({ lightContrast: true });
    store.setLevel('highContrast', true);
    expect(store.getState().levels).toEqual({ highContrast: true });
    expect([...store.getState().classes]).toEqual(['ka11y-high-contrast']);
  });

  it('keeps unrelated features and resolves simultaneous activation to the last one', () => {
    const store = createStore();
    bindContrastExclusivity(store);
    store.setLevel('monochrome', true);
    store.set({ levels: { darkContrast: true, highContrast: true, monochrome: true } });
    expect(store.getState().levels).toEqual({ highContrast: true, monochrome: true });
  });

  it('drives the DOM through the applier', () => {
    colorOrientationFeatures.forEach(registerFeature);
    const store = createStore();
    bindContrastExclusivity(store);
    const applier = createApplier(store);
    store.setLevel('darkContrast', true);
    expect(document.documentElement.classList.contains('ka11y-dark-contrast')).toBe(true);
    store.setLevel('lightContrast', true);
    expect(document.documentElement.classList.contains('ka11y-dark-contrast')).toBe(false);
    expect(document.documentElement.classList.contains('ka11y-light-contrast')).toBe(true);
    applier.destroy();
    expect(document.documentElement.hasAttribute('class')).toBe(false);
  });

  it('stops enforcing after unbind', () => {
    const store = createStore();
    const unbind = bindContrastExclusivity(store);
    unbind();
    store.setLevel('darkContrast', true);
    store.setLevel('lightContrast', true);
    expect(Object.keys(store.getState().levels).sort()).toEqual(['darkContrast', 'lightContrast']);
  });
});
