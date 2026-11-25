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

  test('performance presets fill the fields and editing flips to Custom', async ({ page }) => {
    await page.goto(SETTINGS_PAGE);
    await page.getByRole('tab', { name: 'Performance' }).click();
    const panel = page.getByRole('tabpanel', { name: 'Performance' });
    await expect(panel.getByLabel('Performance preset').locator('option:checked')).toHaveText('Recommended');
    await expect(panel.getByLabel('Script loading').locator('option:checked')).toHaveText('On first interaction');

    await panel.getByLabel('Performance preset').selectOption({ label: 'Compatibility' });
    const refreshed = page.getByRole('tabpanel', { name: 'Performance' });
    await expect(refreshed.getByLabel('Script loading').locator('option:checked')).toHaveText('Immediately');
    await expect(refreshed.getByLabel('Page adjustment styles').locator('option:checked')).toHaveText('Linked stylesheet');
    await expect(refreshed.getByLabel('Skip downloads on devices where the widget is hidden')).not.toBeChecked();

    await refreshed.getByLabel('Script loading').selectOption({ label: 'On first interaction' });
    await expect(page.getByRole('tabpanel', { name: 'Performance' }).getByLabel('Performance preset').locator('option:checked')).toHaveText('Custom');
  });
});
