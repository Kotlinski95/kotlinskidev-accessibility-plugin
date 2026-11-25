import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, gotoHome, openPanel, test } from './support/fixtures';
import { installLongContent } from './support/invariants';
import { setFixtureLocale } from './support/locale';

const SMOKE = '@smoke';
const BLOCKING_IMPACTS: readonly string[] = ['serious', 'critical'];
const TARGET_PX = 44;
const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };
const NARROW = { width: 320, height: 640 };
const POLISH_TITLE = 'Ustawienia dostępności';

const shadowActive = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const active = document.querySelector('#ka11y-root')?.shadowRoot?.activeElement;
    if (!active) return '';
    return active.id !== '' ? `#${active.id}` : `.${[...active.classList].join('.')}`;
  });

const injectPageButton = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const button = document.createElement('button');
    button.id = 'behind-button';
    button.type = 'button';
    button.textContent = 'Behind the panel';
    button.style.cssText = 'position:fixed;left:8px;top:8px;z-index:2147483000;min-height:44px';
    document.body.append(button);
  });
};

const scanPanel = async (page: Page): Promise<string[]> => {
  const results = await new AxeBuilder({ page }).include('#ka11y-root').analyze();
  return results.violations.filter((violation) => BLOCKING_IMPACTS.includes(violation.impact ?? '')).map((violation) => `${violation.id}: ${violation.help}`);
};

