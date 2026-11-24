import { DYSLEXIC_STYLE_ID, dyslexicFont } from '../../../../src/ts/frontend/features/content/dyslexic-font';
import { createConfig } from '../../helpers';
import { resetDocument } from './helpers';

describe('dyslexicFont', () => {
  beforeEach(resetDocument);

  it('injects a lazy font face from the configured url and class', () => {
    const before = document.documentElement.outerHTML;
    expect(document.getElementById(DYSLEXIC_STYLE_ID)).toBeNull();
    dyslexicFont.on(true);
    const style = document.getElementById(DYSLEXIC_STYLE_ID) as HTMLStyleElement;
    expect(style.textContent).toContain('https://example.test/opendyslexic.woff2');
    expect(style.textContent).toContain('@font-face');
    expect(document.documentElement.classList.contains('ka11y-dyslexic-font')).toBe(true);
    dyslexicFont.off();
    expect(document.getElementById(DYSLEXIC_STYLE_ID)).toBeNull();
    expect(document.documentElement.outerHTML).toBe(before);
  });

  it('injects the font face only once', () => {
    dyslexicFont.on(true);
    dyslexicFont.on(true);
    expect(document.querySelectorAll(`#${DYSLEXIC_STYLE_ID}`)).toHaveLength(1);
    dyslexicFont.off();
  });

  it('strips characters that could break out of the url', () => {
    window.kotlinskidevA11y = createConfig({ assets: { dyslexicFontUrl: 'https://x.test/a.woff2");}body{x:y' } });
    dyslexicFont.on(true);
    const css = (document.getElementById(DYSLEXIC_STYLE_ID) as HTMLStyleElement).textContent ?? '';
    expect(css.match(/"/g)).toHaveLength(6);
    dyslexicFont.off();
  });

  it('adds no font face without a url but still sets the class', () => {
    window.kotlinskidevA11y = createConfig({ assets: { dyslexicFontUrl: '' } });
    dyslexicFont.on(true);
    expect(document.getElementById(DYSLEXIC_STYLE_ID)).toBeNull();
    expect(document.documentElement.classList.contains('ka11y-dyslexic-font')).toBe(true);
    dyslexicFont.off();
  });
});
