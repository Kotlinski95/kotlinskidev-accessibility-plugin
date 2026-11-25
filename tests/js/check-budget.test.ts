import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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

  it('reads data.icons from the manifest', () => {
    const withIcons = { ...manifest(1500), data: { icons: entry(2048) } };
    const iconBudgets = { ...budgets, gzip: { 'data.icons': 2048 } };
    const ok = run(withIcons, iconBudgets);
    expect(ok.status).toBe(0);
    expect(ok.stdout).toMatch(/data\.icons\s+gzip\s+2048\s+2048\s+[\d.]+% ok/);
    const over = run({ ...withIcons, data: { icons: entry(2049) } }, iconBudgets);
    expect(over.status).toBe(1);
    expect(over.stdout).toMatch(/data\.icons.*over/);
    expect(run(manifest(1500), iconBudgets).stdout).toMatch(/data\.icons.*missing/);
  });

  it('ships a budget of 2048 bytes for data.icons', () => {
    const shipped = JSON.parse(readFileSync(join(root, 'bin/budgets.json'), 'utf8'));
    expect(shipped.gzip['data.icons']).toBe(2048);
  });
});

describe('build icon validation', () => {
  const buildWith = (svg: string): RunResult & { stderr: string } => {
    const dir = mkdtempSync(join(tmpdir(), 'ka11y-icons-'));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'fixture.svg'), svg);
    const result = spawnSync('node', [join(root, 'bin/build.mjs')], {
      encoding: 'utf8',
      env: { ...process.env, KA11Y_ICONS_DIR: dir },
    });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
  };

  const open = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">';

  it('fails on a script element', () => {
    const result = buildWith(`${open}<script>alert(1)</script><path d="M1 1h2"/></svg>`);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('fixture.svg');
  });

  it('fails on a fill attribute', () => {
    const result = buildWith(`${open}<path d="M1 1h2" fill="red"/></svg>`);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('attribute fill is not allowed');
  });

  it('fails on a non-path element, a wrong viewBox and invalid path data', () => {
    expect(buildWith(`${open}<circle cx="1" cy="1" r="1"/></svg>`).status).toBe(1);
    expect(buildWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M1 1h2"/></svg>').status).toBe(1);
    expect(buildWith(`${open}<path d="M1 1 <x>"/></svg>`).status).toBe(1);
  });
});