test.describe('panel behaviour', () => {
  test.beforeEach(async ({ settings, context }) => {
    await settings.reset();
    await setFixtureLocale(context, 'en_US');
  });

  test(`is non-modal: a page link stays clickable and the panel stays open ${SMOKE}`, async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    const widget = await gotoHome(page);
    await injectPageButton(page);
    await page.evaluate(() => {
      (window as unknown as { __clicks: number }).__clicks = 0;
      document.getElementById('behind-button')?.addEventListener('click', () => {
        (window as unknown as { __clicks: number }).__clicks += 1;
      });
    });
    await openPanel(page, widget);
    await expect(widget.panel).not.toHaveAttribute('aria-modal', /.*/);
    await page.locator('#behind-button').click();
    expect(await page.evaluate(() => (window as unknown as { __clicks: number }).__clicks)).toBe(1);
    await expect(widget.launcher).toHaveAttribute('aria-expanded', 'true');
    await expect(widget.panel).toBeVisible();
  });

  test(`open moves focus to the title; Escape inside closes; Escape on the page does not ${SMOKE}`, async ({ page }) => {
    const widget = await gotoHome(page);
    await injectPageButton(page);
    await openPanel(page, widget);
    await expect.poll(() => shadowActive(page)).toBe('#ka11y-panel-title');

    await page.locator('#behind-button').focus();
    await page.keyboard.press('Escape');
    await expect(widget.launcher).toHaveAttribute('aria-expanded', 'true');
    await expect(widget.panel).toBeVisible();

    await widget.panel.locator('.ka11y-close').focus();
    await page.keyboard.press('Escape');
    await expect(widget.launcher).toHaveAttribute('aria-expanded', 'false');
    await expect(widget.panel).toHaveAttribute('inert', '');
  });

  test('Escape returns focus to the launcher after closing from inside', async ({ page }) => {
    const widget = await gotoHome(page);
    await openPanel(page, widget);
    await page.keyboard.press('Escape');
    await expect(widget.launcher).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(() => shadowActive(page)).toBe('.ka11y-launcher');
  });

  test('Tab from the last control leaves the panel and keeps it open', async ({ page }) => {
    const widget = await gotoHome(page);
    await openPanel(page, widget);
    await widget.reset.focus();
    await page.keyboard.press('Tab');
    const stillInside = await page.evaluate(() => {
      const active = document.querySelector('#ka11y-root')?.shadowRoot?.activeElement;
      return active !== undefined && active !== null && active.closest('.ka11y-panel') !== null;
    });
    expect(stillInside).toBe(false);
    await expect(widget.panel).toBeVisible();
    await expect(widget.launcher).toHaveAttribute('aria-expanded', 'true');
  });

  test(`a tile toggles aria-pressed and the root class and survives a reload ${SMOKE}`, async ({ page }) => {
    const widget = await gotoHome(page);
    await openPanel(page, widget);
    const tile = widget.panel.locator('button[data-feature="letterSpacing"]');
    await expect(tile).toHaveAttribute('aria-pressed', 'false');
    await expect(tile.locator('.ka11y-tile__check')).toBeHidden();
    await tile.click();
    await expect(tile).toHaveAttribute('aria-pressed', 'true');
    await expect(tile.locator('.ka11y-tile__check')).toBeVisible();
    await expect(page.locator('html')).toHaveClass(/ka11y-letter-spacing/);
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/ka11y-letter-spacing/);
    await openPanel(page, widget);
    await expect(tile).toHaveAttribute('aria-pressed', 'true');
    await tile.click();
    await expect(tile).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('html')).not.toHaveClass(/ka11y-letter-spacing/);
  });

  test('textAlign cycles 1, 2, 3, 0 with level dots and a described state', async ({ page }) => {
    const widget = await gotoHome(page);
    await openPanel(page, widget);
    const tile = widget.panel.locator('button[data-feature="textAlign"]');
    const describedBy = (await tile.getAttribute('aria-describedby')) ?? '';
    expect(describedBy.split(' ')).toContain('ka11y-state-textAlign');
    const state = widget.panel.locator('#ka11y-state-textAlign');
    const expected: Array<[number, string, string]> = [
      [1, 'true', 'Left'],
      [2, 'true', 'Center'],
      [3, 'true', 'Right'],
      [0, 'false', 'Off'],
    ];
    await expect(widget.panel.locator('button[data-feature="textAlign"] .ka11y-dots i')).toHaveCount(3);
    for (const [dots, pressed, label] of expected) {
      await tile.click();
      await expect(tile).toHaveAttribute('aria-pressed', pressed);
      await expect(widget.panel.locator('button[data-feature="textAlign"] .ka11y-dots i[data-on]')).toHaveCount(dots);
      await expect(state).toHaveText(label);
    }
  });

  for (const key of ['biggerText', 'lineHeight']) {
    test(`stepper ${key}: plus to High disables plus, minus returns to Default, Enter and Space work${key === 'biggerText' ? ` ${SMOKE}` : ''}`, async ({ page }) => {
      const widget = await gotoHome(page);
      await openPanel(page, widget);
      const group = widget.panel.locator(`.ka11y-stepper[data-feature="${key}"]`);
      const plus = group.locator('[data-step="1"]');
      const minus = group.locator('[data-step="-1"]');
      const value = group.locator('.ka11y-stepper__value');
      await expect(value).toHaveText('Default');
      await expect(minus).toHaveAttribute('aria-disabled', 'true');
      await expect(plus).toHaveAttribute('aria-disabled', 'false');

      await plus.click();
      await expect(value).toHaveText('Low');
      await plus.focus();
      await page.keyboard.press('Enter');
      await expect(value).toHaveText('Medium');
      await page.keyboard.press('Space');
      await expect(value).toHaveText('High');
      await expect(plus).toHaveAttribute('aria-disabled', 'true');
      await plus.click({ force: true });
      await expect(value).toHaveText('High');

      await minus.click();
      await minus.click();
      await minus.click();
      await expect(value).toHaveText('Default');
      await expect(minus).toHaveAttribute('aria-disabled', 'true');
      await expect(group).toHaveAttribute('data-level', '0');
    });
  }

  test('the skip select focuses main and resets to Choose', async ({ page }) => {
    const widget = await gotoHome(page);
    await openPanel(page, widget);
    const select = widget.panel.locator('#ka11y-skip-select');
    await expect(select.locator('option').first()).toHaveText('Choose…');
    await select.selectOption('main');
    await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe('MAIN');
    await expect(select).toHaveValue('');
  });

  test(`reset turns everything off, announces it and keeps focus on reset ${SMOKE}`, async ({ page }) => {
    const widget = await gotoHome(page);
    await openPanel(page, widget);
    await widget.panel.locator('button[data-feature="letterSpacing"]').click();
    await widget.panel.locator('.ka11y-stepper[data-feature="biggerText"] [data-step="1"]').click();
    await expect(page.locator('html')).toHaveClass(/ka11y-letter-spacing/);
    await widget.reset.click();
    await expect(page.locator('html')).not.toHaveClass(/ka11y-letter-spacing/);
    await expect(page.locator('html')).not.toHaveClass(/ka11y-bigger-text/);
    await expect(widget.panel.locator('button[data-feature="letterSpacing"]')).toHaveAttribute('aria-pressed', 'false');
    await expect(widget.panel.locator('.ka11y-stepper[data-feature="biggerText"] .ka11y-stepper__value')).toHaveText('Default');
    await expect(widget.panel.locator('[role="status"]')).toHaveText('All adjustments were reset.');
    await expect.poll(() => shadowActive(page)).toBe('.ka11y-reset');
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem('ka11y'))).toBeNull();
  });

  test(`language: switch to Polish, focus the select, survive reload ${SMOKE}`, async ({ page }) => {
    const widget = await gotoHome(page);
    await openPanel(page, widget);
    const select = widget.panel.locator('#ka11y-lang');
    await expect(select.locator('option')).toHaveText(['English', 'Polski', 'עברית']);
    await expect(widget.panel.locator('#ka11y-panel-title')).toHaveText('Accessibility settings');
    await select.selectOption('pl_PL');
    await expect(widget.panel.locator('#ka11y-panel-title')).toHaveText(POLISH_TITLE);
    await expect(widget.host).toHaveAttribute('lang', 'pl');
    await expect(widget.host).toHaveAttribute('dir', 'ltr');
    await expect.poll(() => shadowActive(page)).toBe('#ka11y-lang');
    await expect(widget.panel.locator('#ka11y-lang')).toHaveValue('pl_PL');

    await page.reload();
    await expect(widget.launcher).toBeVisible();
    await openPanel(page, widget);
    await expect(widget.panel.locator('#ka11y-panel-title')).toHaveText(POLISH_TITLE);
    await expect(widget.host).toHaveAttribute('lang', 'pl');
  });

  test('language: an RTL locale sets dir="rtl" and survives a reload', async ({ page }) => {
    const widget = await gotoHome(page);
    await openPanel(page, widget);
    await widget.panel.locator('#ka11y-lang').selectOption('he_IL');
    await expect(widget.host).toHaveAttribute('dir', 'rtl');
    await expect(widget.host).toHaveAttribute('lang', 'he');
    await expect.poll(() => shadowActive(page)).toBe('#ka11y-lang');
    const geometry = await widget.panel.evaluate((panel) => {
      const close = panel.querySelector('.ka11y-close')?.getBoundingClientRect();
      const select = panel.querySelector('.ka11y-lang')?.getBoundingClientRect();
      return { closeLeft: close?.left ?? 0, selectLeft: select?.left ?? 0 };
    });
    expect(geometry.closeLeft).toBeLessThan(geometry.selectLeft);
    await page.reload();
    await expect(widget.launcher).toBeVisible();
    await openPanel(page, widget);
    await expect(widget.host).toHaveAttribute('dir', 'rtl');
    await expect(widget.panel.locator('#ka11y-lang')).toHaveValue('he_IL');
  });

  test('an RTL page locale renders the host as rtl from the first paint', async ({ page, context }) => {
    await setFixtureLocale(context, 'he_IL');
    const widget = await gotoHome(page);
    await expect(widget.host).toHaveAttribute('dir', 'rtl');
    await expect(widget.host).toHaveAttribute('lang', 'he-IL');
    await openPanel(page, widget);
    await expect(widget.panel.locator('#ka11y-lang')).toHaveValue('he_IL');
  });

  test('the hide toolbar chip hides the launcher for the session', async ({ page }) => {
    const widget = await gotoHome(page);
    await openPanel(page, widget);
    await widget.panel.locator('.ka11y-hide-toggle').click();
    await expect(widget.panel.locator('.ka11y-hide-menu')).toBeVisible();
    await widget.panel.locator('.ka11y-hide-menu .ka11y-chip').first().click();
    await expect(widget.host).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-ka11y-hidden', '');
    await page.reload();
    await expect(widget.host).toBeHidden();
  });
});

