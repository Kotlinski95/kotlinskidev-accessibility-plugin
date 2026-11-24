import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

interface RunResult {
  status: number | null;
  stdout: string;
}

type Json = Record<string, unknown>;

const root = resolve(__dirname, '../..');
const script = join(root, 'bin/check-budget.mjs');

const entry = (gzip: number, raw = gzip * 2): Json => ({ file: 'x', ver: 'v', raw, gzip });

const manifest = (loaderGzip: number): Json => ({
  abi: 1,
  scripts: { loader: entry(loaderGzip), kernel: entry(2000) },
  styles: { launcher: entry(500, 1000) },
  inline: { bootstrap: entry(400) },
});

const budgets: Json = {
  gzip: { 'inline.bootstrap': 1024, 'scripts.loader': 2048, 'scripts.kernel': 3072 },
  raw: { 'styles.launcher': 1400 },
  sum: { everyPage: { gzip: 3072, of: ['inline.bootstrap', 'scripts.loader'] } },
};

const run = (manifestJson: Json | null, budgetsJson: Json = budgets): RunResult => {
  const dir = mkdtempSync(join(tmpdir(), 'ka11y-budget-'));
  const manifestPath = join(dir, 'manifest.json');
  const budgetsPath = join(dir, 'budgets.json');
  if (manifestJson) writeFileSync(manifestPath, JSON.stringify(manifestJson));
  writeFileSync(budgetsPath, JSON.stringify(budgetsJson));
  const result = spawnSync('node', [script, manifestPath, budgetsPath], { encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout };
};

describe('check-budget', () => {
  it('passes when every value is within its limit', () => {
    const result = run(manifest(1500));
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('scripts.loader');
    expect(result.stdout).toContain('% ok');
  });

  it('fails when a value is over its limit', () => {
    const result = run(manifest(2049));
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/scripts\.loader\s+gzip\s+2049\s+2048\s+[\d.]+% over/);
  });

  it('fails when a raw value is over its limit', () => {
    const big = manifest(1500);
    big['styles'] = { launcher: entry(500, 1401) };
    expect(run(big).status).toBe(1);
  });

  it('fails when a budgeted entry is missing from the manifest', () => {
    const incomplete = manifest(1500);
    incomplete['scripts'] = { loader: entry(1500) };
    const result = run(incomplete);
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/scripts\.kernel.*missing/);
  });

  it('passes the sum rule exactly at its limit', () => {
    const tight = manifest(2048);
    tight['inline'] = { bootstrap: entry(1024) };
    const result = run(tight);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/sum\.everyPage\s+gzip\s+3072\s+3072\s+[\d.]+% ok/);
  });

  it('flags the sum rule when it exceeds its limit', () => {
    const over = manifest(2048);
    over['inline'] = { bootstrap: entry(1025) };
    const result = run(over, { ...budgets, gzip: { 'scripts.loader': 2048 } });
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/sum\.everyPage.*over/);
  });

  it('skips an entry the manifest lists as skipped', () => {
    const skipped = manifest(0);
    skipped['scripts'] = { kernel: entry(2000) };
    skipped['skipped'] = ['loader'];
    const result = run(skipped);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/scripts\.loader.*skipped/);
  });

  it('exits 2 when the manifest is missing', () => {
    expect(run(null).status).toBe(2);
  });
});
