import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');

const check = (css: string): { status: number | null; stderr: string } => {
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { assertKsesSafeCss } from ${JSON.stringify(resolve(root, 'bin/lib-chunks.mjs'))}; assertKsesSafeCss(${JSON.stringify(css)});`,
    ],
    { encoding: 'utf8' }
  );
  return { status: result.status, stderr: result.stderr };
};

describe('assertKsesSafeCss', () => {
  it('accepts css without characters wp_kses rewrites', () => {
    expect(check('.ka11y-launcher{color:red}').status).toBe(0);
  });

  it.each(['&', '<', '>'])('rejects %s', (character) => {
    const result = check(`.a{content:"${character}"}`);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('wp_kses would rewrite');
  });
});
