import { expect, expectFeaturePressed, gotoHome, openPanel, test } from './support/fixtures';

test.describe('feature toggles', () => {
  test.beforeEach(async ({ settings }) => {
    await settings.reset();
  });

  test('letterSpacing toggles the html class and persists across reload', async ({ page }) => {
    const widget = await gotoHome(page);
    await openPanel(page, widget);
    await widget.feature('letterSpacing').click();
    await expectFeaturePressed(widget, 'letterSpacing', true);
    await expect(page.locator('html')).toHaveClass(/ka11y-letter-spacing/);

    await page.reload();
    await expect(page.locator('html')).toHaveClass(/ka11y-letter-spacing/);
    const reopened = await gotoHome(page);
    await openPanel(page, reopened);
    await expectFeaturePressed(reopened, 'letterSpacing', true);
  });

  test('readPage speaks the clicked block through speech synthesis without audio output', async ({ page }) => {
    const widget = await gotoHome(page);
    await openPanel(page, widget);
    await widget.feature('readPage').click();
    await expect(page.locator('html')).toHaveClass(/ka11y-read-page/);
    await page.keyboard.press('Escape');
    const heading = page.locator('h1, h2').first();
    const expected = ((await heading.textContent()) ?? '').replace(/\s+/g, ' ').trim();
    await heading.click();
    const spoken = await page.evaluate(() => (window as unknown as { __ka11ySpoken: string[] }).__ka11ySpoken);
    expect(spoken.length).toBeGreaterThan(0);
    expect(spoken[spoken.length - 1]).toContain(expected.slice(0, 20));
  });

  test('biggerText scales font size inline, cycles levels and persists', async ({ page }) => {
    const widget = await gotoHome(page);
    const heading = page.locator('h1, h2').first();
    const original = await heading.evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
    await openPanel(page, widget);
    await widget.feature('biggerText').click();
    await expect
      .poll(() => heading.evaluate((element) => parseFloat(getComputedStyle(element).fontSize)))
      .toBeCloseTo(Math.round(original * 1.1 * 100) / 100, 1);
    await widget.feature('biggerText').click();
    await expect
      .poll(() => heading.evaluate((element) => parseFloat(getComputedStyle(element).fontSize)))
      .toBeCloseTo(Math.round(original * 1.25 * 100) / 100, 1);

    await page.reload();
    await expect
      .poll(() => page.locator('h1, h2').first().evaluate((element) => parseFloat(getComputedStyle(element).fontSize)))
      .toBeGreaterThan(original * 1.2);
  });

  test('reset clears every active feature and saved state', async ({ page }) => {
    const widget = await gotoHome(page);
    const heading = page.locator('h1, h2').first();
    const original = await heading.evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
    await openPanel(page, widget);
    await widget.feature('letterSpacing').click();
    await widget.feature('biggerText').click();
    await expect(page.locator('html')).toHaveClass(/ka11y-letter-spacing/);
    await widget.reset.click();
    await expectFeaturePressed(widget, 'letterSpacing', false);
    await expectFeaturePressed(widget, 'biggerText', false);
    await expect(page.locator('html')).not.toHaveClass(/ka11y-letter-spacing/);
    await expect
      .poll(() => heading.evaluate((element) => parseFloat(getComputedStyle(element).fontSize)))
      .toBeCloseTo(original, 1);
    const saved = await page.evaluate(() => window.localStorage.getItem('ka11y'));
    expect(saved).toBeNull();
    await page.reload();
    await expect(page.locator('html')).not.toHaveClass(/ka11y-letter-spacing/);
  });

  test('profile toggle applies and removes its features but keeps separately enabled ones', async ({ page }) => {
    const widget = await gotoHome(page);
    await openPanel(page, widget);
    await widget.feature('highlightLinks').click();
    await expectFeaturePressed(widget, 'highlightLinks', true);

    await widget.profile('visionImpaired').click();
    await expect(widget.profile('visionImpaired')).toHaveAttribute('aria-pressed', 'true');
    await expectFeaturePressed(widget, 'biggerText', true);
    await expectFeaturePressed(widget, 'readableFont', true);
    await expectFeaturePressed(widget, 'highContrast', true);
    await expectFeaturePressed(widget, 'bigCursor', true);

    await widget.profile('visionImpaired').click();
    await expect(widget.profile('visionImpaired')).toHaveAttribute('aria-pressed', 'false');
    await expectFeaturePressed(widget, 'biggerText', false);
    await expectFeaturePressed(widget, 'readableFont', false);
    await expectFeaturePressed(widget, 'highContrast', false);
    await expectFeaturePressed(widget, 'highlightLinks', true);
  });

  test('contrast features are mutually exclusive', async ({ page }) => {
    const widget = await gotoHome(page);
    await openPanel(page, widget);
    await widget.feature('darkContrast').click();
    await expectFeaturePressed(widget, 'darkContrast', true);
    await widget.feature('lightContrast').click();
    await expectFeaturePressed(widget, 'lightContrast', true);
    await expectFeaturePressed(widget, 'darkContrast', false);
    await widget.feature('highContrast').click();
    await expectFeaturePressed(widget, 'highContrast', true);
    await expectFeaturePressed(widget, 'lightContrast', false);
    await expectFeaturePressed(widget, 'darkContrast', false);
  });

  test('filters apply to body children, never to html or body, and keep fixed elements in place', async ({ page }) => {
    const widget = await gotoHome(page);
    await page.evaluate(() => {
      const spacer = document.createElement('div');
      spacer.id = 'e2e-spacer';
      spacer.style.height = '4000px';
      document.body.append(spacer);
      const pinned = document.createElement('div');
      pinned.id = 'e2e-fixed';
      pinned.textContent = 'pinned';
      pinned.style.cssText = 'position:fixed;top:12px;left:12px;width:80px;height:24px;background:#c00;z-index:1';
      document.body.append(pinned);
      window.scrollTo(0, 300);
    });
    const before = await page.locator('#e2e-fixed').boundingBox();
    await openPanel(page, widget);
    await widget.feature('monochrome').click();
    await expectFeaturePressed(widget, 'monochrome', true);

    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.querySelector('#e2e-spacer') as HTMLElement).filter))
      .toContain('grayscale(1)');
    const filters = await page.evaluate(() => ({
      html: getComputedStyle(document.documentElement).filter,
      body: getComputedStyle(document.body).filter,
      child: getComputedStyle(document.querySelector('#e2e-spacer') as HTMLElement).filter,
      host: getComputedStyle(document.querySelector('#ka11y-root') as HTMLElement).filter,
    }));
    expect(filters.html).toBe('none');
    expect(filters.body).toBe('none');
    expect(filters.child).toContain('grayscale(1)');
    expect(filters.host).toBe('none');

    const after = await page.locator('#e2e-fixed').boundingBox();
    expect(after?.y).toBe(before?.y);
    expect(after?.x).toBe(before?.x);

    await page.evaluate(() => window.scrollTo(0, 900));
    const scrolled = await page.locator('#e2e-fixed').boundingBox();
    expect(scrolled?.y).toBe(before?.y);

    await widget.feature('highContrast').click();
    const combined = await page.evaluate(() => getComputedStyle(document.querySelector('#e2e-spacer') as HTMLElement).filter);
    expect(combined).toContain('contrast(1.5)');
    expect(combined).toContain('grayscale(1)');

    await widget.reset.click();
    const cleared = await page.evaluate(() => getComputedStyle(document.querySelector('#e2e-spacer') as HTMLElement).filter);
    expect(cleared).toBe('none');
  });
});
