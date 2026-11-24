import { darkContrast } from '../../../../src/ts/frontend/features/color-orientation/dark-contrast';
import { hideImages } from '../../../../src/ts/frontend/features/color-orientation/hide-images';
import { highlightAll } from '../../../../src/ts/frontend/features/color-orientation/highlight-all';
import { highlightTitles } from '../../../../src/ts/frontend/features/color-orientation/highlight-titles';
import { lightContrast } from '../../../../src/ts/frontend/features/color-orientation/light-contrast';
import { skipToContent } from '../../../../src/ts/frontend/features/color-orientation/skip-to-content';
import { resetDocument } from './helpers';

const cases = [
  [darkContrast, 'ka11y-dark-contrast'],
  [lightContrast, 'ka11y-light-contrast'],
  [hideImages, 'ka11y-hide-images'],
  [highlightTitles, 'ka11y-highlight-titles'],
  [highlightAll, 'ka11y-highlight-all'],
  [skipToContent, 'ka11y-skip-to-content'],
] as const;

describe.each(cases)('class feature %#', (module, className) => {
  beforeEach(resetDocument);

  it(`toggles ${className} and restores html exactly`, () => {
    const before = document.documentElement.outerHTML;
    module.on(true);
    expect(document.documentElement.classList.contains(className)).toBe(true);
    module.off();
    expect(document.documentElement.outerHTML).toBe(before);
  });

  it('keeps unrelated classes', () => {
    document.documentElement.classList.add('keep');
    module.on(true);
    module.off();
    expect(document.documentElement.className).toBe('keep');
  });
});
