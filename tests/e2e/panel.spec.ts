import { expect, gotoHome, openPanel, test, widgetFor } from './support/fixtures';
import { OPEN_HASH } from './support/env';

test.describe('panel open and close', () => {
  test.beforeEach(async ({ settings }) => {
    await settings.reset();
  });

  test('opens with Enter on the launcher', async ({ page }) => {
    const widget = await gotoHome(page);
    await widget.launcher.focus();
    await page.keyboard.press('Enter');
    await expect(widget.launcher).toHaveAttribute('aria-expanded', 'true');
    await expect(widget.panel).toBeVisible();
    await expect(widget.panel).not.toHaveAttribute('inert', '');
  });

  test('opens from the URL hash', async ({ page }) => {
    await page.goto(`/${OPEN_HASH}`);
    const widget = widgetFor(page);
    await expect(widget.panel).toBeVisible();
    await expect(widget.launcher).toHaveAttribute('aria-expanded', 'true');
  });

  test('opens from an in-page link to the hash', async ({ page }) => {
    const widget = await gotoHome(page);
    await page.evaluate((hash) => {
      const link = document.createElement('a');
      link.href = hash;
      link.id = 'open-link';
      link.textContent = 'Open accessibility';
      document.body.prepend(link);
    }, OPEN_HASH);
    await page.locator('#open-link').click();
    await expect(widget.panel).toBeVisible();
  });

  test('opens with Alt+Shift+A and toggles closed', async ({ page }) => {
    const widget = await gotoHome(page);
    await page.keyboard.press('Alt+Shift+A');
    await expect(widget.panel).toBeVisible();
    await page.keyboard.press('Alt+Shift+A');
    await expect(widget.launcher).toHaveAttribute('aria-expanded', 'false');
  });

  test('Escape closes the panel and returns focus to the launcher', async ({ page }) => {
    const widget = await gotoHome(page);
    await openPanel(page, widget);
    await page.keyboard.press('Escape');
    await expect(widget.launcher).toHaveAttribute('aria-expanded', 'false');
    await expect(widget.panel).toHaveAttribute('inert', '');
    const focusedIsLauncher = await page.evaluate(() => {
      const shadow = document.querySelector('#ka11y-root')?.shadowRoot;
      return shadow?.activeElement?.classList.contains('ka11y-launcher') === true;
    });
    expect(focusedIsLauncher).toBe(true);
  });

  test('traps focus inside the open panel', async ({ page }) => {
    const widget = await gotoHome(page);
    await openPanel(page, widget);
    const countFocusable = await widget.panel.evaluate(
      (panel) =>
        [...panel.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
          (element) => !element.hasAttribute('disabled') && element.closest('[hidden]') === null
        ).length
    );
    expect(countFocusable).toBeGreaterThan(2);
    for (let step = 0; step < countFocusable * 2 + 3; step += 1) {
      await page.keyboard.press('Tab');
      const insidePanel = await page.evaluate(() => {
        const active = document.querySelector('#ka11y-root')?.shadowRoot?.activeElement;
        return active?.closest('.ka11y-panel') !== null && active !== null && active !== undefined;
      });
      expect(insidePanel).toBe(true);
    }
    await page.keyboard.press('Shift+Tab');
    const stillInside = await page.evaluate(() => {
      const active = document.querySelector('#ka11y-root')?.shadowRoot?.activeElement;
      return active?.closest('.ka11y-panel') !== null && active !== null && active !== undefined;
    });
    expect(stillInside).toBe(true);
  });
});
