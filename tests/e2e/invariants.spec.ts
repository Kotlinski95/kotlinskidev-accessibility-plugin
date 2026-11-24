import { expect, FIXTURE_NAMES, test } from './support/fixtures';
import type { FixtureName } from './support/fixtures';
import { ALL_FEATURE_CLASSES, reopen, resetAndAssert } from './support/flows';
import { assertPageUsable, FEATURE_LEVELS, installLongContent, kebab, PROFILE_KEYS } from './support/invariants';

const SMOKE = '@smoke';

const featureTitle = (fixture: FixtureName, key: string, levels: number): string =>
  `${key}: usable at every level, after reload and after reset${fixture === 'stock' && levels === 1 ? ` ${SMOKE}` : ''}`;

const profileTitle = (fixture: FixtureName, key: string): string =>
  `${key}: usable when applied, after reload and after reset${fixture === 'hostile' ? ` ${SMOKE}` : ''}`;

for (const fixture of FIXTURE_NAMES) {
  test.describe(`[${fixture}]`, () => {
    test.use({ fixture });

    test.describe('page invariants hold for every feature', () => {
      test.beforeEach(async ({ settings, page }) => {
        await settings.reset();
        await installLongContent(page);
      });

      for (const [key, levels] of Object.entries(FEATURE_LEVELS)) {
        test(featureTitle(fixture, key, levels), async ({ page }) => {
          let widget = await reopen(page);
          test.skip((await widget.feature(key).count()) === 0, `${key} is not rendered on this page`);

          for (let level = 1; level <= levels; level += 1) {
            await widget.feature(key).click();
            await expect(widget.feature(key)).toHaveAttribute('aria-pressed', 'true');
            await page.keyboard.press('Escape');
            await assertPageUsable(page);

            await page.reload();
            await assertPageUsable(page);
            widget = await reopen(page);
            await expect(widget.feature(key)).toHaveAttribute('aria-pressed', 'true');
          }

          await resetAndAssert(page, [`ka11y-${kebab(key)}`]);
        });

        if (fixture === 'stock' && levels > 1) {
          test(`${key}: level 1 is usable ${SMOKE}`, async ({ page }) => {
            const widget = await reopen(page);
            test.skip((await widget.feature(key).count()) === 0, `${key} is not rendered on this page`);
            await widget.feature(key).click();
            await expect(widget.feature(key)).toHaveAttribute('aria-pressed', 'true');
            await page.keyboard.press('Escape');
            await assertPageUsable(page);
            await resetAndAssert(page, [`ka11y-${kebab(key)}`]);
          });
        }
      }
    });

    test.describe('page invariants hold for every profile', () => {
      test.beforeEach(async ({ settings, page }) => {
        await settings.reset();
        await installLongContent(page);
      });

      for (const key of PROFILE_KEYS) {
        test(profileTitle(fixture, key), async ({ page }) => {
          let widget = await reopen(page);
          test.skip((await widget.profile(key).count()) === 0, `${key} is not rendered on this page`);

          await widget.profile(key).click();
          await expect(widget.profile(key)).toHaveAttribute('aria-pressed', 'true');
          await page.keyboard.press('Escape');
          await assertPageUsable(page);

          await page.reload();
          await assertPageUsable(page);
          widget = await reopen(page);
          await expect(widget.profile(key)).toHaveAttribute('aria-pressed', 'true');

          await resetAndAssert(page, ALL_FEATURE_CLASSES);
        });
      }
    });

    test.describe('page invariants hold with every feature on at once', () => {
      test('usable with everything enabled, after reload and after reset', async ({ page, settings }) => {
        await settings.reset();
        await installLongContent(page);
        const widget = await reopen(page);
        for (const key of Object.keys(FEATURE_LEVELS)) {
          if ((await widget.feature(key).count()) > 0) await widget.feature(key).click();
        }
        await page.keyboard.press('Escape');
        await assertPageUsable(page);

        await page.reload();
        await assertPageUsable(page);

        await resetAndAssert(page, ALL_FEATURE_CLASSES);
      });
    });

    test.describe('recovery urls', () => {
      test.beforeEach(async ({ settings, page }) => {
        await settings.reset();
        await installLongContent(page);
      });

      test('?ka11y=reset clears saved state before paint', async ({ page }) => {
        const widget = await reopen(page);
        await widget.feature('readingMask').click();
        await expect(page.locator('html')).toHaveClass(/ka11y-reading-mask/);
        await page.goto('/?ka11y=reset');
        await expect(page.locator('html')).not.toHaveClass(/ka11y-reading-mask/);
        await expect.poll(() => page.evaluate(() => window.localStorage.getItem('ka11y'))).toBeNull();
        await assertPageUsable(page);
      });

      test('?ka11y=off disables the widget for that view only', async ({ page }) => {
        const widget = await reopen(page);
        await widget.feature('readingMask').click();
        await page.goto('/?ka11y=off');
        await expect(page.locator('html')).not.toHaveClass(/ka11y-reading-mask/);
        await assertPageUsable(page);
        await page.goto('/');
        await expect(page.locator('html')).toHaveClass(/ka11y-reading-mask/);
      });
    });
  });
}
