import AxeBuilder from '@axe-core/playwright';
import { expect, gotoHome, openPanel, test } from './support/fixtures';
import { AUTH_FILE, SETTINGS_PAGE } from './support/env';

const BLOCKING_IMPACTS: readonly string[] = ['serious', 'critical'];

test.describe('accessibility scans', () => {
  test.beforeEach(async ({ settings }) => {
    await settings.reset();
  });

  test('open panel has no serious or critical axe violations', async ({ page }) => {
    const widget = await gotoHome(page);
    await openPanel(page, widget);
    const results = await new AxeBuilder({ page }).include('#ka11y-root').analyze();
    const blocking = results.violations.filter((violation) => BLOCKING_IMPACTS.includes(violation.impact ?? ''));
    expect(blocking.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
  });
});

test.describe('admin settings page', () => {
  test.use({ storageState: AUTH_FILE });

  test.beforeEach(async ({ settings }) => {
    await settings.reset();
  });

  test('loads without console errors and renders the Languages tab', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto(SETTINGS_PAGE);
    await expect(page.locator('#kotlinskidev-a11y-admin .ka11y-tabs').first()).toBeVisible();
    await page.getByRole('tab', { name: 'Languages' }).click();
    await expect(page.getByRole('tabpanel', { name: 'Languages' })).toContainText('Override any widget text per language');
    await expect(page.getByText('Widget labels').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('has no serious or critical axe violations', async ({ page }) => {
    await page.goto(SETTINGS_PAGE);
    await expect(page.locator('#kotlinskidev-a11y-admin .ka11y-tabs').first()).toBeVisible();
    const results = await new AxeBuilder({ page }).include('#kotlinskidev-a11y-admin').analyze();
    const blocking = results.violations.filter((violation) => BLOCKING_IMPACTS.includes(violation.impact ?? ''));
    expect(blocking.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
  });
});
