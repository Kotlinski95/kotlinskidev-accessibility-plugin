import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export const FEATURE_LEVELS: Readonly<Record<string, number>> = {
  biggerText: 3,
  lineHeight: 3,
  letterSpacing: 1,
  fontWeight: 1,
  readableFont: 1,
  dyslexicFont: 1,
  textAlign: 3,
  highlightLinks: 1,
  bigCursor: 1,
  textMagnifier: 1,
  cognitiveReading: 1,
  darkContrast: 1,
  lightContrast: 1,
  highContrast: 1,
  monochrome: 1,
  saturation: 2,
  readingLine: 1,
  readingMask: 1,
  readPage: 1,
  keyboardNavigation: 1,
  hideImages: 1,
  muteSounds: 1,
  highlightTitles: 1,
  highlightAll: 1,
  stopAnimations: 1,
  skipToContent: 1,
};

export const PROFILE_KEYS: readonly string[] = ['visionImpaired', 'seizureSafe', 'adhdFriendly', 'blindness', 'epilepsySafe'];

export const LINK_SELECTOR = '#e2e-link';
export const LINK_HASH = '#e2e-target';

const PARAGRAPHS = 80;

export const kebab = (name: string): string => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

export const installLongContent = async (page: Page): Promise<void> => {
  await page.addInitScript(
    ({ count, linkId, targetId }) => {
      const build = (): void => {
        if (document.getElementById('e2e-long')) return;
        const wrapper = document.createElement('div');
        wrapper.id = 'e2e-long';
        const link = document.createElement('a');
        link.id = linkId;
        link.href = `#${targetId}`;
        link.textContent = 'Jump to the end of the fixture content';
        wrapper.append(link);
        for (let index = 0; index < count; index += 1) {
          const paragraph = document.createElement('p');
          paragraph.textContent = `Fixture paragraph ${index}. The quick brown fox jumps over the lazy dog while the page keeps scrolling.`;
          wrapper.append(paragraph);
        }
        const target = document.createElement('p');
        target.id = targetId;
        target.textContent = 'End of the fixture content.';
        wrapper.append(target);
        document.body.prepend(wrapper);
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build, { once: true });
      else build();
    },
    { count: PARAGRAPHS, linkId: LINK_SELECTOR.slice(1), targetId: LINK_HASH.slice(1) }
  );
};

export const assertPageUsable = async (page: Page): Promise<void> => {
  await page.mouse.move(320, 240);
  await page.mouse.move(340, 260);

  const root = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return {
      position: style.position,
      pointerEvents: style.pointerEvents,
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
    };
  });
  expect(root.position).toBe('static');
  expect(root.pointerEvents).toBe('auto');
  expect(root.scrollHeight).toBeGreaterThan(root.innerHeight * 1.2);

  await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'instant' }));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

  const hits = await page.evaluate(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const points: Array<[number, number]> = [
      [5, 5],
      [width - 5, 5],
      [width / 2, height / 2],
      [5, height - 5],
      [width - 5, height - 5],
    ];
    return points.map(([x, y]) => {
      const element = document.elementFromPoint(x, y);
      return {
        isRoot: element === document.documentElement,
        isNull: element === null,
        isBlockingOverlay:
          element !== null &&
          (element.classList.contains('ka11y-overlay') || element.hasAttribute('data-ka11y-overlay')) &&
          getComputedStyle(element).pointerEvents !== 'none',
      };
    });
  });
  hits.forEach((hit) => {
    expect(hit.isRoot).toBe(false);
    expect(hit.isNull).toBe(false);
    expect(hit.isBlockingOverlay).toBe(false);
  });

  await page.locator(LINK_SELECTOR).click();
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(LINK_HASH);
  await page.evaluate(() => {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
};
