import type { Page, Request } from '@playwright/test';

export const SAVED_LEVELS: Readonly<Record<string, boolean | number>> = { readingLine: true, biggerText: 2 };

export const PLUGIN_BUILD_URL = /\/wp-content\/plugins\/[^/]+\/build\//;
const PLUGIN_REQUEST_URL = /\/wp-content\/plugins\/[^/]+\/|\/kotlinskidev-a11y\//;

export interface PluginRequests {
  names(): string[];
  has(name: string): boolean;
  count(name: string): number;
}

export interface FirstPaintSnapshot {
  className: string;
  stylesheetPresent: boolean;
  stylesheetLoaded: boolean;
}

export interface Vitals {
  cls: number;
  lcp: number;
  longTaskTotal: number;
}

declare global {
  interface Window {
    __ka11yFirstPaint?: FirstPaintSnapshot;
    __ka11yVitals?: Vitals;
  }
}

const SETTLE_AFTER_LOAD_MS = 2_000;

const nameOf = (request: Request): string => new URL(request.url()).pathname.split('/').pop() ?? '';

export const pluginRequests = (page: Page): PluginRequests => {
  const seen: string[] = [];
  page.on('request', (request) => {
    if (PLUGIN_REQUEST_URL.test(request.url())) seen.push(nameOf(request));
  });
  return {
    names: () => [...seen],
    has: (name) => seen.includes(name),
    count: (name) => seen.filter((seenName) => seenName === name).length,
  };
};

export const seedSavedState = async (page: Page, levels: Readonly<Record<string, boolean | number>> = SAVED_LEVELS): Promise<void> => {
  await page.addInitScript(
    ({ stored }) => {
      if (window.localStorage.getItem('ka11y') === null) window.localStorage.setItem('ka11y', JSON.stringify(stored));
    },
    {
      stored: {
        classes: ['ka11y-bigger-text', 'ka11y-reading-line'],
        vars: { '--ka11y-font-scale': '1.25' },
        levels,
        exp: Date.now() + 86_400_000,
      },
    },
  );
};

export const firstPaintSnapshot = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    requestAnimationFrame(() => {
      const link = document.getElementById('kotlinskidev-a11y-frontend-css') as HTMLLinkElement | null;
      window.__ka11yFirstPaint = {
        className: document.documentElement.className,
        stylesheetPresent: link !== null,
        stylesheetLoaded: link !== null && link.sheet !== null,
      };
    });
  });
};

export const readFirstPaint = (page: Page): Promise<FirstPaintSnapshot | undefined> => page.evaluate(() => window.__ka11yFirstPaint);

export const installVitals = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const vitals = { cls: 0, lcp: 0, longTaskTotal: 0 };
    window.__ka11yVitals = vitals;
    const observe = (type: string, onEntry: (entry: PerformanceEntry) => void): void => {
      try {
        new PerformanceObserver((list) => list.getEntries().forEach(onEntry)).observe({ type, buffered: true });
      } catch {
        return;
      }
    };
    observe('layout-shift', (entry) => {
      const shift = entry as unknown as { value: number; hadRecentInput: boolean };
      if (!shift.hadRecentInput) vitals.cls += shift.value;
    });
    observe('largest-contentful-paint', (entry) => {
      vitals.lcp = entry.startTime;
    });
    observe('longtask', (entry) => {
      vitals.longTaskTotal += Math.max(0, entry.duration - 50);
    });
  });
};

export const readVitals = async (page: Page): Promise<Vitals> => {
  await page.waitForLoadState('load');
  await page.waitForTimeout(SETTLE_AFTER_LOAD_MS);
  const vitals = await page.evaluate(() => window.__ka11yVitals);
  if (vitals === undefined) throw new Error('Vitals observer was not installed');
  return vitals;
};

export const throttleCpu = async (page: Page, rate: number): Promise<void> => {
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate });
};

export const median = (values: readonly number[]): number => {
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 1 ? (ordered[middle] ?? 0) : ((ordered[middle - 1] ?? 0) + (ordered[middle] ?? 0)) / 2;
};

export const headHtml = (html: string): string => /<head[\s>][\s\S]*?<\/head>/i.exec(html)?.[0] ?? '';

const attributeOf = (tag: string, name: string): string => new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag)?.slice(1).find((value) => value !== undefined) ?? '';

export const pluginStylesheetHrefs = (head: string): string[] =>
  (head.match(/<link\b[^>]*>/gi) ?? [])
    .filter((tag) => attributeOf(tag, 'rel').toLowerCase().split(/\s+/).includes('stylesheet'))
    .map((tag) => attributeOf(tag, 'href'))
    .filter((href) => PLUGIN_BUILD_URL.test(href));
