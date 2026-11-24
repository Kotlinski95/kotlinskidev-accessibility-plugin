import { expect, gotoHome, openPanel } from './fixtures';
import type { WidgetLocators } from './fixtures';
import { assertPageUsable, FEATURE_LEVELS, kebab } from './invariants';
import type { Page } from '@playwright/test';

export const ALL_FEATURE_CLASSES: readonly string[] = Object.keys(FEATURE_LEVELS).map((feature) => `ka11y-${kebab(feature)}`);

export const reopen = async (page: Page): Promise<WidgetLocators> => {
  const widget = await gotoHome(page);
  await openPanel(page, widget);
  return widget;
};

export const expectClassesAbsent = async (page: Page, classes: readonly string[]): Promise<void> => {
  for (const className of classes) {
    await expect(page.locator('html')).not.toHaveClass(new RegExp(`(^|\\s)${className}(\\s|$)`));
  }
};

export const resetAndAssert = async (page: Page, featureClasses: readonly string[]): Promise<void> => {
  const widget = await reopen(page);
  await widget.reset.click();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('ka11y'))).toBeNull();
  await expectClassesAbsent(page, featureClasses);
  await page.keyboard.press('Escape');
  await assertPageUsable(page);
  await page.reload();
  await expectClassesAbsent(page, featureClasses);
  await assertPageUsable(page);
};
