import type { Browser, Page } from '@playwright/test';
import { expect, test, widgetFor } from './support/fixtures';
import { BASE_URL } from './support/env';
import { headHtml, installVitals, median, pluginRequests, pluginStylesheetHrefs, readVitals, throttleCpu } from './support/perf';
import type { Vitals } from './support/perf';

const RUNS = 5;
const CPU_RATE = 4;
const CLS_DELTA_MAX = 0.005;
const LCP_DELTA_MAX_MS = 50;
const LONG_TASK_DELTA_MAX_MS = 30;
const EXCLUDED_POST_ID = 999_999;

type Settings = { patch(value: Record<string, unknown>): Promise<unknown> };

const widgetOff = (settings: Settings): Promise<unknown> =>
  settings.patch({ visibility: { mode: 'only_on', includePostIds: [EXCLUDED_POST_ID] } });

const widgetOn = (settings: Settings): Promise<unknown> =>
  settings.patch({ visibility: { mode: 'everywhere', includePostIds: [] }, performance: { preset: 'recommended' } });

interface Run {
  vitals: Vitals;
  plugin: string[];
  head: string;
}

const measure = async (browser: Browser, throttle: boolean): Promise<Run> => {
  const context = await browser.newContext({ baseURL: BASE_URL });
  try {
    const page: Page = await context.newPage();
    const requests = pluginRequests(page);
    await installVitals(page);
    if (throttle) await throttleCpu(page, CPU_RATE);
    const response = await page.goto('/');
    const head = headHtml((await response?.text()) ?? '');
    const vitals = await readVitals(page);
    return { vitals, plugin: requests.names(), head };
  } finally {
    await context.close();
  }
};

test.describe('widget cost', () => {
  test.describe.configure({ retries: 2 });

  test('a single run per side stays clean on layout shift and requests @smoke', async ({ browser, settings }) => {
    await widgetOff(settings);
    const off = await measure(browser, false);
    expect(off.plugin).toEqual([]);
    expect(off.vitals.cls).toBeLessThanOrEqual(CLS_DELTA_MAX);

    await widgetOn(settings);
    const on = await measure(browser, false);
    expect(on.plugin).toEqual(['loader.js']);
    expect(on.vitals.cls).toBeLessThanOrEqual(CLS_DELTA_MAX);
    expect(on.vitals.cls - off.vitals.cls).toBeLessThanOrEqual(CLS_DELTA_MAX);
  });

  test('median CLS, LCP and long-task deltas stay inside the budget with the widget on', async ({ browser, settings }) => {
    test.setTimeout(300_000);
    await widgetOn(settings);
    const warm = await browser.newContext({ baseURL: BASE_URL });
    try {
      await (await warm.newPage()).goto('/');
    } finally {
      await warm.close();
    }
    const off: Vitals[] = [];
    const on: Vitals[] = [];
    for (let run = 0; run < RUNS; run += 1) {
      await widgetOff(settings);
      off.push((await measure(browser, true)).vitals);
      await widgetOn(settings);
      on.push((await measure(browser, true)).vitals);
    }
    const delta = (pick: (vitals: Vitals) => number): number => median(on.map(pick)) - median(off.map(pick));
    expect(delta((vitals) => vitals.cls)).toBeLessThanOrEqual(CLS_DELTA_MAX);
    expect(delta((vitals) => vitals.lcp)).toBeLessThanOrEqual(LCP_DELTA_MAX_MS);
    expect(delta((vitals) => vitals.longTaskTotal)).toBeLessThanOrEqual(LONG_TASK_DELTA_MAX_MS);
  });

  test('Recommended puts no plugin stylesheet in the head', async ({ browser, settings }) => {
    await widgetOn(settings);
    const run = await measure(browser, false);
    expect(pluginStylesheetHrefs(run.head)).toEqual([]);
  });
});

test.describe('first paint', () => {
  test('the launcher is in place before any script runs and does not move afterwards', async ({ page }) => {
    await installVitals(page);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/build/loader.js*', async (route) => {
      await gate;
      await route.continue();
    });
    try {
      await page.goto('/', { waitUntil: 'commit' });
      const launcher = widgetFor(page).launcher;
      await expect(launcher).toBeVisible();
      const before = await launcher.boundingBox();
      expect(before).not.toBeNull();
      release();
      await page.waitForLoadState('load');
      const after = await launcher.boundingBox();
      expect(after).toEqual(before);
      const vitals = await readVitals(page);
      expect(vitals.cls).toBeLessThanOrEqual(CLS_DELTA_MAX);
    } finally {
      release();
    }
  });
});
