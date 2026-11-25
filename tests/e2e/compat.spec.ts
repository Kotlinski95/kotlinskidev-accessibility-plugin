import type { BrowserContext, Page, Request } from '@playwright/test';
import { expect, gotoHome, openPanel, test, widgetFor } from './support/fixtures';
import { BASE_URL } from './support/env';
import { PLUGIN_BUILD_URL, seedSavedState } from './support/perf';

const MOVED_LOADER_PATH = '/wp-content/cache/asset-cleanup/js/ka11y-loader.js';
const PLUGIN_FAILURE_URL = /\/wp-content\/plugins\/[^/]+\/build\/|ka11y|asset-cleanup/;
const CHUNK_NAMES = new Set(['kernel.js', 'panel.js', 'content.js', 'color.js', 'orientation.js']);

const setCookie = (context: BrowserContext, name: string, value: string): Promise<void> =>
  context.addCookies([{ name, value, url: BASE_URL }]);

const recordViolations = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const violations: string[] = [];
    (window as unknown as { __cspViolations: string[] }).__cspViolations = violations;
    document.addEventListener('securitypolicyviolation', (event) => {
      violations.push(`${event.violatedDirective} ${event.blockedURI} ${event.sourceFile}:${event.lineNumber}`);
    });
  });
};

const readViolations = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __cspViolations: string[] }).__cspViolations);

const injectedScriptNonces = (page: Page): Promise<{ src: string; nonce: string | undefined }[]> =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLScriptElement>('script[src]'))
      .filter((script) => /\/wp-content\/plugins\/[^/]+\/build\//.test(script.src))
      .map((script) => ({ src: script.src, nonce: script.nonce })),
  );

const scriptSrcDirective = (policy: string): string => policy.split(';').find((part) => part.trim().startsWith('script-src')) ?? '';

const chunkRequests = (page: Page): Request[] => {
  const seen: Request[] = [];
  page.on('request', (request) => {
    if (CHUNK_NAMES.has(new URL(request.url()).pathname.split('/').pop() ?? '')) seen.push(request);
  });
  return seen;
};

const scriptTag = (html: string, id: string): string => {
  const match = new RegExp(`<script\\b[^>]*\\bid=["']${id}["'][^>]*>`, 'i').exec(html);
  if (match === null) throw new Error(`Script tag ${id} not found`);
  return match[0];
};

test.describe('Asset CleanUp simulation', () => {
  test('a loader served from a moved cache path still loads every chunk from the plugin build URL @smoke', async ({ page, context }) => {
    await setCookie(context, 'ka11y_fixture_moved', '1');
    const chunks = chunkRequests(page);
    const loaderUrls: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('ka11y-loader.js')) loaderUrls.push(request.url());
    });
    const failures: string[] = [];
    page.on('requestfailed', (request) => {
      if (PLUGIN_FAILURE_URL.test(request.url())) failures.push(request.url());
    });
    page.on('response', (response) => {
      if (response.status() >= 400 && PLUGIN_FAILURE_URL.test(response.url())) failures.push(`${response.status()} ${response.url()}`);
    });

    const widget = await gotoHome(page);
    expect(loaderUrls.length).toBeGreaterThan(0);
    expect(new URL(loaderUrls[0] ?? '').pathname).toBe(MOVED_LOADER_PATH);
    await openPanel(page, widget);
    await widget.feature('highContrast').click();
    await expect(page.locator('html')).toHaveClass(/ka11y-high-contrast/);

    const names = new Set(chunks.map((request) => new URL(request.url()).pathname.split('/').pop()));
    expect(names.has('kernel.js')).toBe(true);
    expect(names.has('panel.js')).toBe(true);
    expect(names.has('color.js')).toBe(true);
    for (const request of chunks) {
      expect(request.url()).toMatch(PLUGIN_BUILD_URL);
      expect(request.url()).not.toContain('/cache/asset-cleanup/');
    }
    expect(failures).toEqual([]);
  });

  test('saved state applies when the loader is moved', async ({ page, context }) => {
    await setCookie(context, 'ka11y_fixture_moved', '1');
    await seedSavedState(page);
    await page.goto('/');
    await expect(page.locator('html')).toHaveClass(/ka11y-bigger-text/);
    await expect.poll(() => page.locator('[data-ka11y-overlay]').count(), { timeout: 8_000 }).toBeGreaterThanOrEqual(1);
  });
});

test.describe('strict content security policy', () => {
  for (const mode of ['nonce', 'strict'] as const) {
    const tag = mode === 'strict' ? ' @smoke' : '';

    test(`script-src ${mode} opens the panel with no violation${tag}`, async ({ page, context }) => {
      await setCookie(context, 'ka11y_fixture_csp', mode);
      await recordViolations(page);
      const response = await page.goto('/');
      const policy = response?.headers()['content-security-policy'] ?? '';
      const scriptSrc = scriptSrcDirective(policy);
      expect(scriptSrc).toContain("'nonce-");
      expect(policy).not.toContain('unsafe-eval');
      if (mode === 'strict') expect(scriptSrc).toContain("'strict-dynamic'");
      else expect(scriptSrc).not.toContain("'self'");

      const widget = widgetFor(page);
      await expect(widget.launcher).toBeVisible();
      await openPanel(page, widget);
      await widget.feature('highContrast').click();
      await expect(page.locator('html')).toHaveClass(/ka11y-high-contrast/);
      expect(await readViolations(page)).toEqual([]);
    });

    test(`script-src ${mode} applies a saved state with no violation`, async ({ page, context }) => {
      await setCookie(context, 'ka11y_fixture_csp', mode);
      await recordViolations(page);
      await seedSavedState(page);
      await page.goto('/');
      await expect(page.locator('html')).toHaveClass(/ka11y-bigger-text/);
      await expect.poll(() => page.locator('[data-ka11y-overlay]').count(), { timeout: 8_000 }).toBeGreaterThanOrEqual(1);
      const scripts = await injectedScriptNonces(page);
      expect(scripts.some((script) => script.src.includes('loader'))).toBe(true);
      expect(scripts.some((script) => CHUNK_NAMES.has(new URL(script.src).pathname.split('/').pop() ?? ''))).toBe(true);
      for (const script of scripts) expect(script.nonce ?? '', script.src).not.toBe('');
      expect(await readViolations(page)).toEqual([]);
    });
  }
});

test.describe('optimizer attributes', () => {
  test('Compatibility prints every opt-out attribute on the bootstrap, config and loader tags', async ({ page, settings }) => {
    await settings.patch({ performance: { preset: 'compatibility' } });
    const response = await page.goto('/');
    const html = (await response?.text()) ?? '';
    const expected = [/data-cfasync=["']false["']/, /\bnowprocket\b/, /data-no-optimize=["']1["']/, /data-no-defer=["']1["']/, /data-no-minify=["']1["']/, /data-jetpack-boost=["']ignore["']/, /\bdata-wpacu-skip\b/];

    for (const id of ['kotlinskidev-a11y-bootstrap', 'kotlinskidev-a11y-loader-js-before', 'kotlinskidev-a11y-loader-js']) {
      const tag = scriptTag(html, id);
      for (const pattern of expected) expect(tag, `${id} ${pattern}`).toMatch(pattern);
    }
  });
});
