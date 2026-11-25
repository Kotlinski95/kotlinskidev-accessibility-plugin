import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export const HOSTILE_MARKER = '#hostile-wrapper';
const FIXED_EXPECTED = { top: 12, rightGap: 12, width: 120, height: 40 };
const STICKY_SCROLL_PAST_HEADER = 600;
const FILTER_VAR = '--ka11y-filter';
const WIDGET_HOST = 'ka11y-root';

export const isHostile = async (page: Page): Promise<boolean> => (await page.locator(HOSTILE_MARKER).count()) > 0;

const isPanelOpen = async (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const launcher = document.getElementById('ka11y-root')?.shadowRoot?.querySelector('.ka11y-launcher');
    return launcher?.getAttribute('aria-expanded') === 'true';
  });

const assertRootsUntouched = async (page: Page): Promise<void> => {
  const roots = await page.evaluate(() => {
    const html = getComputedStyle(document.documentElement);
    const body = getComputedStyle(document.body);
    return { htmlFilter: html.filter, bodyFilter: body.filter, htmlPosition: html.position, bodyPosition: body.position };
  });
  expect(roots.htmlFilter).toBe('none');
  expect(roots.bodyFilter).toBe('none');
  expect(roots.htmlPosition).toBe('static');
  expect(roots.bodyPosition).not.toBe('fixed');
};

const assertFixedElementStaysFixed = async (page: Page): Promise<void> => {
  await page.evaluate((offset) => {
    const header = document.getElementById('hostile-header');
    const headerTop = (header?.getBoundingClientRect().top ?? 0) + window.scrollY;
    window.scrollTo({ top: headerTop + offset, behavior: 'instant' });
  }, STICKY_SCROLL_PAST_HEADER);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  const measured = await page.evaluate(() => {
    const badge = document.getElementById('hostile-fixed')?.getBoundingClientRect();
    const header = document.getElementById('hostile-header');
    return {
      badge: badge ? { top: badge.top, right: window.innerWidth - badge.right, width: badge.width, height: badge.height } : null,
      headerTop: header?.getBoundingClientRect().top ?? null,
      headerPosition: header ? getComputedStyle(header).position : null,
    };
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
        return window.scrollY;
      })
    )
    .toBe(0);
  expect(measured.badge).not.toBeNull();
  expect(Math.abs((measured.badge?.top ?? 0) - FIXED_EXPECTED.top)).toBeLessThanOrEqual(1);
  expect(Math.abs((measured.badge?.right ?? 0) - FIXED_EXPECTED.rightGap)).toBeLessThanOrEqual(1);
  expect(measured.badge?.width).toBeCloseTo(FIXED_EXPECTED.width, 0);
  expect(measured.badge?.height).toBeCloseTo(FIXED_EXPECTED.height, 0);
  expect(measured.headerPosition).toBe('sticky');
  expect(Math.abs(measured.headerTop ?? 99)).toBeLessThanOrEqual(1);
};

const assertCookieWallClickable = async (page: Page): Promise<void> => {
  const isReachable = (): Promise<boolean> => page.evaluate((hostId) => {
    const button = document.getElementById('cookie-accept');
    if (!button) return false;
    const box = button.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return (hit !== null && button.contains(hit)) || hit?.id === hostId;
  }, WIDGET_HOST);
  await expect.poll(isReachable, { timeout: 5_000 }).toBe(true);
};

const assertLateNodeTreatment = async (page: Page): Promise<void> => {
  await page.waitForSelector('#late-node', { state: 'attached' });
  const probe = await page.evaluate((filterVar) => {
    const late = document.getElementById('late-node');
    const rootVar = document.documentElement.style.getPropertyValue(filterVar).trim();
    return {
      rootVar,
      inlineFilter: late?.style.getPropertyValue('filter') ?? '',
      computedFilter: late ? getComputedStyle(late).filter : '',
    };
  }, FILTER_VAR);
  if (probe.rootVar === '') {
    expect(probe.inlineFilter).toBe('');
    expect(probe.computedFilter).toBe('none');
    return;
  }
  expect(probe.inlineFilter).toContain(FILTER_VAR);
  expect(probe.computedFilter).not.toBe('none');
};

const assertOverlaysClickThrough = async (page: Page): Promise<void> => {
  await page.mouse.move(210, 310);
  await page.mouse.move(230, 330);
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const result = await page.evaluate(() => {
    const overlays = [...document.querySelectorAll<HTMLElement>('[data-ka11y-overlay]')];
    const hit = document.elementFromPoint(230, 330);
    return {
      allPassThrough: overlays.every((overlay) => getComputedStyle(overlay).pointerEvents === 'none'),
      hitIsOverlay: hit?.hasAttribute('data-ka11y-overlay') ?? false,
    };
  });
  expect(result.allPassThrough).toBe(true);
  expect(result.hitIsOverlay).toBe(false);
};

const assertDialogOpens = async (page: Page): Promise<void> => {
  if (await isPanelOpen(page)) return;
  await page.locator('#open-dialog').click();
  await expect(page.locator('#hostile-dialog')).toHaveJSProperty('open', true);
  await page.locator('#close-dialog').click();
  await expect(page.locator('#hostile-dialog')).toHaveJSProperty('open', false);
};

export const assertHostileIntact = async (page: Page): Promise<void> => {
  await assertRootsUntouched(page);
  await assertFixedElementStaysFixed(page);
  await assertCookieWallClickable(page);
  await assertLateNodeTreatment(page);
  await assertOverlaysClickThrough(page);
  await assertDialogOpens(page);
};
