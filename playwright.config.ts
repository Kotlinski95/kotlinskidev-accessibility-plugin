import { defineConfig, devices } from '@playwright/test';
import type { PlaywrightTestProject } from '@playwright/test';

const baseURL = process.env.WP_BASE_URL ?? 'http://localhost:8889';
const isCi = process.env.CI !== undefined && process.env.CI !== '';
const crossBrowser = process.env.KA11Y_CROSS_BROWSER === '1';

const visualProjects: PlaywrightTestProject[] =
  process.env.KA11Y_VISUAL === '1'
    ? [
        {
          name: 'visual',
          testMatch: ['**/visual.spec.ts'],
          grep: /@visual/,
          snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{testFileName}/{arg}{ext}',
          expect: { toHaveScreenshot: { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.01 } },
          use: { ...devices['Desktop Chrome'], deviceScaleFactor: 1 },
        },
      ]
    : [];

const upgradeSpecs = ['**/upgrade.spec.ts', '**/downgrade.spec.ts'];

const upgradeProjects: PlaywrightTestProject[] =
  process.env.KA11Y_UPGRADE === '1'
    ? [
        {
          name: 'upgrade',
          testMatch: upgradeSpecs,
          grep: /@upgrade/,
          timeout: 180_000,
          use: { ...devices['Desktop Chrome'] },
        },
      ]
    : [];

const multisiteProjects: PlaywrightTestProject[] =
  process.env.KA11Y_MULTISITE === '1'
    ? [
        {
          name: 'multisite',
          testMatch: ['**/multisite.spec.ts'],
          use: { ...devices['Desktop Chrome'], baseURL: process.env.KA11Y_MULTISITE_URL ?? 'http://localhost:8891' },
        },
      ]
    : [];

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  timeout: crossBrowser ? 120_000 : 45_000,
  expect: { timeout: 10_000 },
  reporter: isCi ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', testIgnore: ['**/visual.spec.ts', '**/multisite.spec.ts', ...upgradeSpecs], use: { ...devices['Desktop Chrome'] } },
    ...visualProjects,
    ...upgradeProjects,
    ...multisiteProjects,
    {
      name: 'mobile-smoke',
      testMatch: ['**/invariants.spec.ts'],
      grep: /@smoke/,
      use: { ...devices['Pixel 5'] },
    },
    ...(crossBrowser
      ? [
          { name: 'firefox', grep: /@smoke/, testIgnore: ['**/multisite.spec.ts', ...upgradeSpecs], use: { ...devices['Desktop Firefox'] } },
          { name: 'webkit', grep: /@smoke/, testIgnore: ['**/multisite.spec.ts', ...upgradeSpecs], use: { ...devices['Desktop Safari'] } },
        ]
      : []),
  ],
});
