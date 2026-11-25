import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const binDir = resolve(__dirname, '../../bin');

const changelog = `# Changelog

## [Unreleased]

### Added

- Pending.

## [1.0.0-beta.1] - 2026-02-01

### Added

- Beta thing.

### Fixed

- Beta fix.

## [0.4.0] - 2026-01-01

- Old.

## [0.3.0] - 2025-12-01

## [0.2.0] - 2025-11-01

- Older.
`;

const run = (version: string): { status: number | null; stdout: string; stderr: string } => {
  const root = mkdtempSync(join(tmpdir(), 'ka11y-notes-'));
  mkdirSync(join(root, 'bin'));
  cpSync(binDir, join(root, 'bin'), { recursive: true });
  writeFileSync(join(root, 'CHANGELOG.md'), changelog);
  return spawnSync('node', [join(root, 'bin', 'release-notes.mjs'), version], { encoding: 'utf8' });
};

describe('release-notes', () => {
  it('prints the section body without its heading', () => {
    const result = run('0.4.0');
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('- Old.\n');
  });

  it('keeps subsections of a prerelease and stops at the next version', () => {
    const result = run('1.0.0-beta.1');
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('### Added\n\n- Beta thing.\n\n### Fixed\n\n- Beta fix.\n');
  });

  it('accepts a leading v', () => {
    expect(run('v0.4.0').stdout).toBe('- Old.\n');
  });

  it('fails when the version has no section', () => {
    const result = run('9.9.9');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('no section for 9.9.9');
  });

  it('fails when the section is empty', () => {
    const result = run('0.3.0');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('is empty');
  });

  it('does not match a version that is only a prefix of another', () => {
    expect(run('1.0.0').status).toBe(1);
  });

  it('rejects input that is not a release version', () => {
    expect(run('0.4').status).toBe(1);
    expect(run('0.4.0-alpha.1').status).toBe(1);
    expect(run('').status).toBe(1);
  });
});
