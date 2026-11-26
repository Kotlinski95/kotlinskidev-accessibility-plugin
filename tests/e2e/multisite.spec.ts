import { expect, test } from '@playwright/test';
import type { APIRequestContext, Browser, BrowserContext } from '@playwright/test';
import {
  NETWORK_PAGE,
  NETWORK_URL,
  SITE_PAGE,
  SUBADMIN_PASSWORD,
  SUBADMIN_USER,
  SUBSITE_URL,
  SUPER_PASSWORD,
  SUPER_USER,
  ensureSubadmin,
  loginState,
  multisiteCli,
  networkRoute,
  readNonceFrom,
  resetNetworkState,
  siteRoute,
} from './support/multisite';

type StorageState = Awaited<ReturnType<typeof loginState>>;

interface Session {
  api: APIRequestContext;
  headers: { 'X-WP-Nonce': string };
}

const NETWORK_KEY = 'ka11y-network';
const SITE_KEY = 'ka11y-site';

let superState: StorageState;
let subState: StorageState;

const open = async (browser: Browser, state: StorageState): Promise<BrowserContext> => browser.newContext({ storageState: state });

const session = async (context: BrowserContext, page: string): Promise<Session> => {
  const api = context.request;
  return { api, headers: { 'X-WP-Nonce': await readNonceFrom(api, page) } };
};

const storageKeyOf = async (admin: Session): Promise<unknown> => {
  const response = await admin.api.get(siteRoute('settings'), { headers: admin.headers });
  const body = (await response.json()) as { storage: { key: unknown } };
  return body.storage.key;
};

