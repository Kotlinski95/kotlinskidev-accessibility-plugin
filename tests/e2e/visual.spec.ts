import type { Locator, Page } from '@playwright/test';
import { expect, gotoHome, openPanel, test } from './support/fixtures';
import type { WidgetLocators } from './support/fixtures';
import { setFixtureLocale } from './support/locale';
import type { FixtureLocale } from './support/locale';

type Scheme = 'light' | 'dark';

interface Viewport {
  name: string;
  width: number;
  height: number;
}

const DESKTOP: Viewport = { name: 'desktop', width: 1280, height: 800 };
const MOBILE: Viewport = { name: 'mobile', width: 390, height: 844 };

interface PanelCase {
  scheme: Scheme;
  viewport: Viewport;
  locale: FixtureLocale;
}

const PANEL_CASES: readonly PanelCase[] = [
  ...(['light', 'dark'] as const).flatMap((scheme) =>
    [DESKTOP, MOBILE].flatMap((viewport) => (['en_US', 'pl_PL'] as const).map((locale) => ({ scheme, viewport, locale })))
  ),
  { scheme: 'light', viewport: DESKTOP, locale: 'he_IL' },
  { scheme: 'dark', viewport: MOBILE, locale: 'he_IL' },
];

const VISUAL_MASKS = (widget: WidgetLocators): Locator[] => [widget.panel.locator('#ka11y-skip-select')];

const settle = async (page: Page, widget: WidgetLocators): Promise<void> => {
  await page.mouse.move(0, 0);
  await expect(widget.panel.locator('#ka11y-panel-title')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
};

test.describe('@visual panel', () => {
  test.beforeEach(async ({ settings }) => {
    await settings.reset();
  });

  for (const { scheme, viewport, locale } of PANEL_CASES) {
    test(`panel ${viewport.name} ${scheme} ${locale} @visual`, async ({ page, context }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ colorScheme: scheme });
      await setFixtureLocale(context, locale);
      const widget = await gotoHome(page);
      await openPanel(page, widget);
      await expect(widget.host).toHaveAttribute('data-theme', scheme);
      await settle(page, widget);
      await expect(widget.panel).toHaveScreenshot(`panel-${viewport.name}-${scheme}-${locale}.png`, { mask: VISUAL_MASKS(widget) });
    });
  }

  test('panel desktop light en_US forced colors @visual', async ({ page, context }) => {
    await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
    await page.emulateMedia({ colorScheme: 'light', forcedColors: 'active' });
    await setFixtureLocale(context, 'en_US');
    const widget = await gotoHome(page);
    await openPanel(page, widget);
    await settle(page, widget);
    await expect(widget.panel).toHaveScreenshot('panel-desktop-light-en_US-forced-colors.png', { mask: VISUAL_MASKS(widget) });
  });

  test('panel desktop light en_US with active state @visual', async ({ page, context }) => {
    await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
    await page.emulateMedia({ colorScheme: 'light' });
    await setFixtureLocale(context, 'en_US');
    const widget = await gotoHome(page);
    await openPanel(page, widget);
    for (const key of ['letterSpacing', 'bigCursor', 'highlightLinks']) {
      await widget.panel.locator(`button[data-feature="${key}"]`).click();
    }
    const plus = widget.panel.locator('.ka11y-stepper[data-feature="biggerText"] [data-step="1"]');
    await plus.click();
    await plus.click();
    const align = widget.panel.locator('button[data-feature="textAlign"]');
    await align.click();
    await align.click();
    await widget.panel.locator('[data-profile]').first().click();
    await expect(widget.panel.locator('.ka11y-tile[aria-pressed="true"]').first()).toBeVisible();
    await settle(page, widget);
    await expect(widget.panel).toHaveScreenshot('panel-desktop-light-en_US-active-state.png', { mask: VISUAL_MASKS(widget) });
  });
});

test.describe('@visual launcher', () => {
  test.beforeEach(async ({ settings }) => {
    await settings.reset();
  });

  for (const mode of ['light', 'dark', 'forced-colors'] as const) {
    test(`launcher ${mode} @visual`, async ({ page, context }) => {
      await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
      await page.emulateMedia({ colorScheme: mode === 'dark' ? 'dark' : 'light', forcedColors: mode === 'forced-colors' ? 'active' : 'none' });
      await setFixtureLocale(context, 'en_US');
      const widget = await gotoHome(page);
      await page.mouse.move(0, 0);
      await expect(widget.launcher).toHaveScreenshot(`launcher-${mode}.png`);
    });
  }
});
