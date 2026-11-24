import { findLandmarks, focusLandmark } from '../../../../src/ts/frontend/features/color-orientation';
import type { Landmark } from '../../../../src/ts/frontend/features/color-orientation';
import { releaseTemporaryFocusTargets } from '../../../../src/ts/frontend/features/color-orientation/focus-target';
import { resetDocument } from './helpers';

describe('landmarks', () => {
  beforeEach(resetDocument);
  afterEach(releaseTemporaryFocusTargets);

  it('finds native and role landmarks once each', () => {
    document.body.innerHTML = `
      <nav id="n1" aria-label="Primary"></nav>
      <div id="n2" role="navigation"></div>
      <main id="m"></main>
      <div id="m2" role="main"></div>
      <footer id="f"></footer>
      <div id="f2" role="contentinfo"></div>
      <nav id="hidden" hidden></nav>
      <div id="ka11y-root"><nav id="inside"></nav></div>`;
    const found = findLandmarks();
    expect(found.map((landmark) => `${landmark.kind}:${landmark.element.id}`)).toEqual([
      'main:m',
      'main:m2',
      'navigation:n1',
      'navigation:n2',
      'footer:f',
      'footer:f2',
    ]);
    expect(found.find((landmark) => landmark.element.id === 'n1')?.label).toBe('Primary');
  });

  it('returns nothing when no landmark exists', () => {
    document.body.innerHTML = '<div></div>';
    expect(findLandmarks()).toEqual([]);
  });

  it('focuses a landmark with a temporary tabindex', () => {
    document.body.innerHTML = '<main id="m"></main>';
    const [landmark] = findLandmarks();
    focusLandmark(landmark as Landmark);
    expect(document.activeElement?.id).toBe('m');
    expect(document.getElementById('m')?.getAttribute('tabindex')).toBe('-1');
    releaseTemporaryFocusTargets();
    expect(document.getElementById('m')?.hasAttribute('tabindex')).toBe(false);
  });
});
