import type { Page } from '@playwright/test';
import { expect, FIXTURE_NAMES, gotoHome, PANEL_TIMEOUT, test, waitForPanel, widgetFor } from './support/fixtures';
import { OPEN_HASH } from './support/env';
import { assertPageUsable, installLongContent } from './support/invariants';
import { firstPaintSnapshot, pluginRequests, readFirstPaint, seedSavedState } from './support/perf';

type Strategy = 'interaction' | 'idle' | 'defer' | 'async' | 'eager';

const STRATEGIES: readonly Strategy[] = ['interaction', 'idle', 'defer', 'async', 'eager'];
const ALL_SCRIPTS = ['loader.js', 'kernel.js', 'panel.js', 'content.js', 'color.js', 'orientation.js'];
const SAVED_SCRIPTS = ['kernel.js', 'content.js', 'orientation.js'];

const SMOKE = new Set(['interaction|none|stock', 'eager|none|stock', 'interaction|saved|hostile']);

const expectedScripts = (strategy: Strategy, saved: boolean): string[] => {
  if (strategy === 'eager') return ALL_SCRIPTS;
  if (strategy === 'interaction') return saved ? ['loader.js', ...SAVED_SCRIPTS] : ['loader.js'];
  return saved ? ['loader.js', 'panel.js', ...SAVED_SCRIPTS] : ['loader.js', 'kernel.js', 'panel.js'];
};

const sorted = (values: string[]): string[] => [...new Set(values)].filter((name) => name.endsWith('.js')).sort();

const setPerformance = async (settings: { patch(value: Record<string, unknown>): Promise<unknown> }, performance: Record<string, unknown>): Promise<void> => {
  await settings.patch({ performance: { preset: 'custom', ...performance } });
};

for (const fixture of FIXTURE_NAMES) {
  test.describe(`loading strategies [${fixture}]`, () => {
    test.use({ fixture });

    for (const strategy of STRATEGIES) {
      for (const saved of [false, true]) {
        const state = saved ? 'saved' : 'none';
        const tag = SMOKE.has(`${strategy}|${state}|${fixture}`) ? ' @smoke' : '';

        test(`${strategy} with ${saved ? 'saved state' : 'no saved state'}${tag}`, async ({ page, settings }) => {
          await setPerformance(settings, { strategy });
          await installLongContent(page);
          const requests = pluginRequests(page);
          if (saved) {
            await seedSavedState(page);
            await firstPaintSnapshot(page);
          }

          const widget = await gotoHome(page);
          await page.waitForLoadState('load');
          await expect.poll(() => sorted(requests.names()), { timeout: 8_000 }).toEqual(sorted(expectedScripts(strategy, saved)));
          await page.waitForTimeout(strategy === 'interaction' ? 500 : 0);
          expect(sorted(requests.names())).toEqual(sorted(expectedScripts(strategy, saved)));
          await expect(widget.panel).toHaveCount(0);

          if (saved) {
            const first = await readFirstPaint(page);
            expect(first?.className).toContain('ka11y-bigger-text');
            expect(first?.stylesheetPresent).toBe(true);
            expect(first?.stylesheetLoaded).toBe(true);
            await expect.poll(() => page.locator('[data-ka11y-overlay]').count(), { timeout: PANEL_TIMEOUT }).toBeGreaterThanOrEqual(1);
          } else {
            expect(requests.has('frontend.css')).toBe(false);
          }

          if (strategy === 'interaction' && !saved) {
            await widget.launcher.hover();
            await expect.poll(() => requests.has('panel.js')).toBe(true);
            await expect(widget.panel).toHaveCount(0);
          }

          await widget.launcher.click();
          await waitForPanel(widget);
          await widget.feature('highContrast').click();
          await expect.poll(() => requests.has('color.js') || strategy === 'eager').toBe(true);
          await expect(page.locator('html')).toHaveClass(/ka11y-high-contrast/);
          await page.keyboard.press('Escape');
          await assertPageUsable(page);
        });
      }
    }
  });
}

const holdLoader = async (page: Page): Promise<() => void> => {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/build/loader.js*', async (route) => {
    await gate;
    await route.continue();
  });
  return release;
};

test.describe('open triggers before the loader runs', () => {
  test('a launcher click opens the panel once the loader is released @smoke', async ({ page }) => {
    const release = await holdLoader(page);
    await page.goto('/', { waitUntil: 'commit' });
    await page.locator('#ka11y-root').click();
    release();
    await waitForPanel(widgetFor(page));
  });

  test('the open hash opens the panel once the loader is released @smoke', async ({ page }) => {
    const release = await holdLoader(page);
    await page.goto(`/${OPEN_HASH}`, { waitUntil: 'commit' });
    await page.waitForTimeout(500);
    release();
    await waitForPanel(widgetFor(page));
  });

  test('a queue push opens the panel once the loader is released @smoke', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { kotlinskidevA11yQueue: unknown[] }).kotlinskidevA11yQueue = [{ action: 'open' }];
    });
    const release = await holdLoader(page);
    await page.goto('/', { waitUntil: 'commit' });
    await page.waitForTimeout(500);
    release();
    await waitForPanel(widgetFor(page));
  });

  test('the shortcut works after the loader runs and before any chunk loads', async ({ page }) => {
    const requests = pluginRequests(page);
    const widget = await gotoHome(page);
    await page.waitForLoadState('load');
    expect(requests.has('panel.js')).toBe(false);
    await page.keyboard.press('Alt+Shift+KeyA');
    await waitForPanel(widget);
  });
});

