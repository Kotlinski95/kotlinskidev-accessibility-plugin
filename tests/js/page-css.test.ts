import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const entry = resolve(__dirname, '../../src/scss/page/index.scss');
const css = spawnSync(process.execPath, ['-e', `process.stdout.write(require('sass').compile(process.argv[1]).css)`, entry], { encoding: 'utf8' }).stdout;

describe('page css', () => {
  it('resets gradient text in both contrast palettes', () => {
    ['dark', 'light'].forEach((name) => {
      const block = new RegExp(`html\\.ka11y-${name}-contrast body :not\\(#ka11y-root\\)[^{]*\\{([^}]*)\\}`).exec(css);
      expect(block?.[1]).toContain('-webkit-text-fill-color: currentcolor !important');
      expect(block?.[1]).toContain('background-clip: border-box !important');
      expect(block?.[1]).toContain('background-image: none !important');
    });
  });

  it('scopes text adjustments above theme specificity and out of the widget', () => {
    ['letter-spacing', 'font-weight', 'readable-font', 'dyslexic-font', 'align-center'].forEach((name) => {
      expect(css).toMatch(new RegExp(`html\\.ka11y-${name} body \\*[^{]*:not\\(#ka11y-root\\):not\\(#ka11y-root \\*\\) \\{`));
    });
  });

  describe('highlight links', () => {
    const links = ':is(a[href], [role=link]):not(#ka11y-root *)';
    const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .filter((match) => (match[1] ?? '').includes('html.ka11y-highlight-links'))
      .map((match) => match[2] ?? '')
      .join('\n');

    it('covers links, every descendant and their pseudo-elements outside the widget', () => {
      expect(css).toContain(`html.ka11y-highlight-links body ${links} {`);
      expect(css).toContain(`html.ka11y-highlight-links body ${links} *,`);
      expect(css).toContain(`html.ka11y-highlight-links body ${links} *::before`);
    });

    it('forces solid dark text over gradient and transparent text fills', () => {
      expect(rules).toContain('-webkit-text-fill-color: var(--ka11y-link-highlight-fg, #111) !important');
      expect(rules).toContain('color: var(--ka11y-link-highlight-fg, #111) !important');
      expect(rules).toContain('text-shadow: none !important');
    });

    it('drops descendant backgrounds, restores border-box clipping and paints yellow', () => {
      expect(rules).toContain('background: none !important');
      expect(rules).toContain('background-clip: border-box !important');
      expect(rules).toContain('background: var(--ka11y-link-highlight-bg, #ff0) !important');
      expect(rules).toContain('outline: 2px solid var(--ka11y-link-highlight-fg, #111) !important');
    });
  });
});
