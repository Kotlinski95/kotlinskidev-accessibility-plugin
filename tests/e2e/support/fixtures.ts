import { test as base, expect } from '@playwright/test';
import type { APIRequestContext, Locator, Page } from '@playwright/test';
import { AUTH_FILE, BASE_URL } from './env';
import { createSettingsClient } from './settings';
import type { SettingsClient } from './settings';

export const HOST = '#ka11y-root';
export const LAUNCHER = `${HOST} .ka11y-launcher`;
export const PANEL = `${HOST} .ka11y-panel`;

export interface WidgetLocators {
  host: Locator;
  launcher: Locator;
  panel: Locator;
  feature(key: string): Locator;
  profile(key: string): Locator;
  reset: Locator;
}

interface Fixtures {
  admin: APIRequestContext;
  settings: SettingsClient;
  widget: WidgetLocators;
}

export const widgetFor = (page: Page): WidgetLocators => ({
  host: page.locator(HOST),
  launcher: page.locator(LAUNCHER),
  panel: page.locator(PANEL),
  feature: (key: string) => page.locator(`${PANEL} [data-feature="${key}"]`),
  profile: (key: string) => page.locator(`${PANEL} [data-profile="${key}"]`),
  reset: page.locator(`${PANEL} .ka11y-reset`),
});

export const test = base.extend<Fixtures>({
  admin: async ({ playwright }, use) => {
    const context = await playwright.request.newContext({ baseURL: BASE_URL, storageState: AUTH_FILE });
    await use(context);
    await context.dispose();
  },
  settings: async ({ admin }, use) => {
    const client = await createSettingsClient(admin);
    await client.reset();
    await use(client);
    await client.reset();
  },
  widget: async ({ page }, use) => {
    await use(widgetFor(page));
  },
});

export const gotoHome = async (page: Page): Promise<WidgetLocators> => {
  await page.goto('/');
  const widget = widgetFor(page);
  await expect(widget.launcher).toBeVisible();
  return widget;
};

export const openPanel = async (page: Page, widget: WidgetLocators): Promise<void> => {
  await widget.launcher.click();
  await expect(widget.launcher).toHaveAttribute('aria-expanded', 'true');
  await expect(widget.panel).toBeVisible();
  await expect.poll(() => widget.panel.evaluate((panel) => getComputedStyle(panel).opacity)).toBe('1');
};

export { expect };