test.describe('multisite network defaults', () => {
  test.beforeAll(async () => {
    ensureSubadmin();
    superState = await loginState(NETWORK_URL, SUPER_USER, SUPER_PASSWORD);
    subState = await loginState(NETWORK_URL, SUBADMIN_USER, SUBADMIN_PASSWORD);
  });

  test.beforeEach(() => {
    resetNetworkState();
  });

  test.afterAll(() => {
    resetNetworkState();
  });

  test('a network default reaches a subsite that has not overridden it', async ({ browser }) => {
    const superContext = await open(browser, superState);
    const subContext = await open(browser, subState);
    const network = await session(superContext, NETWORK_PAGE);
    const response = await network.api.post(networkRoute('settings'), { headers: network.headers, data: { storage: { key: NETWORK_KEY } } });
    expect(response.status()).toBe(200);
    const sub = await session(subContext, `${SUBSITE_URL}${SITE_PAGE}`);
    expect(await storageKeyOf(sub)).toBe(NETWORK_KEY);
    const page = await subContext.newPage();
    await page.goto(`${SUBSITE_URL}${SITE_PAGE}`);
    await page.getByRole('tab', { name: 'Behavior' }).click();
    await expect(page.getByLabel('Storage key')).toHaveValue(NETWORK_KEY);
    await superContext.close();
    await subContext.close();
  });

  test('a site override wins over later network changes', async ({ browser }) => {
    const superContext = await open(browser, superState);
    const subContext = await open(browser, subState);
    const network = await session(superContext, NETWORK_PAGE);
    const sub = await session(subContext, `${SUBSITE_URL}${SITE_PAGE}`);
    await network.api.post(networkRoute('settings'), { headers: network.headers, data: { storage: { key: NETWORK_KEY } } });
    const saved = await sub.api.post(siteRoute('settings'), { headers: sub.headers, data: { storage: { key: SITE_KEY } } });
    expect(saved.status()).toBe(200);
    await network.api.post(networkRoute('settings'), { headers: network.headers, data: { storage: { key: 'ka11y-network-2' } } });
    expect(await storageKeyOf(sub)).toBe(SITE_KEY);
    await sub.api.post(siteRoute('reset'), { headers: sub.headers });
    expect(await storageKeyOf(sub)).toBe('ka11y-network-2');
    await superContext.close();
    await subContext.close();
  });

  test('a network lock blocks the site write with 409 and disables the field', async ({ browser }) => {
    const superContext = await open(browser, superState);
    const subContext = await open(browser, subState);
    const network = await session(superContext, NETWORK_PAGE);
    const sub = await session(subContext, `${SUBSITE_URL}${SITE_PAGE}`);
    const locked = await network.api.post(networkRoute('settings'), {
      headers: network.headers,
      data: { storage: { key: NETWORK_KEY }, locked: ['storage.key'] },
    });
    expect(locked.status()).toBe(200);
    const blocked = await sub.api.post(siteRoute('settings'), { headers: sub.headers, data: { storage: { key: SITE_KEY } } });
    expect(blocked.status()).toBe(409);
    const body = (await blocked.json()) as { code: string; data: { paths: string[] } };
    expect(body.code).toBe('kotlinskidev_a11y_locked');
    expect(body.data.paths).toEqual(['storage.key']);
    expect(await storageKeyOf(sub)).toBe(NETWORK_KEY);
    const page = await subContext.newPage();
    await page.goto(`${SUBSITE_URL}${SITE_PAGE}`);
    await page.getByRole('tab', { name: 'Behavior' }).click();
    await expect(page.getByLabel('Storage key')).toBeDisabled();
    await superContext.close();
    await subContext.close();
  });

  test('the network admin page saves defaults and locks through the shared admin app', async ({ browser }) => {
    const superContext = await open(browser, superState);
    const page = await superContext.newPage();
    await page.goto(`${NETWORK_URL}${NETWORK_PAGE}`);
    await expect(page.getByRole('heading', { name: 'Accessibility network defaults' })).toBeVisible();
    await page.getByRole('tab', { name: 'Behavior' }).click();
    await page.getByLabel('Storage key').fill(NETWORK_KEY);
    await page.getByRole('tab', { name: 'Maintenance' }).click();
    await expect(page.getByRole('heading', { name: 'Locked on all sites' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Uninstall' })).toHaveCount(0);
    await page.getByLabel('Locked settings').fill('storage.key');
    await page.getByLabel('Locked settings').blur();
    await page.getByRole('button', { name: 'Save changes' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog.locator('tbody th', { hasText: 'storage.key' })).toBeVisible();
    await expect(dialog.locator('tbody th', { hasText: 'locked' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Settings saved.')).toBeVisible();
    await page.reload();
    await page.getByRole('tab', { name: 'Maintenance' }).click();
    await expect(page.getByLabel('Locked settings')).toHaveValue('storage.key');
    const subContext = await open(browser, subState);
    const sub = await session(subContext, `${SUBSITE_URL}${SITE_PAGE}`);
    expect(await storageKeyOf(sub)).toBe(NETWORK_KEY);
    await superContext.close();
    await subContext.close();
  });

  test('a subsite administrator cannot reach the network routes or the network page', async ({ browser }) => {
    const subContext = await open(browser, subState);
    const sub = await session(subContext, `${SUBSITE_URL}${SITE_PAGE}`);
    for (const route of ['settings', 'schema', 'export']) {
      const response = await sub.api.get(`${SUBSITE_URL}/?rest_route=/kotlinskidev-a11y/v1/network/${route}`, { headers: sub.headers });
      expect(response.status()).toBe(403);
    }
    const write = await sub.api.post(`${SUBSITE_URL}/?rest_route=/kotlinskidev-a11y/v1/network/settings`, {
      headers: sub.headers,
      data: { storage: { key: SITE_KEY } },
    });
    expect(write.status()).toBe(403);
    const withoutNonce = await sub.api.get(networkRoute('settings'));
    expect([401, 403]).toContain(withoutNonce.status());
    const page = await subContext.newPage();
    const navigation = await page.goto(`${NETWORK_URL}${NETWORK_PAGE}`);
    expect(navigation?.status()).not.toBe(200);
    await expect(page.locator('#kotlinskidev-a11y-admin')).toHaveCount(0);
    await subContext.close();
  });

  test('wp ka11y settings --network writes the network defaults a subsite inherits', async ({ browser }) => {
    multisiteCli('ka11y', 'settings', 'set', 'storage.key', 'ka11y-cli', '--network');
    const subContext = await open(browser, subState);
    const sub = await session(subContext, `${SUBSITE_URL}${SITE_PAGE}`);
    expect(await storageKeyOf(sub)).toBe('ka11y-cli');
    const network = JSON.parse(multisiteCli('ka11y', 'settings', 'get', 'storage.key', '--network', '--layer=stored').replace(/^[^"]*/u, '')) as unknown;
    expect(network).toBe('ka11y-cli');
    multisiteCli('ka11y', 'settings', 'reset', '--network', '--yes');
    expect(await storageKeyOf(sub)).not.toBe('ka11y-cli');
    await subContext.close();
  });

  test('unauthenticated requests to the network routes are rejected', async ({ playwright }) => {
    const anonymous = await playwright.request.newContext();
    for (const route of ['settings', 'schema', 'export']) {
      expect([401, 403]).toContain((await anonymous.get(networkRoute(route))).status());
    }
    expect([401, 403]).toContain((await anonymous.post(networkRoute('settings'), { data: {} })).status());
    await anonymous.dispose();
  });
});
