import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const binDir = resolve(__dirname, '../../bin');

const pluginSource = (version: string, constant = version, author = 'Jane Doe'): string =>
  `<?php\n/**\n * Plugin Name: X\n * Version:           ${version}\n * Author:            ${author}\n */\ndefine( 'KOTLINSKIDEV_A11Y_VERSION', '${constant}' );\n`;

const changelogSource = (version: string): string =>
  `# Changelog\n\n## [Unreleased]\n\n### Added\n\n- Thing.\n\n## [${version}] - 2026-01-01\n\n- Old.\n`;

const makeRoot = (options: { header?: string; constant?: string; pkg?: string; changelog?: string; author?: string; pkgAuthor?: string | null } = {}): string => {
  const root = mkdtempSync(join(tmpdir(), 'ka11y-version-'));
  mkdirSync(join(root, 'bin'));
  cpSync(binDir, join(root, 'bin'), { recursive: true });
  writeFileSync(join(root, 'kotlinskidev-accessibility.php'), pluginSource(options.header ?? '1.2.3', options.constant ?? options.header ?? '1.2.3', options.author));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'x', version: options.pkg ?? '1.2.3', ...(options.pkgAuthor === null ? {} : { author: options.pkgAuthor ?? 'Jane Doe' }) }, null, 2));
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

  it('fails when the author differs from package.json', () => {
    const result = run(makeRoot({ author: 'John Roe' }), 'check-version.mjs');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('plugin header=John Roe');
    expect(result.stderr).toContain('package.json=Jane Doe');
  });

  it('fails when package.json has no author', () => {
    const result = run(makeRoot({ pkgAuthor: null }), 'check-version.mjs');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Missing author in: package.json');
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

  it('accepts prerelease versions everywhere', () => {
    const root = makeRoot({ header: '1.0.0-beta.1', pkg: '1.0.0-beta.1', changelog: '1.0.0-beta.1' });
    expect(run(root, 'check-version.mjs', [], { GITHUB_REF_NAME: 'v1.0.0-beta.1' }).status).toBe(0);
  });

  it('rejects unknown prerelease labels', () => {
    expect(run(makeRoot({ header: '1.0.0-alpha.1' }), 'check-version.mjs').status).toBe(1);
  });

  it('fails when the tag differs from a prerelease', () => {
    const bad = run(makeRoot({ header: '1.0.0-beta.1', pkg: '1.0.0-beta.1', changelog: '1.0.0-beta.1' }), 'check-version.mjs', [], { GITHUB_REF_NAME: 'v1.0.0-beta.2' });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('git tag=1.0.0-beta.2');
  });

  it('reads a prerelease changelog heading', () => {
    const root = makeRoot({ header: '1.0.0-beta.1', pkg: '1.0.0-beta.1', changelog: '1.0.0-beta.1' });
    expect(run(root, 'check-version.mjs').status).toBe(0);
  });
});

const planned = (current: string, args: string[]): { status: number | null; stdout: string; stderr: string } =>
  run(makeRoot({ header: current, pkg: current, changelog: current }), 'release.mjs', ['--dry-run', ...args]);

describe('release prereleases', () => {
  it.each([
    ['0.4.0', ['--major', '--pre', 'beta'], '0.4.0 -> 1.0.0-beta.1'],
    ['0.4.0', ['--minor', '--pre', 'rc'], '0.4.0 -> 0.5.0-rc.1'],
    ['0.4.0', ['--pre', 'beta'], '0.4.0 -> 0.4.1-beta.1'],
    ['1.0.0-beta.1', ['--pre', 'beta'], '1.0.0-beta.1 -> 1.0.0-beta.2'],
    ['1.0.0-beta.2', ['--pre', 'rc'], '1.0.0-beta.2 -> 1.0.0-rc.1'],
    ['1.0.0-rc.1', ['--pre', 'rc'], '1.0.0-rc.1 -> 1.0.0-rc.2'],
    ['1.0.0-beta.2', ['--major'], '1.0.0-beta.2 -> 1.0.0'],
    ['1.0.0-rc.1', [], '1.0.0-rc.1 -> 1.0.0'],
  ])('%s with %j plans %s', (current, args, expected) => {
    const result = planned(current, args);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(expected);
  });

  it('refuses to go from rc back to beta', () => {
    const result = planned('1.0.0-rc.1', ['--pre', 'beta']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('back to beta');
  });

  it('refuses unknown labels and a missing label', () => {
    expect(planned('0.4.0', ['--pre', 'alpha']).status).toBe(1);
    expect(planned('0.4.0', ['--pre']).status).toBe(1);
  });

  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])('refuses the inherited property name %s as a label', (label) => {
    const result = planned('0.4.0', ['--pre', label]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Unknown prerelease label');
  });

  it('cuts a beta, then promotes it with an empty unreleased section', () => {
    const root = makeRoot();
    expect(run(root, 'release.mjs', ['--major', '--pre', 'beta']).status).toBe(0);
    expect(run(root, 'check-version.mjs').status).toBe(0);
    expect(readFileSync(join(root, 'kotlinskidev-accessibility.php'), 'utf8')).toContain("'KOTLINSKIDEV_A11Y_VERSION', '2.0.0-beta.1'");
    expect(run(root, 'release.mjs', ['--major']).status).toBe(0);
    expect(run(root, 'check-version.mjs').status).toBe(0);
    const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
    expect(changelog).toMatch(/## \[2\.0\.0\] - \d{4}-\d{2}-\d{2}\n\n- Stable release of 2\.0\.0, promoted from 2\.0\.0-beta\.1\./);
    expect(changelog).toContain('## [2.0.0-beta.1]');
  });
});
