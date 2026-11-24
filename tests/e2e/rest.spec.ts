import { expect, test } from '@playwright/test';
import { createSettingsClient, settingsRoute } from './support/settings';
import { AUTH_FILE, BASE_URL } from './support/env';

const PROTECTED_ROUTES = ['settings', 'schema', 'export'];

test.describe('REST access control', () => {
  for (const route of PROTECTED_ROUTES) {
    test(`unauthenticated GET ${route} is rejected`, async ({ request }) => {
      const response = await request.get(settingsRoute(route));
      expect([401, 403]).toContain(response.status());
    });
  }

  test('unauthenticated POST settings, import and reset are rejected', async ({ request }) => {
    for (const route of ['settings', 'import', 'reset']) {
      const response = await request.post(settingsRoute(route), { data: {} });
      expect([401, 403]).toContain(response.status());
    }
  });

  test('cookie session without a nonce is rejected', async ({ playwright }) => {
    const context = await playwright.request.newContext({ baseURL: BASE_URL, storageState: AUTH_FILE });
    const response = await context.post(settingsRoute('settings'), { data: { customCss: 'a{}' } });
    expect([401, 403]).toContain(response.status());
    await context.dispose();
  });

  test('admin can read, update and reset settings', async ({ playwright }) => {
    const context = await playwright.request.newContext({ baseURL: BASE_URL, storageState: AUTH_FILE });
    const client = await createSettingsClient(context);
    await client.reset();
    const updated = await client.patch({ customCss: '.e2e{color:red}' });
    expect(updated.customCss).toBe('.e2e{color:red}');
    const read = await client.get();
    expect(read.customCss).toBe('.e2e{color:red}');
    await client.reset();
    const cleared = await client.get();
    expect(cleared.customCss).toBe('');
    await context.dispose();
  });
});
