import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SEMVER = /^\d+\.\d+\.\d+$/;
const HEADER_PATTERN = /^(\s*\*\s*Version:\s*)(\S+)/m;
const CONSTANT_PATTERN = /(define\(\s*'KOTLINSKIDEV_A11Y_VERSION',\s*')([^']+)(')/;
const CHANGELOG_HEADING = /^## \[(\d+\.\d+\.\d+)\]/m;

export const files = (root) => ({
  plugin: join(root, 'kotlinskidev-accessibility.php'),
  pkg: join(root, 'package.json'),
  lock: join(root, 'package-lock.json'),
  changelog: join(root, 'CHANGELOG.md')
});

export const readVersions = (root, tag = '') => {
  const paths = files(root);
  const plugin = readFileSync(paths.plugin, 'utf8');
  const changelog = readFileSync(paths.changelog, 'utf8');
  const versions = {
    'plugin header': plugin.match(HEADER_PATTERN)?.[2],
    'package.json': JSON.parse(readFileSync(paths.pkg, 'utf8')).version,
    'CHANGELOG heading': changelog.match(CHANGELOG_HEADING)?.[1]
  };
  const constant = plugin.match(CONSTANT_PATTERN)?.[2];
  if (constant !== undefined) {
    versions['KOTLINSKIDEV_A11Y_VERSION'] = constant;
  }
  if (tag.startsWith('v')) {
    versions['git tag'] = tag.slice(1);
  }
  return versions;
};

export const findMismatch = (versions) => {
  const entries = Object.entries(versions);
  const missing = entries.filter(([, value]) => !value || !SEMVER.test(value));
  if (missing.length > 0) {
    return `Missing or invalid version in: ${missing.map(([name]) => name).join(', ')}`;
  }
  if (new Set(entries.map(([, value]) => value)).size > 1) {
    return `Version mismatch: ${entries.map(([name, value]) => `${name}=${value}`).join(', ')}`;
  }
  return null;
};

export const bumpVersion = (current, level) => {
  const [major, minor, patch] = current.split('.').map(Number);
  if (level === 'major') {
    return `${major + 1}.0.0`;
  }
  if (level === 'minor') {
    return `${major}.${minor + 1}.0`;
  }
  return `${major}.${minor}.${patch + 1}`;
};

export const releaseChangelog = (changelog, version, date) => {
  const marker = '## [Unreleased]';
  const start = changelog.indexOf(marker);
  if (start === -1) {
    throw new Error('CHANGELOG.md has no [Unreleased] section');
  }
  const bodyStart = start + marker.length;
  const rest = changelog.slice(bodyStart);
  const nextHeading = rest.search(/^## \[/m);
  const body = nextHeading === -1 ? rest : rest.slice(0, nextHeading);
  const tail = nextHeading === -1 ? '' : rest.slice(nextHeading);
  if (body.trim() === '') {
    throw new Error('[Unreleased] section is empty');
  }
  return `${changelog.slice(0, start)}${marker}\n\n## [${version}] - ${date}\n\n${body.trim()}\n\n${tail}`.replace(/\n+$/, '\n');
};

export const applyVersion = (root, version, date) => {
  const paths = files(root);
  const plugin = readFileSync(paths.plugin, 'utf8')
    .replace(HEADER_PATTERN, `$1${version}`)
    .replace(CONSTANT_PATTERN, `$1${version}$3`);
  const pkg = JSON.parse(readFileSync(paths.pkg, 'utf8'));
  pkg.version = version;
  const lock = JSON.parse(readFileSync(paths.lock, 'utf8'));
  lock.version = version;
  if (lock.packages?.['']) {
    lock.packages[''].version = version;
  }
  const changelog = releaseChangelog(readFileSync(paths.changelog, 'utf8'), version, date);
  writeFileSync(paths.plugin, plugin);
  writeFileSync(paths.pkg, `${JSON.stringify(pkg, null, 2)}\n`);
  writeFileSync(paths.lock, `${JSON.stringify(lock, null, 2)}\n`);
  writeFileSync(paths.changelog, changelog);
};
