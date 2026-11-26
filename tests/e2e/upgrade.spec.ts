import type { Page } from '@playwright/test';
import { expect, gotoHome, openPanel, test, widgetFor } from './support/fixtures';
import { BASE_URL } from './support/env';
import {
  activateCurrent,
  activateRelease,
  effectiveSettings,
  expectedSettings,
  installRelease,
  releaseVersions,
  removeRelease,
  resetPluginData,
  seedSettings,
  settingsFixture,
} from './support/releases';

const STATE_CLASS = /^ka11y-/;

const stateClasses = (page: Page): Promise<string[]> =>
  page.evaluate((pattern) => [...document.documentElement.classList].filter((name) => new RegExp(pattern).test(name)).sort(), STATE_CLASS.source);

const savedState = async (page: Page): Promise<string | undefined> =>
  (await page.context().cookies()).find((cookie) => cookie.name === 'ka11y')?.value;

test.describe('@upgrade upgrade from every release', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test.afterAll(() => {
    removeRelease();
    resetPluginData();
    activateCurrent();
  });

  for (const version of releaseVersions()) {
    test(`v${version} to the current build keeps settings and visitor state @upgrade`, async ({ page, admin }) => {
      resetPluginData();
      installRelease(version);
      activateRelease();
      seedSettings(settingsFixture(version));
      expect((await admin.get('/wp-admin/')).ok()).toBe(true);

      const widget = await gotoHome(page);
      await openPanel(page, widget);
      await widget.feature('highlightLinks').click();
      const plus = widget.feature('biggerText');
      await plus.click();
      await plus.click();
      await page.keyboard.press('Escape');
      const classesBefore = await stateClasses(page);
      const stateBefore = await savedState(page);
      expect(stateBefore).toBeDefined();
      expect(classesBefore.length).toBeGreaterThan(0);

      activateCurrent();
      expect((await admin.get('/wp-admin/')).ok()).toBe(true);

      expect(effectiveSettings()).toEqual(expectedSettings(version));

      await page.goto(BASE_URL);
      await expect(widgetFor(page).launcher).toBeVisible();
      expect(await stateClasses(page)).toEqual(classesBefore);
      expect(await savedState(page)).toEqual(stateBefore);
      await openPanel(page, widgetFor(page));
      await expect(widgetFor(page).panel).toBeVisible();
    });
  }
});
