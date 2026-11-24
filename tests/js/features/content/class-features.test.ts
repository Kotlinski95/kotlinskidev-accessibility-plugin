import { bigCursor } from '../../../../src/ts/frontend/features/content/big-cursor';
import { fontWeight } from '../../../../src/ts/frontend/features/content/font-weight';
import { highlightLinks } from '../../../../src/ts/frontend/features/content/highlight-links';
import { letterSpacing } from '../../../../src/ts/frontend/features/content/letter-spacing';
import { readableFont } from '../../../../src/ts/frontend/features/content/readable-font';
import { resetDocument } from './helpers';

describe.each([
  [letterSpacing, 'letterSpacing', 'ka11y-letter-spacing'],
  [fontWeight, 'fontWeight', 'ka11y-font-weight'],
  [readableFont, 'readableFont', 'ka11y-readable-font'],
  [highlightLinks, 'highlightLinks', 'ka11y-highlight-links'],
  [bigCursor, 'bigCursor', 'ka11y-big-cursor'],
])('class feature %#', (module, key, className) => {
  beforeEach(resetDocument);

  it('exposes its key', () => {
    expect(module.key).toBe(key);
  });

  it('adds and removes its class and leaves no class attribute', () => {
    const before = document.documentElement.outerHTML;
    module.on(true);
    expect(document.documentElement.classList.contains(className)).toBe(true);
    module.off();
    expect(document.documentElement.hasAttribute('class')).toBe(false);
    expect(document.documentElement.outerHTML).toBe(before);
  });

  it('keeps foreign classes', () => {
    document.documentElement.classList.add('keep');
    module.on(true);
    module.off();
    expect(document.documentElement.className).toBe('keep');
  });

  it('is idempotent', () => {
    module.on(true);
    module.on(true);
    module.off();
    module.off();
    expect(document.documentElement.hasAttribute('class')).toBe(false);
  });
});
