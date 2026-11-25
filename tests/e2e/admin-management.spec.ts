import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './support/fixtures';
import { AUTH_FILE, SETTINGS_PAGE } from './support/env';

const BLOCKING_IMPACTS: readonly string[] = ['serious', 'critical'];

test.describe('admin management', () => {
  test.use({ storageState: AUTH_FILE });

  test.beforeEach(async ({ page, settings }) => {
    await settings.reset();
    await page.goto(SETTINGS_PAGE);
    await expect(page.locator('#kotlinskidev-a11y-admin .ka11y-tabs').first()).toBeVisible();
  });

  test('search finds z-index and focuses the control', async ({ page }) => {
    await page.getByRole('searchbox', { name: 'Search settings' }).fill('z-index');
    await expect(page.getByRole('status').filter({ hasText: 'setting found' })).toBeVisible();
    await page.getByRole('button', { name: 'Stacking order (z-index)' }).click();
    await expect(page.getByRole('tab', { name: 'Appearance' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByLabel('Stacking order (z-index)')).toBeFocused();
  });

  test('save preview lists exactly the edited field', async ({ page }) => {
    await page.getByRole('tab', { name: 'Behavior' }).click();
    await page.getByLabel('Storage key').fill('ka11y-e2e');
    await expect(page.getByText('You have 1 unsaved change.')).toBeVisible();
    await page.getByRole('button', { name: 'Save changes' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog.locator('tbody tr')).toHaveCount(1);
    await expect(dialog.locator('tbody th')).toHaveText('storage.key');
    const results = await new AxeBuilder({ page }).include('.ka11y-dialog').analyze();
    expect(results.violations.filter((violation) => BLOCKING_IMPACTS.includes(violation.impact ?? ''))).toEqual([]);
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Settings saved.')).toBeVisible();
  });

  test('per-tab reset previews and restores the defaults', async ({ page }) => {
    await page.getByRole('tab', { name: 'Behavior' }).click();
    await page.getByLabel('Storage key').fill('ka11y-e2e');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Settings saved.')).toBeVisible();
    await page.getByRole('button', { name: 'Reset the Behavior tab' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog.locator('tbody th', { hasText: 'storage.key' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Reset tab' }).click();
    await expect(page.getByText('The Behavior tab was reset to its defaults.')).toBeVisible();
    await expect(page.getByLabel('Storage key')).toHaveValue('ka11y');
  });

  test('unsaved changes trigger the leave guard', async ({ page }) => {
    await page.getByRole('tab', { name: 'Behavior' }).click();
    await page.getByLabel('Storage key').fill('ka11y-dirty');
    const dialogPromise = page.waitForEvent('dialog');
    const closing = page.close({ runBeforeUnload: true });
    const dialog = await dialogPromise;
    expect(dialog.type()).toBe('beforeunload');
    await dialog.dismiss();
    await closing.catch(() => undefined);
  });

  test('maintenance tab holds the uninstall choice', async ({ page }) => {
    await page.getByRole('tab', { name: 'Maintenance' }).click();
    await expect(page.getByLabel('Keep my settings when the plugin is deleted')).not.toBeChecked();
  });

  test('import and export tab has no serious axe violations', async ({ page }) => {
    await page.getByRole('tab', { name: 'Import / Export' }).click();
    const results = await new AxeBuilder({ page }).include('#kotlinskidev-a11y-admin').analyze();
    expect(results.violations.filter((violation) => BLOCKING_IMPACTS.includes(violation.impact ?? ''))).toEqual([]);
  });
});
