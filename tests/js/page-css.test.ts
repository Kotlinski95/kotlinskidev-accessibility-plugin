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
});
