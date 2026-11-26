import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { request } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { REST_NAMESPACE } from './env';

const ROOT = resolve(__dirname, '..', '..', '..');
const CONFIG = '.wp-env.multisite.json';
type StorageState = Awaited<ReturnType<APIRequestContext['storageState']>>;

const LOGIN_PATH = '/wp-login.php';
const TEST_COOKIE = 'wordpress_test_cookie=WP%20Cookie%20check';
const NONCE_PATTERN = /"restRoot":"[^"]*","nonce":"([a-f0-9]+)"/;

export const NETWORK_URL = process.env.KA11Y_MULTISITE_URL ?? 'http://localhost:8891';
export const SUBSITE_PATH = '/sub';
export const SUBSITE_URL = `${NETWORK_URL}${SUBSITE_PATH}`;
export const NETWORK_PAGE = '/wp-admin/network/settings.php?page=kotlinskidev-accessibility';
export const SITE_PAGE = '/wp-admin/options-general.php?page=kotlinskidev-accessibility';
export const SUBADMIN_USER = 'subadmin';
export const SUBADMIN_PASSWORD = 'password';
export const SUPER_USER = 'admin';
export const SUPER_PASSWORD = 'password';

export const multisiteCli = (...args: string[]): string =>
  execFileSync('npx', ['wp-env', 'run', 'cli', `--config=${CONFIG}`, 'wp', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, WP_ENV_HOME: process.env.WP_ENV_HOME ?? join(homedir(), '.wp-env-ka11y-multisite') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

const tryCli = (...args: string[]): boolean => {
  try {
    multisiteCli(...args);
    return true;
  } catch {
    return false;
  }
};

export const resetNetworkState = (): void => {
  tryCli('site', 'option', 'delete', 'kotlinskidev_a11y_network_settings');
  tryCli('option', 'delete', 'kotlinskidev_a11y_settings', `--url=${SUBSITE_URL}`);
  tryCli('option', 'delete', 'kotlinskidev_a11y_settings', `--url=${NETWORK_URL}`);
};

export const ensureSubadmin = (): void => {
  if (!tryCli('user', 'get', SUBADMIN_USER, '--field=ID')) {
    multisiteCli('user', 'create', SUBADMIN_USER, 'subadmin@example.test', '--role=administrator', `--user_pass=${SUBADMIN_PASSWORD}`, `--url=${SUBSITE_URL}`);
  }
};

export const loginState = async (base: string, user: string, password: string): Promise<StorageState> => {
  const context = await request.newContext({ extraHTTPHeaders: { Cookie: TEST_COOKIE } });
  const response = await context.post(`${base}${LOGIN_PATH}`, {
    form: { log: user, pwd: password, 'wp-submit': 'Log In', testcookie: '1' },
    maxRedirects: 0,
  });
  if (response.status() !== 302) throw new Error(`Login failed with status ${response.status()}`);
  const state = await context.storageState();
  await context.dispose();
  return state;
};

export const readNonceFrom = async (context: APIRequestContext, page: string): Promise<string> => {
  const response = await context.get(page);
  const nonce = NONCE_PATTERN.exec(await response.text())?.[1];
  if (nonce === undefined) throw new Error(`REST nonce not found on ${page}`);
  return nonce;
};

export const siteRoute = (path: string): string => `${SUBSITE_URL}/?rest_route=/${REST_NAMESPACE}/${path}`;
export const networkRoute = (path: string): string => `${NETWORK_URL}/?rest_route=/${REST_NAMESPACE}/network/${path}`;
