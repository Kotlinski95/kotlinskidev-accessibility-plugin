import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const valueAt = (manifest, path) => path.split('.').reduce((node, key) => node?.[key], manifest);

const isSkipped = (manifest, path) => {
  const [group, name] = path.split('.');
  return group === 'scripts' && Array.isArray(manifest.skipped) && manifest.skipped.includes(name);
};

const row = (name, metric, actual, limit, status) => ({
  name,
  metric,
  actual,
  limit,
  percent: actual === null ? null : Math.round((actual / limit) * 1000) / 10,
  status,
});

const entryRows = (manifest, metric, limits) =>
  Object.entries(limits ?? {}).map(([path, limit]) => {
    if (isSkipped(manifest, path)) return row(path, metric, null, limit, 'skipped');
    const actual = valueAt(manifest, path)?.[metric];
    if (typeof actual !== 'number') return row(path, metric, null, limit, 'missing');
    return row(path, metric, actual, limit, actual > limit ? 'over' : 'ok');
  });

const sumRows = (manifest, sums) =>
  Object.entries(sums ?? {}).map(([name, rule]) => {
    const parts = rule.of.map((path) => valueAt(manifest, path)?.gzip);
    if (rule.of.some((path) => isSkipped(manifest, path))) return row(`sum.${name}`, 'gzip', null, rule.gzip, 'skipped');
    if (parts.some((part) => typeof part !== 'number')) return row(`sum.${name}`, 'gzip', null, rule.gzip, 'missing');
    const actual = parts.reduce((total, part) => total + part, 0);
    return row(`sum.${name}`, 'gzip', actual, rule.gzip, actual > rule.gzip ? 'over' : 'ok');
  });

export const checkBudget = (manifest, budgets) => {
  const rows = [
    ...entryRows(manifest, 'gzip', budgets.gzip),
    ...entryRows(manifest, 'raw', budgets.raw),
    ...sumRows(manifest, budgets.sum),
  ];
  return { rows, failed: rows.some((item) => item.status === 'over' || item.status === 'missing') };
};

const formatRow = (item) =>
  [
    item.name.padEnd(28),
    item.metric.padEnd(5),
    String(item.actual ?? '-').padStart(7),
    String(item.limit).padStart(7),
    item.percent === null ? '      -' : `${item.percent.toFixed(1)}%`.padStart(7),
    item.status,
  ].join(' ');

const main = () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const manifestPath = process.argv[2] ?? resolve(root, 'build/manifest.json');
  const budgetsPath = process.argv[3] ?? resolve(root, 'bin/budgets.json');
  if (!existsSync(manifestPath)) {
    console.error(`Manifest not found: ${manifestPath}. Run npm run build first.`);
    process.exit(2);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const budgets = JSON.parse(readFileSync(budgetsPath, 'utf8'));
  const { rows, failed } = checkBudget(manifest, budgets);
  rows.forEach((item) => console.log(formatRow(item)));
  if (failed) {
    console.error('Size budget check failed');
    process.exit(1);
  }
  console.log('Size budgets respected');
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
