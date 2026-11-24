import { expect, FIXTURE_NAMES, test } from './support/fixtures';
import { ALL_FEATURE_CLASSES, reopen, resetAndAssert } from './support/flows';
import { assertPageUsable, installLongContent } from './support/invariants';
import { FEATURE_COMBINATIONS } from './support/pairwise';
import type { Combination } from './support/pairwise';
import type { WidgetLocators } from './support/fixtures';

const describeCombination = (combination: Combination): string =>
  Object.entries(combination)
    .filter(([, level]) => level > 0)
    .map(([key, level]) => `${key}:${level}`)
    .join(' ');

const applyCombination = async (widget: WidgetLocators, combination: Combination): Promise<Array<[string, number]>> => {
  const applied: Array<[string, number]> = [];
  for (const [key, level] of Object.entries(combination)) {
    if (level === 0 || (await widget.feature(key).count()) === 0) continue;
    for (let press = 0; press < level; press += 1) await widget.feature(key).click();
    applied.push([key, level]);
  }
  return applied;
};

for (const fixture of FIXTURE_NAMES) {
  test.describe(`[${fixture}] pairwise combinations`, () => {
    test.use({ fixture });

    test.beforeEach(async ({ settings, page }) => {
      await settings.reset();
      await installLongContent(page);
    });

    FEATURE_COMBINATIONS.forEach((combination, index) => {
      test(`combination ${index + 1}: ${describeCombination(combination)}`, async ({ page }) => {
        let widget = await reopen(page);
        const applied = await applyCombination(widget, combination);
        await page.keyboard.press('Escape');
        await assertPageUsable(page);

        await page.reload();
        await assertPageUsable(page);
        widget = await reopen(page);
        for (const [key] of applied) await expect(widget.feature(key)).toHaveAttribute('aria-pressed', 'true');

        await resetAndAssert(page, ALL_FEATURE_CLASSES);
      });
    });
  });
}
