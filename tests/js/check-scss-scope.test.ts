import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const script = join(root, 'bin/check-scss-scope.mjs');
const schema = join(root, 'src/php/Settings/Schema.php');

const runGuard = (css: string): { status: number | null; stderr: string } => {
  const dir = mkdtempSync(join(tmpdir(), 'ka11y-scope-'));
  const cssPath = join(dir, 'frontend.css');
  writeFileSync(cssPath, css);
  const result = spawnSync('node', [script, cssPath, schema], { encoding: 'utf8' });
  return { status: result.status, stderr: result.stderr };
};

describe('check-scss-scope', () => {
  it('fails on a bare feature state class selector', () => {
    const result = runGuard('.ka11y-reading-mask{position:fixed;pointer-events:none}');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('.ka11y-reading-mask');
  });

  it('fails on a bare state class inside a media query and a selector list', () => {
    const result = runGuard('@media (prefers-reduced-motion:reduce){.ka11y-reading-line,.ka11y-reading-mask{transition:none}}');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('.ka11y-reading-line');
  });

  it('fails on a body-scoped state class', () => {
    expect(runGuard('body .ka11y-high-contrast{filter:none}').status).toBe(1);
  });

  it('passes html scoped state classes and overlay classes', () => {
    const css = [
      'html.ka11y-reading-mask body *{cursor:auto}',
      ':root.ka11y-high-contrast a{color:red}',
      '.ka11y-overlay--mask-top{top:0}',
      '.ka11y-overlay--line{height:1px}',
    ].join('');
    expect(runGuard(css).status).toBe(0);
  });

  it('passes the compiled page stylesheet when it exists', () => {
    const built = join(root, 'build/frontend.css');
    const result = spawnSync('node', [script, built, schema], { encoding: 'utf8' });
    expect(result.status === 0 || /ENOENT/.test(result.stderr)).toBe(true);
  });
});
