import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { tryWpCli, wpCli } from './wp-cli';

const ROOT = resolve(__dirname, '..', '..', '..');
const RELEASES_DIR = resolve(ROOT, 'tests', '.releases');
const CONTAINER_PLUGINS = '/var/www/html/wp-content/plugins';
const RELEASE_FOLDER = 'ka11y-release';
const RELEASE_PLUGIN = `${RELEASE_FOLDER}/kotlinskidev-accessibility.php`;
const CURRENT_PLUGIN = 'kotlinskidev-accessibility';
const OPTION_NAME = 'kotlinskidev_a11y_settings';

interface ReleaseManifest {
  repo: string;
  asset: string;
  versions: string[];
}

export type SettingsTree = Record<string, unknown>;

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));

const manifest = (): ReleaseManifest => readJson(resolve(ROOT, 'tests', 'fixtures', 'releases.json')) as ReleaseManifest;

export const releaseVersions = (): string[] => manifest().versions;

export const settingsFixture = (name: string): string => readFileSync(resolve(ROOT, 'tests', 'fixtures', 'settings', `${name}.json`), 'utf8');

export const expectedSettings = (version: string): SettingsTree => readJson(resolve(ROOT, 'tests', 'fixtures', 'settings', `${version}.expected.json`)) as SettingsTree;

const run = (command: string, args: string[]): string => execFileSync(command, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const containerName = (): string => {
  const name = run('docker', ['ps', '--filter', 'publish=8889', '--filter', 'name=-wordpress-1', '--format', '{{.Names}}']).trim().split('\n')[0];
  if (name === undefined || name === '') throw new Error('wp-env WordPress container on port 8889 not found');
  return name;
};

export const fetchRelease = (version: string): string => {
  const { repo, asset } = manifest();
  const target = resolve(RELEASES_DIR, `v${version}`);
  const extracted = resolve(target, 'extracted');
  if (existsSync(resolve(extracted, 'kotlinskidev-accessibility', 'kotlinskidev-accessibility.php'))) return resolve(extracted, 'kotlinskidev-accessibility');
  mkdirSync(extracted, { recursive: true });
  run('gh', ['release', 'download', `v${version}`, '--repo', repo, '--pattern', asset, '--dir', target, '--clobber']);
  run('unzip', ['-q', '-o', resolve(target, asset), '-d', extracted]);
  const [folder] = readdirSync(extracted);
  if (folder === undefined) throw new Error(`Release v${version} zip is empty`);
  return resolve(extracted, folder);
};

export const resetPluginData = (): void => {
  const names = wpCli('option', 'list', '--search=*kotlinskidev_a11y*', '--field=option_name').split('\n').map((line) => line.trim()).filter((line) => /^[\w.-]+$/.test(line));
  for (const name of names) wpCli('option', 'delete', name);
};

export const removeRelease = (): void => {
  tryWpCli('plugin', 'deactivate', RELEASE_FOLDER);
  run('docker', ['exec', '-u', 'root', containerName(), 'rm', '-rf', `${CONTAINER_PLUGINS}/${RELEASE_FOLDER}`]);
};

export const installRelease = (version: string): void => {
  const container = containerName();
  const source = fetchRelease(version);
  run('docker', ['exec', '-u', 'root', container, 'rm', '-rf', `${CONTAINER_PLUGINS}/${RELEASE_FOLDER}`]);
  run('docker', ['cp', source, `${container}:${CONTAINER_PLUGINS}/${RELEASE_FOLDER}`]);
  run('docker', ['exec', '-u', 'root', container, 'chown', '-R', 'www-data:www-data', `${CONTAINER_PLUGINS}/${RELEASE_FOLDER}`]);
};

export const activateRelease = (): void => {
  tryWpCli('plugin', 'deactivate', CURRENT_PLUGIN);
  wpCli('plugin', 'activate', RELEASE_PLUGIN);
};

export const activateCurrent = (): void => {
  tryWpCli('plugin', 'deactivate', RELEASE_FOLDER);
  wpCli('plugin', 'activate', CURRENT_PLUGIN);
};

export const seedSettings = (json: string): void => {
  wpCli('option', 'update', OPTION_NAME, json, '--format=json');
};

const NOISE = /^(ℹ|✔|✖)/u;

export const effectiveSettings = (): SettingsTree => {
  const output = wpCli('ka11y', 'settings', 'get', '--format=json', '--quiet')
    .split('\n')
    .filter((line) => !NOISE.test(line))
    .join('\n')
    .trim();
  return JSON.parse(output) as SettingsTree;
};
