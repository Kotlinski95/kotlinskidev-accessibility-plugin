import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const binDir = resolve(__dirname, '../../bin');

const pluginSource = (version: string, constant = version): string =>
  `<?php\n/**\n * Plugin Name: X\n * Version:           ${version}\n */\ndefine( 'KOTLINSKIDEV_A11Y_VERSION', '${constant}' );\n`;

const changelogSource = (version: string): string =>
  `# Changelog\n\n## [Unreleased]\n\n### Added\n\n- Thing.\n\n## [${version}] - 2026-01-01\n\n- Old.\n`;

const makeRoot = (options: { header?: string; constant?: string; pkg?: string; changelog?: string } = {}): string => {
  const root = mkdtempSync(join(tmpdir(), 'ka11y-version-'));
  mkdirSync(join(root, 'bin'));
  cpSync(binDir, join(root, 'bin'), { recursive: true });
  writeFileSync(join(root, 'kotlinskidev-accessibility.php'), pluginSource(options.header ?? '1.2.3', options.constant ?? options.header ?? '1.2.3'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'x', version: options.pkg ?? '1.2.3' }, null, 2));
  writeFileSync(join(root, 'package-lock.json'), JSON.stringify({ version: options.pkg ?? '1.2.3', packages: { '': { version: options.pkg ?? '1.2.3' } } }));
  writeFileSync(join(root, 'CHANGELOG.md'), changelogSource(options.changelog ?? '1.2.3'));
  return root;
};

const run = (root: string, script: string, args: string[] = [], env: Record<string, string> = {}) =>
  spawnSync('node', [join(root, 'bin', script), ...args], {
    encoding: 'utf8',
    env: { ...process.env, GITHUB_REF_NAME: '', ...env }
  });

describe('check-version', () => {
  it('passes when all versions match', () => {
    expect(run(makeRoot(), 'check-version.mjs').status).toBe(0);
  });

  it('fails when package.json differs', () => {
    const result = run(makeRoot({ pkg: '1.2.4' }), 'check-version.mjs');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('package.json=1.2.4');
  });

  it('fails when the constant differs', () => {
    expect(run(makeRoot({ constant: '9.9.9' }), 'check-version.mjs').status).toBe(1);
  });

  it('fails when the changelog heading differs', () => {
    expect(run(makeRoot({ changelog: '1.0.0' }), 'check-version.mjs').status).toBe(1);
  });

  it('checks the tag when GITHUB_REF_NAME starts with v', () => {
    const root = makeRoot();
    expect(run(root, 'check-version.mjs', [], { GITHUB_REF_NAME: 'v1.2.3' }).status).toBe(0);
    const bad = run(root, 'check-version.mjs', [], { GITHUB_REF_NAME: 'v1.2.9' });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('git tag=1.2.9');
  });
});

describe('release', () => {
  it('dry run prints a plan and writes nothing', () => {
    const root = makeRoot();
    const result = run(root, 'release.mjs', ['--dry-run', '--minor']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('1.2.3 -> 1.3.0');
    expect(readFileSync(join(root, 'package.json'), 'utf8')).toContain('1.2.3');
  });

  it('bumps every file and moves unreleased under the new heading', () => {
    const root = makeRoot();
    expect(run(root, 'release.mjs', ['--major']).status).toBe(0);
    expect(run(root, 'check-version.mjs').status).toBe(0);
    expect(readFileSync(join(root, 'kotlinskidev-accessibility.php'), 'utf8')).toContain("'KOTLINSKIDEV_A11Y_VERSION', '2.0.0'");
    const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
    expect(changelog).toMatch(/## \[Unreleased\]\n\n## \[2\.0\.0\] - \d{4}-\d{2}-\d{2}\n\n### Added\n\n- Thing\./);
    expect(changelog).toContain('## [1.2.3] - 2026-01-01');
  });
});