test.describe('panel settings', () => {
  test.beforeEach(async ({ settings, context }) => {
    await settings.reset();
    await setFixtureLocale(context, 'en_US');
  });

  test('panel.sections.color = false removes the Color card only', async ({ page, settings }) => {
    await settings.patch({ panel: { sections: { color: false } } });
    const widget = await gotoHome(page);
    await openPanel(page, widget);
    await expect(widget.panel.locator('#ka11y-card-color')).toHaveCount(0);
    await expect(widget.panel.locator('#ka11y-card-content')).toHaveCount(1);
    await expect(widget.panel.locator('#ka11y-card-orientation')).toHaveCount(1);
    await expect(widget.panel.locator('[data-feature="darkContrast"]')).toHaveCount(0);
  });

  test('the profile card can be hidden', async ({ page, settings }) => {
    const widget = await gotoHome(page);
    await openPanel(page, widget);
    await expect(widget.panel.locator('#ka11y-card-profiles')).toHaveCount(1);
    await settings.patch({ panel: { sections: { profiles: false } } });
    await page.reload();
    await openPanel(page, widget);
    await expect(widget.panel.locator('#ka11y-card-profiles')).toHaveCount(0);
    await expect(widget.panel.locator('[data-profile]')).toHaveCount(0);
    await expect(widget.panel.locator('#ka11y-card-content')).toHaveCount(1);
  });

  test('the language switcher can be disabled', async ({ page, settings }) => {
    await settings.patch({ panel: { languageSwitcher: false } });
    const widget = await gotoHome(page);
    await openPanel(page, widget);
    await expect(widget.panel.locator('#ka11y-lang')).toHaveCount(0);
  });

  test('panel.columns = 2 gives two columns and the default gives three', async ({ page, settings }) => {
    const widget = await gotoHome(page);
    await openPanel(page, widget);
    const columns = (): Promise<number> =>
      widget.panel.locator('#ka11y-card-profiles ~ .ka11y-tiles, .ka11y-card .ka11y-tiles').first().evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').length);
    await expect(widget.panel).toHaveAttribute('data-columns', '3');
    expect(await columns()).toBe(3);
    await settings.patch({ panel: { columns: 2 } });
    await page.reload();
    await openPanel(page, widget);
    await expect(widget.panel).toHaveAttribute('data-columns', '2');
    expect(await columns()).toBe(2);
  });

  for (const [position, side] of [
    ['bottom-left', 'left'],
    ['bottom-right', 'right'],
    ['middle-right', 'right'],
  ] as const) {
    test(`desktop ${position}: the panel docks to the ${side} and fills the viewport height`, async ({ page, settings }) => {
      await page.setViewportSize(DESKTOP);
      await settings.patch({ widget: { position: { desktop: position } } });
      const widget = await gotoHome(page);
      await openPanel(page, widget);
      await expect(widget.panel).toHaveAttribute('data-side', side);
      await expect(widget.panel).toHaveAttribute('data-layout', 'side');
      const geometry = await widget.panel.evaluate((panel) => {
        const rect = panel.getBoundingClientRect();
        const host = panel.getRootNode() instanceof ShadowRoot ? (panel.getRootNode() as ShadowRoot).host : panel;
        return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, hostTransform: getComputedStyle(host).transform, innerHeight: window.innerHeight, innerWidth: window.innerWidth };
      });
      expect(geometry.hostTransform).toBe('none');
      expect(geometry.top).toBe(0);
      expect(geometry.bottom).toBe(geometry.innerHeight);
      if (side === 'left') expect(geometry.left).toBe(0);
      else expect(geometry.right).toBe(geometry.innerWidth);
    });
  }
});

