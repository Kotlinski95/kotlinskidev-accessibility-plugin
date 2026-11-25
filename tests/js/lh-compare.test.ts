import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

interface Metrics {
  lcp: number;
  cls: number;
  tbt: number;
  blocking?: string[];
}

interface Verdict {
  ok: boolean;
  failures: string[];
}

const script = resolve(__dirname, '../../bin/lh-compare.mjs');

const report = (url: string, m: Metrics): Record<string, unknown> => ({
  requestedUrl: url,
  audits: {
    'largest-contentful-paint': { numericValue: m.lcp },
    'cumulative-layout-shift': { numericValue: m.cls },
    'total-blocking-time': { numericValue: m.tbt },
    'render-blocking-resources': { details: { items: (m.blocking ?? []).map((url2) => ({ url: url2 })) } },
  },
});

type Report = Record<string, unknown>;

const run = (m: Metrics): Report => report('http://localhost:8889/', m);

const evaluate = (offReports: Report[], onReports: Report[], savedReports: Report[] = []): Verdict => {
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { compare } from ${JSON.stringify(script)}; process.stdout.write(JSON.stringify(compare(...JSON.parse(process.argv[1]))));`,
      JSON.stringify([offReports, onReports, savedReports]),
    ],
    { encoding: 'utf8' },
  );
  return JSON.parse(result.stdout) as Verdict;
};

const baseline: Metrics = { lcp: 2000, cls: 0, tbt: 100 };

describe('lh-compare', () => {
  it('passes when on is within thresholds', () => {
    const verdict = evaluate([run(baseline)], [run({ lcp: 2080, cls: 0.005, tbt: 140 })]);
    expect(verdict.ok).toBe(true);
  });

  it('tolerates a small absolute rise under the floors', () => {
    const verdict = evaluate([run({ lcp: 500, cls: 0, tbt: 10 })], [run({ lcp: 590, cls: 0, tbt: 55 })]);
    expect(verdict.ok).toBe(true);
  });

  it('fails on LCP regression', () => {
    const verdict = evaluate([run(baseline)], [run({ ...baseline, lcp: 2300 })]);
    expect(verdict.ok).toBe(false);
    expect(verdict.failures[0]).toMatch(/LCP/);
  });

  it('fails on CLS regression', () => {
    const verdict = evaluate([run(baseline)], [run({ ...baseline, cls: 0.02 })]);
    expect(verdict.failures.join()).toMatch(/CLS/);
  });

  it('fails on TBT regression', () => {
    const verdict = evaluate([run(baseline)], [run({ ...baseline, tbt: 400 })]);
    expect(verdict.failures.join()).toMatch(/TBT/);
  });

  it('uses medians across runs', () => {
    const verdict = evaluate(
      [run(baseline), run(baseline), run(baseline)],
      [run(baseline), run(baseline), run({ ...baseline, lcp: 9000 })],
    );
    expect(verdict.ok).toBe(true);
  });

  it('fails on a render-blocking plugin resource', () => {
    const verdict = evaluate(
      [run(baseline)],
      [run({ ...baseline, blocking: ['http://localhost:8889/wp-content/plugins/kotlinskidev-accessibility/build/a.css'] })],
    );
    expect(verdict.failures.join()).toMatch(/render-blocking/);
  });

  it('fails on a render-blocking kotlinskidev-a11y resource', () => {
    const verdict = evaluate(
      [run(baseline)],
      [run({ ...baseline, blocking: ['http://localhost:8889/wp-content/plugins/kotlinskidev-a11y/build/a.css'] })],
    );
    expect(verdict.failures.join()).toMatch(/render-blocking/);
  });

  it('fails on CLS regression with saved state', () => {
    const verdict = evaluate([run(baseline)], [run(baseline)], [run({ ...baseline, cls: 0.05 })]);
    expect(verdict.failures.join()).toMatch(/saved state/);
  });

  it('fails when a side is missing', () => {
    expect(evaluate([run(baseline)], []).ok).toBe(false);
    expect(evaluate([], [run(baseline)]).ok).toBe(false);
  });

  it('exits non-zero from the CLI on regression', () => {
    const root = mkdtempSync(join(tmpdir(), 'lh-'));
    const offDir = join(root, 'off');
    const onDir = join(root, 'on');
    mkdirSync(offDir);
    mkdirSync(onDir);
    writeFileSync(join(offDir, 'localhost--2026_11_25_13_20_02.report.json'), JSON.stringify(run(baseline)));
    writeFileSync(join(onDir, 'localhost--2026_11_25_13_20_02.report.json'), JSON.stringify(run({ ...baseline, lcp: 5000 })));
    expect(spawnSync(process.execPath, [script, offDir, onDir], { encoding: 'utf8' }).status).toBe(1);
  });

  it('reads lhci filesystem reports and ignores manifest.json', () => {
    const root = mkdtempSync(join(tmpdir(), 'lh-'));
    const offDir = join(root, 'off');
    const onDir = join(root, 'on');
    mkdirSync(offDir);
    mkdirSync(onDir);
    for (const dir of [offDir, onDir]) {
      writeFileSync(join(dir, 'localhost--2026_11_25_13_20_02.report.json'), JSON.stringify(run(baseline)));
      writeFileSync(join(dir, 'localhost--2026_11_25_13_20_02.report.html'), '<html></html>');
      writeFileSync(join(dir, 'manifest.json'), '[]');
    }
    const result = spawnSync(process.execPath, [script, offDir, onDir], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Lighthouse comparison passed');
  });

  it('exits with usage error without two directories', () => {
    expect(spawnSync(process.execPath, [script], { encoding: 'utf8' }).status).toBe(2);
  });
});
