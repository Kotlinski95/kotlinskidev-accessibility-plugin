import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const THRESHOLDS = {
  lcpRatio: 0.05,
  lcpFloorMs: 100,
  tbtRatio: 0.05,
  tbtFloorMs: 50,
  clsDelta: 0.01,
};

const PLUGIN_URL_PATTERN = /kotlinskidev-accessibility|kotlinskidev-a11y/;

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const numeric = (report, id) => report?.audits?.[id]?.numericValue;

const observedLcp = (report) => {
  const metrics = report?.audits?.metrics?.details?.items?.[0];
  return Number.isFinite(metrics?.observedLargestContentfulPaint) ? metrics.observedLargestContentfulPaint : numeric(report, 'largest-contentful-paint');
};

const metricMedians = (reports) => {
  const pick = (id) => reports.map((report) => numeric(report, id)).filter(Number.isFinite);
  return {
    runs: reports.length,
    lcp: median(reports.map(observedLcp).filter(Number.isFinite)),
    cls: median(pick('cumulative-layout-shift')),
    tbt: median(pick('total-blocking-time')),
  };
};

const pluginBlockers = (reports) =>
  reports.flatMap((report) =>
    (report.audits?.['render-blocking-resources']?.details?.items ?? [])
      .map((item) => item.url)
      .filter((url) => typeof url === 'string' && PLUGIN_URL_PATTERN.test(url)),
  );

const allowed = (off, ratio, floor) => Math.max(off * ratio, floor);

export const compare = (offReports, onReports, savedReports = [], thresholds = THRESHOLDS) => {
  if (offReports.length === 0 || onReports.length === 0) {
    return { ok: false, failures: ['missing runs: need results for both widget off and widget on'], off: null, on: null, saved: null };
  }
  const off = metricMedians(offReports);
  const on = metricMedians(onReports);
  const failures = [];
  const lcpDelta = on.lcp - off.lcp;
  const tbtDelta = on.tbt - off.tbt;
  const clsDelta = on.cls - off.cls;
  if (lcpDelta > allowed(off.lcp, thresholds.lcpRatio, thresholds.lcpFloorMs)) {
    failures.push(`LCP regressed by ${Math.round(lcpDelta)} ms (off ${Math.round(off.lcp)}, on ${Math.round(on.lcp)})`);
  }
  if (tbtDelta > allowed(off.tbt, thresholds.tbtRatio, thresholds.tbtFloorMs)) {
    failures.push(`TBT regressed by ${Math.round(tbtDelta)} ms (off ${Math.round(off.tbt)}, on ${Math.round(on.tbt)})`);
  }
  if (clsDelta > thresholds.clsDelta) {
    failures.push(`CLS regressed by ${clsDelta.toFixed(4)} (off ${off.cls.toFixed(4)}, on ${on.cls.toFixed(4)})`);
  }
  for (const url of new Set(pluginBlockers(onReports))) {
    failures.push(`render-blocking plugin resource: ${url}`);
  }
  const saved = savedReports.length > 0 ? metricMedians(savedReports) : null;
  if (saved && saved.cls - off.cls > thresholds.clsDelta) {
    failures.push(`CLS with saved state regressed by ${(saved.cls - off.cls).toFixed(4)} (off ${off.cls.toFixed(4)}, saved ${saved.cls.toFixed(4)})`);
  }
  return { ok: failures.length === 0, failures, off, on, saved };
};

export const loadReports = (dir) =>
  readdirSync(dir)
    .filter((name) => /\.report\.json$/.test(name))
    .map((name) => JSON.parse(readFileSync(join(dir, name), 'utf8')));

const main = () => {
  const [offDir, onDir, savedDir] = process.argv.slice(2);
  if (!offDir || !onDir) {
    console.error('usage: lh-compare.mjs <off-dir> <on-dir> [saved-dir]');
    process.exit(2);
  }
  const saved = savedDir ? loadReports(resolve(savedDir)) : [];
  const result = compare(loadReports(resolve(offDir)), loadReports(resolve(onDir)), saved);
  console.log(JSON.stringify({ off: result.off, on: result.on, saved: result.saved }, null, 2));
  if (!result.ok) {
    for (const failure of result.failures) console.error(`FAIL ${failure}`);
    process.exit(1);
  }
  console.log('Lighthouse comparison passed');
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
