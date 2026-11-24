import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { request } from '@playwright/test';
import { ADMIN_PASSWORD, ADMIN_USER, AUTH_FILE, BASE_URL } from './support/env';

const LOGIN_PATH = '/wp-login.php';
const TEST_COOKIE = 'wordpress_test_cookie=WP%20Cookie%20check';

const globalSetup = async (): Promise<void> => {
  const context = await request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { Cookie: TEST_COOKIE } });
  const response = await context.post(LOGIN_PATH, {
    form: {
      log: ADMIN_USER,
      pwd: ADMIN_PASSWORD,
      'wp-submit': 'Log In',
      redirect_to: `${BASE_URL}/wp-admin/`,
      testcookie: '1',
    },
    maxRedirects: 0,
  });
  if (response.status() !== 302) throw new Error(`Admin login failed with status ${response.status()}`);
  mkdirSync(dirname(AUTH_FILE), { recursive: true });
  await context.storageState({ path: AUTH_FILE });
  await context.dispose();
};

export default globalSetup;