test.describe('failure handling', () => {
  test('a failing panel chunk shows the error state, then recovers @smoke', async ({ page }) => {
    await page.route('**/build/panel.js*', (route) => route.abort());
    const widget = await gotoHome(page);
    await widget.launcher.click();
    await expect(widget.host).toHaveAttribute('data-state', 'error', { timeout: 20_000 });
    const label = await widget.launcher.getAttribute('aria-label');
    expect(label).toContain('could not load');

    await page.unroute('**/build/panel.js*');
    await widget.launcher.click();
    await waitForPanel(widget);
    await expect(widget.host).not.toHaveAttribute('data-state', /.+/);
  });

  test('a 404 on the uploads JSON falls back to the REST route', async ({ page }) => {
    const hits: string[] = [];
    await page.route('**/uploads/kotlinskidev-a11y/**', (route) => route.fulfill({ status: 404, body: '' }));
    page.on('request', (request) => {
      if (request.url().includes('panel-data')) hits.push(request.url());
    });
    const widget = await gotoHome(page);
    await widget.launcher.click();
    await waitForPanel(widget);
    expect(hits.length).toBeGreaterThan(0);
  });
});

test.describe('device skip', () => {
  test.use({ viewport: { width: 400, height: 800 } });

  test('a hidden device downloads only the loader, unless state is saved', async ({ page, settings }) => {
    await settings.patch({ visibility: { devices: { mobile: false } } });
    const requests = pluginRequests(page);
    await page.goto('/');
    await page.waitForLoadState('load');
    await page.waitForTimeout(500);
    expect(sorted(requests.names())).toEqual(['loader.js']);

    const saved = await page.context().newPage();
    const savedRequests = pluginRequests(saved);
    await seedSavedState(saved, { readingLine: true });
    await saved.goto('/');
    await saved.waitForLoadState('load');
    await expect.poll(() => sorted(savedRequests.names())).toEqual(['kernel.js', 'loader.js', 'orientation.js']);
    await expect.poll(() => saved.locator('[data-ka11y-overlay]').count()).toBeGreaterThanOrEqual(1);
  });
});

test.describe('no javascript', () => {
  test.use({ javaScriptEnabled: false });

  test('the inert launcher is hidden and nothing logs errors @smoke', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto('/');
    await expect(page.locator('#ka11y-root')).toBeHidden();
    expect(errors).toEqual([]);
  });
});

test.describe('page css modes', () => {
  const linkCount = (page: Page): Promise<number> => page.locator('link[href*="frontend.css"]').count();

  test('linked prints a stylesheet link in the HTML', async ({ page, settings }) => {
    await setPerformance(settings, { pageCss: 'linked' });
    const response = await page.goto('/');
    expect(await response?.text()).toContain('kotlinskidev-a11y-frontend-css');
    expect(await linkCount(page)).toBe(1);
  });

  test('inline makes no stylesheet request and carries the state css in the head', async ({ page, settings }) => {
    await setPerformance(settings, { pageCss: 'inline' });
    const requests = pluginRequests(page);
    await gotoHome(page);
    await page.waitForLoadState('load');
    expect(requests.has('frontend.css')).toBe(false);
    expect(await linkCount(page)).toBe(0);
    const style = await page.locator('#kotlinskidev-a11y-tokens-inline-css').textContent();
    expect(style).toContain('ka11y-');
  });

  test('lazy has no stylesheet until the panel opens', async ({ page }) => {
    const requests = pluginRequests(page);
    const widget = await gotoHome(page);
    await page.waitForLoadState('load');
    expect(await linkCount(page)).toBe(0);
    await widget.launcher.click();
    await waitForPanel(widget);
    await expect.poll(() => requests.has('frontend.css')).toBe(true);
  });
});

test.describe('pre-JavaScript launcher', () => {
  test('the server-rendered launcher looks the same before and after the loader runs, with no layout shift @smoke', async ({ page }) => {
    await page.addInitScript(() => {
      const shifts: number[] = [];
      new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => shifts.push((entry as unknown as { value: number }).value));
      }).observe({ type: 'layout-shift', buffered: true });
      (window as unknown as { __shifts: number[] }).__shifts = shifts;
    });
    const release = await holdLoader(page);
    await page.route('**/build/{kernel,panel}.js*', (route) => route.abort());
    await page.goto('/', { waitUntil: 'commit' });
    const launcher = widgetFor(page).launcher;
    await expect(launcher).toBeVisible();
    const before = await launcher.screenshot({ animations: 'disabled' });
    release();
    await page.waitForLoadState('load');
    const after = await launcher.screenshot({ animations: 'disabled' });
    expect(after.equals(before)).toBe(true);
    const shifts = await page.evaluate(() => (window as unknown as { __shifts: number[] }).__shifts);
    expect(shifts.reduce((sum, value) => sum + value, 0)).toBe(0);
  });

  test('?ka11y=off hides the inert launcher and loads no chunk', async ({ page }) => {
    const requests = pluginRequests(page);
    await page.goto('/?ka11y=off');
    await expect(page.locator('#ka11y-root')).toBeHidden();
    await page.waitForTimeout(500);
    expect(sorted(requests.names())).toEqual(['loader.js']);
  });

  test('the hidden toolbar flag keeps the launcher hidden before any script runs', async ({ page }) => {
    await page.addInitScript(() => window.sessionStorage.setItem('ka11y-hidden', '1'));
    await page.goto('/');
    await expect(page.locator('#ka11y-root')).toBeHidden();
  });
});
