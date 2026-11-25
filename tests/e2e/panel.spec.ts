import { expect, gotoHome, openPanel, test, waitForPanel, widgetFor } from './support/fixtures';
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
    await waitForPanel(widget);
    await page.waitForTimeout(100);
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

  test('is non-modal: focus is not trapped and the page stays reachable', async ({ page }) => {
    const widget = await gotoHome(page);
    await openPanel(page, widget);
    await expect(widget.panel).not.toHaveAttribute('aria-modal', /.*/);
    const countFocusable = await widget.panel.evaluate(
      (panel) =>
        [...panel.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
          (element) => !element.hasAttribute('disabled') && element.closest('[hidden]') === null
        ).length
    );
    expect(countFocusable).toBeGreaterThan(2);
    let leftPanel = false;
    for (let step = 0; step < countFocusable * 2 + 6 && !leftPanel; step += 1) {
      await page.keyboard.press('Tab');
      leftPanel = await page.evaluate(() => {
        const shadow = document.querySelector('#ka11y-root')?.shadowRoot;
        return !shadow?.activeElement || shadow.activeElement.closest('.ka11y-panel') === null;
      });
    }
    expect(leftPanel).toBe(true);
  });
});
