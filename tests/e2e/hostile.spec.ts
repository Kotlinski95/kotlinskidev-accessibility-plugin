import { expect, test } from './support/fixtures';
import { reopen } from './support/flows';
import type { Page } from '@playwright/test';
import { assertPageUsable, installLongContent } from './support/invariants';

const filterOf = (page: Page, id: string): Promise<string> =>
  page.evaluate((target) => (document.getElementById(target) ? getComputedStyle(document.getElementById(target) as HTMLElement).filter : 'missing'), id);

const FILTER_FEATURES = ['highContrast', 'monochrome', 'saturation'];

test.describe('hostile fixture specifics', () => {
  test.use({ fixture: 'hostile' });

  test.beforeEach(async ({ settings, page }) => {
    await settings.reset();
    await installLongContent(page);
  });

  for (const key of FILTER_FEATURES) {
    test(`${key}: late and runtime appended body nodes are filtered, then restored on reset`, async ({ page }) => {
      const widget = await reopen(page);
      await page.waitForSelector('#late-node', { state: 'attached' });
      await widget.feature(key).click();
      await page.keyboard.press('Escape');

      await expect.poll(() => filterOf(page, 'late-node')).not.toBe('none');
      await page.evaluate(() => {
        const node = document.createElement('div');
        node.id = 'runtime-node';
        node.textContent = 'Runtime appended node';
        document.body.append(node);
      });
      await expect.poll(() => filterOf(page, 'runtime-node')).not.toBe('none');
      await assertPageUsable(page);

      await widget.launcher.click();
      await widget.reset.click();
      for (const id of ['late-node', 'runtime-node', 'hostile-wrapper']) {
        await expect.poll(() => filterOf(page, id)).toBe('none');
      }
      expect(await page.evaluate(() => document.getElementById('late-node')?.hasAttribute('style'))).toBe(false);
      await assertPageUsable(page);
    });
  }

  test('reading mask and line overlays exist, follow the pointer and never intercept it', async ({ page }) => {
    const widget = await reopen(page);
    await widget.feature('readingMask').click();
    await widget.feature('readingLine').click();
    await page.keyboard.press('Escape');
    await page.mouse.move(300, 400);
    await page.mouse.move(320, 420);
    await expect.poll(() => page.locator('[data-ka11y-overlay]').count()).toBeGreaterThanOrEqual(2);
    await assertPageUsable(page);
    const hit = await page.evaluate(() => document.elementFromPoint(320, 420)?.hasAttribute('data-ka11y-overlay'));
    expect(hit).toBe(false);
  });

  test('cookie wall button receives a real click while every feature is on', async ({ page }) => {
    const widget = await reopen(page);
    for (const key of ['biggerText', 'highContrast', 'readingMask', 'stopAnimations', 'hideImages']) {
      await widget.feature(key).click();
    }
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      document.getElementById('cookie-accept')?.addEventListener('click', () => document.body.setAttribute('data-consented', 'yes'));
    });
    await page.locator('#cookie-accept').click();
    await expect(page.locator('body')).toHaveAttribute('data-consented', 'yes');
  });
});