test.describe('panel layout and media', () => {
  test.beforeEach(async ({ settings, context }) => {
    await settings.reset();
    await setFixtureLocale(context, 'en_US');
  });

  test(`mobile 390x844: bottom sheet, safe-area padding, page above stays scrollable ${SMOKE}`, async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await installLongContent(page);
    const widget = await gotoHome(page);
    await openPanel(page, widget);
    await expect(widget.panel).toHaveAttribute('data-layout', 'sheet');
    const geometry = await widget.panel.evaluate((panel) => {
      const rect = panel.getBoundingClientRect();
      return { left: rect.left, right: rect.right, bottom: rect.bottom, height: rect.height, innerHeight: window.innerHeight, innerWidth: window.innerWidth };
    });
    expect(geometry.left).toBe(0);
    expect(geometry.right).toBe(geometry.innerWidth);
    expect(geometry.bottom).toBe(geometry.innerHeight);
    expect(geometry.height).toBeLessThanOrEqual(geometry.innerHeight * 0.85 + 1);
    expect(geometry.height).toBeGreaterThan(200);

    const safeArea = await widget.panel.evaluate((panel) => {
      const root = panel.getRootNode() as ShadowRoot;
      const sheets = [...root.styleSheets, ...root.adoptedStyleSheets];
      const rules: string[] = [];
      const collect = (list: CSSRuleList): void => {
        for (const rule of list) {
          rules.push(rule.cssText);
          if ('cssRules' in rule) collect((rule as CSSGroupingRule).cssRules);
        }
      };
      for (const sheet of sheets) collect(sheet.cssRules);
      return rules.some((text) => text.includes("data-layout") && text.includes('sheet') && text.includes('safe-area-inset-bottom') && text.includes('padding'));
    });
    expect(safeArea).toBe(true);

    await page.mouse.move(195, 60);
    await page.mouse.wheel(0, 600);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
    await expect(widget.launcher).toHaveAttribute('aria-expanded', 'true');
    await expect(widget.panel).toBeVisible();
  });

  test('reducedMotion removes the panel transition', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const widget = await gotoHome(page);
    await openPanel(page, widget);
    const durations = await widget.panel.evaluate((panel) => getComputedStyle(panel).transitionDuration.split(',').map((value) => Number.parseFloat(value)));
    for (const duration of durations) expect(duration).toBeLessThan(0.001);
  });

  test('forcedColors keeps tile borders visible and distinguishes the pressed tile', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    const widget = await gotoHome(page);
    await openPanel(page, widget);
    const pressedTile = widget.panel.locator('button[data-feature="letterSpacing"]');
    const plainTile = widget.panel.locator('button[data-feature="bigCursor"]');
    await pressedTile.click();
    await expect(pressedTile).toHaveAttribute('aria-pressed', 'true');
    const read = (locator: typeof pressedTile): Promise<{ color: string; width: string; style: string }> =>
      locator.evaluate((node) => {
        const style = getComputedStyle(node);
        return { color: style.borderTopColor, width: style.borderTopWidth, style: style.borderTopStyle };
      });
    const pressed = await read(pressedTile);
    const plain = await read(plainTile);
    expect(plain.style).toBe('solid');
    expect(plain.color).not.toBe('rgba(0, 0, 0, 0)');
    expect(pressed.color).not.toBe('rgba(0, 0, 0, 0)');
    expect(`${pressed.color}|${pressed.width}`).not.toBe(`${plain.color}|${plain.width}`);
  });

  test('320x640: the panel body has no horizontal overflow', async ({ page }) => {
    await page.setViewportSize(NARROW);
    const widget = await gotoHome(page);
    await openPanel(page, widget);
    const sizes = await widget.panel.evaluate((panel) => {
      const body = panel.querySelector<HTMLElement>('.ka11y-body');
      return { body: [body?.scrollWidth ?? -1, body?.clientWidth ?? -2], panel: [panel.scrollWidth, panel.clientWidth] };
    });
    expect(sizes.body[0]).toBe(sizes.body[1]);
    expect(sizes.panel[0]).toBe(sizes.panel[1]);
  });

  test('interactive targets are at least 44px', async ({ page }) => {
    const widget = await gotoHome(page);
    await openPanel(page, widget);
    await widget.panel.locator('.ka11y-hide-toggle').click();
    const small = await widget.panel.evaluate((panel, minimum) => {
      const selector = '.ka11y-tile, .ka11y-step, .ka11y-close, .ka11y-reset, .ka11y-lang, .ka11y-select, .ka11y-meta__link, .ka11y-chip';
      const offenders: string[] = [];
      for (const node of panel.querySelectorAll<HTMLElement>(selector)) {
        if (node.closest('[hidden]') !== null) continue;
        const rect = node.getBoundingClientRect();
        const squareOnly = node.matches('.ka11y-step, .ka11y-close');
        if (rect.height < minimum - 0.5 || (squareOnly && rect.width < minimum - 0.5)) offenders.push(`${node.className} ${Math.round(rect.width)}x${Math.round(rect.height)}`);
      }
      return offenders;
    }, TARGET_PX);
    expect(small).toEqual([]);
  });
});

test.describe('panel axe', () => {
  test.beforeEach(async ({ settings, context }) => {
    await settings.reset();
    await setFixtureLocale(context, 'en_US');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`the open panel has no serious or critical violations in ${scheme} ${scheme === 'light' ? SMOKE : ''}`.trim(), async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      const widget = await gotoHome(page);
      await openPanel(page, widget);
      await expect(widget.host).toHaveAttribute('data-theme', scheme);
      await widget.panel.locator('button[data-feature="letterSpacing"]').click();
      expect(await scanPanel(page)).toEqual([]);
    });
  }

  test('the open sheet layout has no serious or critical violations', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    const widget = await gotoHome(page);
    await openPanel(page, widget);
    await expect(widget.panel).toHaveAttribute('data-layout', 'sheet');
    expect(await scanPanel(page)).toEqual([]);
  });

  test('the open panel in an RTL locale has no serious or critical violations', async ({ page, context }) => {
    await setFixtureLocale(context, 'he_IL');
    const widget = await gotoHome(page);
    await openPanel(page, widget);
    expect(await scanPanel(page)).toEqual([]);
  });
});
