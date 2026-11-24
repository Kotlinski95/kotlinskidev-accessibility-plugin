import { expect, gotoHome, openPanel, test, widgetFor } from './support/fixtures';
import { OPEN_HASH } from './support/env';
import { tryWpCli, wpCli } from './support/wp-cli';

const POLISH_TITLE = 'Ustawienia dostępności (e2e)';
const CUSTOM_CSS_MARKER = '--ka11y-e2e-marker';

test.describe('settings driven behaviour', () => {
  test.beforeEach(async ({ settings }) => {
    await settings.reset();
  });

  test('host follows html.dark-mode and html.light-mode', async ({ page }) => {
    const widget = await gotoHome(page);
    await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
    await expect(widget.host).toHaveAttribute('data-theme', 'dark');
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark-mode');
      document.documentElement.classList.add('light-mode');
    });
    await expect(widget.host).toHaveAttribute('data-theme', 'light');
  });

  test('storage mode none does not persist state', async ({ page, settings }) => {
    await settings.patch({ storage: { mode: 'none' } });
    const widget = await gotoHome(page);
    await openPanel(page, widget);
    await widget.feature('letterSpacing').click();
    await expect(page.locator('html')).toHaveClass(/ka11y-letter-spacing/);
    const stored = await page.evaluate(() => window.localStorage.getItem('ka11y'));
    expect(stored).toBeNull();
    await page.reload();
    await expect(page.locator('html')).not.toHaveClass(/ka11y-letter-spacing/);
  });

  test('hide toolbar hides the launcher and the hash link reveals it', async ({ page }) => {
    const widget = await gotoHome(page);
    await openPanel(page, widget);
    await page.locator('#ka11y-root .ka11y-hide-toggle').click();
    await page.locator('#ka11y-root .ka11y-hide-menu button').first().click();
    await expect(widget.host).toBeHidden();
    await page.reload();
    await expect(widget.host).toBeHidden();

    await page.evaluate((hash) => {
      const link = document.createElement('a');
      link.href = hash;
      link.id = 'reveal-link';
      link.textContent = 'Accessibility';
      document.body.prepend(link);
    }, OPEN_HASH);
    await page.locator('#reveal-link').click();
    await expect(widget.host).toBeVisible();
    await expect(widget.panel).toBeVisible();
  });

  test('excluded post type removes the launcher', async ({ page, settings, request }) => {
    const posts = await request.get('/?rest_route=/wp/v2/posts&per_page=1');
    const [post] = (await posts.json()) as Array<{ id: number }>;
    expect(post).toBeDefined();
    await page.goto(`/?p=${post?.id}`);
    await expect(widgetFor(page).launcher).toBeVisible();

    await settings.patch({ visibility: { excludePostTypes: ['post'] } });
    await page.goto(`/?p=${post?.id}`);
    await expect(page.locator('#ka11y-root')).toHaveCount(0);
    await expect(page.locator('#kotlinskidev-a11y-bootstrap')).toHaveCount(0);
  });

  test('excluded post ID removes the launcher only on that post', async ({ page, settings, request }) => {
    const posts = await request.get('/?rest_route=/wp/v2/posts&per_page=1');
    const [post] = (await posts.json()) as Array<{ id: number }>;
    const pages = await request.get('/?rest_route=/wp/v2/pages&per_page=1');
    const [sample] = (await pages.json()) as Array<{ id: number }>;
    expect(post).toBeDefined();
    expect(sample).toBeDefined();

    await settings.patch({ visibility: { excludePostIds: [post?.id] } });
    await page.goto(`/?p=${post?.id}`);
    await expect(page.locator('#ka11y-root')).toHaveCount(0);
    await page.goto(`/?page_id=${sample?.id}`);
    await expect(widgetFor(page).launcher).toBeVisible();
  });

  test('custom CSS lands in the shadow root and the document', async ({ page, settings }) => {
    await settings.patch({ customCss: `.ka11y-launcher{${CUSTOM_CSS_MARKER}:1}` });
    await gotoHome(page);
    const inShadow = await page.evaluate((marker) => {
      const shadow = document.querySelector('#ka11y-root')?.shadowRoot;
      return [...(shadow?.querySelectorAll('style') ?? [])].some((style) => style.textContent?.includes(marker) === true);
    }, CUSTOM_CSS_MARKER);
    expect(inShadow).toBe(true);
    const inDocument = await page.evaluate((marker) => document.getElementById('ka11y-custom-css')?.textContent?.includes(marker) === true, CUSTOM_CSS_MARKER);
    expect(inDocument).toBe(true);
  });
});

test.describe('locale', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(() => {
    tryWpCli('language', 'core', 'install', 'pl_PL');
    wpCli('option', 'update', 'WPLANG', 'pl_PL');
  });

  test.afterAll(() => {
    wpCli('option', 'update', 'WPLANG', '');
  });

  test('page locale drives the config and a pl_PL label override reaches the panel', async ({ page, settings }) => {
    await settings.patch({ labels: { pl_PL: { panelTitle: POLISH_TITLE } } });
    const widget = await gotoHome(page);
    const config = await page.evaluate(() => ({
      locale: window.kotlinskidevA11y?.locale,
      lang: document.querySelector('#ka11y-root')?.getAttribute('lang'),
    }));
    expect(config.locale).toBe('pl_PL');
    expect(config.lang).toBe('pl-PL');
    await openPanel(page, widget);
    await expect(page.locator('#ka11y-root #ka11y-panel-title')).toHaveText(POLISH_TITLE);
  });

  test('strings without an override keep their default text', async ({ page, settings }) => {
    await settings.patch({ labels: { pl_PL: { panelTitle: POLISH_TITLE } } });
    const widget = await gotoHome(page);
    await openPanel(page, widget);
    await expect(widget.reset).not.toHaveText('');
    await expect(widget.feature('letterSpacing')).not.toHaveText('');
  });
});
