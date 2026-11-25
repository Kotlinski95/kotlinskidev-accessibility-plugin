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

export type FixtureName = 'stock' | 'hostile';

export const FIXTURE_NAMES: readonly FixtureName[] = ['stock', 'hostile'];
export const FIXTURE_COOKIE = 'ka11y_fixture';

interface Options {
  fixture: FixtureName;
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

export const test = base.extend<Fixtures & Options>({
  fixture: ['stock', { option: true }],
  context: async ({ context, fixture, baseURL }, use) => {
    await context.addInitScript(() => {
      const spoken: string[] = [];
      Object.defineProperty(window, '__ka11ySpoken', { value: spoken });
      if (!('speechSynthesis' in window)) return;
      const synthesis = window.speechSynthesis;
      synthesis.speak = (utterance: SpeechSynthesisUtterance): void => {
        spoken.push(utterance.text);
      };
      synthesis.cancel = (): void => undefined;
    });
    if (fixture !== 'stock') {
      await context.addCookies([{ name: FIXTURE_COOKIE, value: fixture, url: baseURL ?? BASE_URL }]);
    }
    await use(context);
  },
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

export const PANEL_TIMEOUT = 5_000;

export const waitForPanel = async (widget: WidgetLocators): Promise<void> => {
  await expect(widget.launcher).toHaveAttribute('aria-expanded', 'true', { timeout: PANEL_TIMEOUT });
  await expect(widget.panel).toBeVisible({ timeout: PANEL_TIMEOUT });
  await expect.poll(() => widget.panel.evaluate((panel) => getComputedStyle(panel).opacity), { timeout: PANEL_TIMEOUT }).toBe('1');
};

export const openPanel = async (page: Page, widget: WidgetLocators): Promise<void> => {
  await widget.launcher.click();
  await waitForPanel(widget);
};

export { expect };
