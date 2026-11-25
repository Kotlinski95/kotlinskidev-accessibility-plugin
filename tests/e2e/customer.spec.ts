import { request as playwrightRequest } from '@playwright/test';
import type { APIRequestContext, BrowserContext } from '@playwright/test';
import { expect, test } from './support/fixtures';
import { BASE_URL, SETTINGS_PAGE } from './support/env';
import { readNonce, settingsRoute } from './support/settings';
import { tryWpCli, wpCli } from './support/wp-cli';

const USER = 'ka11y-customer';
const PASSWORD = 'ka11y-customer-pass-1!';
const CAPABILITY = 'kotlinskidev_a11y_customize';
const TEST_COOKIE = 'wordpress_test_cookie=WP%20Cookie%20check';

const createCustomer = (): void => {
  tryWpCli('user', 'delete', USER, '--yes');
  wpCli('user', 'create', USER, 'customer@example.test', '--role=editor', `--user_pass=${PASSWORD}`);
  wpCli('user', 'add-cap', USER, CAPABILITY);
};

const customerStorageState = async (): Promise<Awaited<ReturnType<APIRequestContext['storageState']>>> => {
  const login = await playwrightRequest.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { Cookie: TEST_COOKIE } });
  const response = await login.post('/wp-login.php', {
    form: { log: USER, pwd: PASSWORD, 'wp-submit': 'Log In', redirect_to: `${BASE_URL}/wp-admin/`, testcookie: '1' },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(302);
  const state = await login.storageState();
  await login.dispose();
  return state;
};

test.describe('customer capability', () => {
  let context: BrowserContext;
  let nonce = '';
  let request: APIRequestContext;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120_000);
    createCustomer();
    context = await browser.newContext({ storageState: await customerStorageState() });
    request = context.request;
    nonce = await readNonce(request);
  });

  test.afterAll(async () => {
    await context.close();
    tryWpCli('user', 'delete', USER, '--yes');
  });

  test.beforeEach(async ({ settings }) => {
    await settings.reset();
  });

  const post = (route: string, data: unknown): ReturnType<APIRequestContext['post']> => request.post(settingsRoute(route), { headers: { 'X-WP-Nonce': nonce }, data });

  test('sees only the Appearance and Languages tabs and no code-like fields', async () => {
    const page = await context.newPage();
    await page.goto(SETTINGS_PAGE);
    const tabs = page.locator('#kotlinskidev-a11y-admin .ka11y-tabs').first();
    await expect(tabs).toBeVisible();
    await expect(tabs.locator(':scope > .ka11y-tabs__list > [role="tab"]')).toHaveText(['Appearance', 'Languages']);
    await expect(page.getByRole('tab', { name: 'Performance' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Import / Export' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Maintenance' })).toHaveCount(0);
    await expect(page.getByLabel('Custom CSS')).toHaveCount(0);
    await expect(page.getByLabel('Dark mode selector')).toHaveCount(0);
    await expect(page.getByLabel('Widget theme')).toBeVisible();
    await expect(page.getByRole('button', { name: /Reset the .* tab/ })).toHaveCount(0);
    await page.close();
  });

  test('saves a label through the admin page', async () => {
    const page = await context.newPage();
    await page.goto(SETTINGS_PAGE);
    await page.getByRole('tab', { name: 'Languages' }).click();
    await page.locator('.ka11y-locale__row input').first().fill('Customer label');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Settings saved.')).toBeVisible();
    await page.close();

    const saved = (await (await request.get(settingsRoute('settings'), { headers: { 'X-WP-Nonce': nonce } })).json()) as { labels: Record<string, Record<string, string>> };
    expect(JSON.stringify(saved.labels)).toContain('Customer label');
  });

  test('REST reads return only the editable subtree', async () => {
    const settings = (await (await request.get(settingsRoute('settings'), { headers: { 'X-WP-Nonce': nonce } })).json()) as Record<string, unknown>;
    expect(Object.keys(settings).sort()).toEqual(['labels', 'panel', 'statement', 'theme', 'tokens']);
    expect(Object.keys(settings.theme as Record<string, unknown>)).toEqual(['mode']);
    const schema = (await (await request.get(settingsRoute('schema'), { headers: { 'X-WP-Nonce': nonce } })).json()) as { access: string; defaults: Record<string, unknown> };
    expect(schema.access).toBe('customer');
    expect(Object.keys(schema.defaults)).not.toContain('performance');
  });

  test('crafted writes to forbidden paths get 403', async ({ settings }) => {
    const before = JSON.stringify(await settings.get());
    for (const body of [
      { performance: { strategy: 'eager' } },
      { performance: { preset: 'compatibility' } },
      { customCss: 'body { display: none }' },
      { theme: { darkSelector: 'body.night' } },
      { tokens: { primary: '#112233' }, storage: { key: 'hijack' } },
    ]) {
      for (const route of ['settings', 'settings&dry_run=true']) {
        const response = await post(route, body);
        expect(response.status(), JSON.stringify(body)).toBe(403);
      }
    }
    expect(JSON.stringify(await settings.get())).toBe(before);
  });

  test('performance.strategy write is rejected with the forbidden paths error', async () => {
    const response = await post('settings', { performance: { strategy: 'eager' } });
    expect(response.status()).toBe(403);
    const body = (await response.json()) as { code: string; data: { paths: string[] } };
    expect(body.code).toBe('kotlinskidev_a11y_forbidden_paths');
    expect(body.data.paths).toEqual(['performance.strategy']);
  });

  test('import, export and reset routes are closed', async () => {
    expect((await post('import', { storage: { key: 'hijack' } })).status()).toBe(403);
    expect((await post('reset', { paths: ['performance'] })).status()).toBe(403);
    expect((await post('reset', {})).status()).toBe(403);
    expect((await request.get(settingsRoute('export'), { headers: { 'X-WP-Nonce': nonce } })).status()).toBe(403);
  });
});
