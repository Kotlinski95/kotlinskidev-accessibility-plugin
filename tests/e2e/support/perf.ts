import type { Page, Request } from '@playwright/test';

export const SAVED_LEVELS: Readonly<Record<string, boolean | number>> = { readingLine: true, biggerText: 2 };

const PLUGIN_PATHS = ['/kotlinskidev-accessibility/', '/kotlinskidev-a11y/'];

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

declare global {
  interface Window {
    __ka11yFirstPaint?: FirstPaintSnapshot;
  }
}

const nameOf = (request: Request): string => new URL(request.url()).pathname.split('/').pop() ?? '';

export const pluginRequests = (page: Page): PluginRequests => {
  const seen: string[] = [];
  page.on('request', (request) => {
    if (PLUGIN_PATHS.some((path) => request.url().includes(path))) seen.push(nameOf(request));
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
