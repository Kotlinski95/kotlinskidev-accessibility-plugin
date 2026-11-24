import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.WP_BASE_URL ?? 'http://localhost:8889';
const isCi = process.env.CI !== undefined && process.env.CI !== '';
const crossBrowser = process.env.KA11Y_CROSS_BROWSER === '1';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: isCi ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile-smoke',
      testMatch: ['**/invariants.spec.ts'],
      grep: /@smoke/,
      use: { ...devices['Pixel 5'] },
    },
    ...(crossBrowser
      ? [
          { name: 'firefox', grep: /@smoke/, use: { ...devices['Desktop Firefox'] } },
          { name: 'webkit', grep: /@smoke/, use: { ...devices['Desktop Safari'] } },
        ]
      : []),
  ],
});
