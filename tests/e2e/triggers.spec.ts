import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, PANEL_TIMEOUT, test, widgetFor } from './support/fixtures';
import type { WidgetLocators } from './support/fixtures';
import { BASE_URL } from './support/env';

type Strategy = 'interaction' | 'idle' | 'defer' | 'async' | 'eager';

interface PublicState {
  api: number;
  open: boolean;
  profile: string | null;
  features: Record<string, number>;
}

interface LoggedEvent {
  name: string;
  detail: { source?: string; api?: number; version?: string; state?: PublicState };
}

interface TriggerApi {
  api: number;
  open(opener?: HTMLElement | null): void;
  close(): void;
  toggle(target?: string, opener?: HTMLElement | null): void;
  set(feature: string, level: number | boolean): void;
  reset(): void;
  getState(): Promise<PublicState>;
  on(event: string, listener: (detail: unknown) => void): () => void;
}

interface FixtureWindow {
  kotlinskidevA11y: TriggerApi;
  __ka11yEvents: LoggedEvent[];
}

interface DialogCase {
  kind: 'dialog';
  id: string;
  selector: string;
  link: boolean;
  expanded: boolean;
}

interface StateCase {
  kind: 'feature' | 'profile';
  id: string;
  selector: string;
  link: boolean;
  key: string;
  level: number;
  htmlClass: RegExp | null;
}

type TriggerCase = DialogCase | StateCase;

const STRATEGIES: readonly Strategy[] = ['interaction', 'idle', 'defer', 'async', 'eager'];
const SMOKE_STRATEGIES: ReadonlySet<Strategy> = new Set<Strategy>(['interaction', 'eager']);
const SMOKE_CASES: ReadonlySet<string> = new Set(['hash-open', 'data-feature', 'php-function']);

const FIXTURE_COOKIE = { name: 'ka11y_fixture_triggers', value: '1' };
const CUSTOM_SELECTOR = '.fixture-a11y-menu > a';
const OPENED = 'aria-expanded';
const WIRING_TIMEOUT = 2_000;
const TOGGLE_GUARD_MS = 80;
const KNOWN_PRODUCT_BUGS: ReadonlySet<string> = new Set(['hash-open', 'class-open', 'custom-selector']);

const CASES: readonly TriggerCase[] = [
  { kind: 'dialog', id: 'hash-open', selector: '#t-hash', link: true, expanded: true },
  { kind: 'profile', id: 'hash-profile', selector: '#t-profile', link: true, key: 'adhdFriendly', level: 1, htmlClass: null },
  { kind: 'dialog', id: 'class-open', selector: '#t-class', link: false, expanded: true },
  { kind: 'feature', id: 'data-feature', selector: '#t-data', link: false, key: 'darkContrast', level: 1, htmlClass: /ka11y-dark-contrast/ },
  { kind: 'dialog', id: 'data-link-toggle', selector: '#t-link', link: true, expanded: true },
  { kind: 'dialog', id: 'custom-selector', selector: '#t-custom', link: true, expanded: true },
  { kind: 'dialog', id: 'shortcode', selector: '#t-shortcode button', link: false, expanded: true },
  { kind: 'feature', id: 'block', selector: '#t-block button', link: false, key: 'biggerText', level: 2, htmlClass: /ka11y-bigger-text/ },
  { kind: 'dialog', id: 'php-function', selector: '#t-php button', link: false, expanded: true },
  { kind: 'dialog', id: 'js-api', selector: '#api-open', link: false, expanded: false },
];

const stateOf = (page: Page): Promise<PublicState> => page.evaluate(() => (window as unknown as FixtureWindow).kotlinskidevA11y.getState());

const eventsOf = (page: Page): Promise<LoggedEvent[]> => page.evaluate(() => [...(window as unknown as FixtureWindow).__ka11yEvents]);

const installEventLog = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const log: LoggedEvent[] = [];
    Object.defineProperty(window, '__ka11yEvents', { value: log });
    for (const name of ['ready', 'open', 'close', 'change']) {
      document.addEventListener(`ka11y:${name}`, (event) => {
        log.push({ name, detail: JSON.parse(JSON.stringify((event as CustomEvent).detail ?? null)) as LoggedEvent['detail'] });
      });
    }
  });
};

const collectErrors = (page: Page): string[] => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
};

const waitForApi = async (page: Page): Promise<void> => {
  await page.waitForFunction(() => typeof (window as unknown as { kotlinskidevA11y?: { getState?: unknown } }).kotlinskidevA11y?.getState === 'function', undefined, {
    timeout: PANEL_TIMEOUT,
  });
};

const gotoFixture = async (page: Page, path = '/'): Promise<WidgetLocators> => {
  await page.goto(path);
  await expect(page.locator('#ka11y-fixture-triggers')).toBeAttached();
  await waitForApi(page);
  return widgetFor(page);
};

const expectOpen = async (widget: WidgetLocators): Promise<void> => {
  await expect(widget.panel).toBeVisible({ timeout: PANEL_TIMEOUT });
  await expect.poll(() => widget.panel.evaluate((panel) => getComputedStyle(panel).opacity), { timeout: PANEL_TIMEOUT }).toBe('1');
};

const expectClosed = async (page: Page): Promise<void> => {
  await expect.poll(async () => (await stateOf(page)).open, { timeout: PANEL_TIMEOUT }).toBe(false);
};

const closeWithEscape = async (page: Page): Promise<void> => {
  await page.keyboard.press('Escape');
  await expectClosed(page);
};

const resetThroughApi = async (page: Page): Promise<void> => {
  await page.evaluate(() => (window as unknown as FixtureWindow).kotlinskidevA11y.reset());
  await expect.poll(async () => JSON.stringify(await stateOf(page)).includes('"features":{}'), { timeout: PANEL_TIMEOUT }).toBe(true);
};

const storedState = (page: Page): Promise<{ levels?: Record<string, number>; profile?: string | null } | null> =>
  page.evaluate(() => {
    const raw = window.localStorage.getItem('ka11y');
    return raw === null ? null : (JSON.parse(raw) as { levels?: Record<string, number>; profile?: string | null });
  });

const hasStoredChange = async (page: Page): Promise<boolean> => {
  const stored = await storedState(page);
  if (stored === null) return false;
  const levels = Object.values(stored.levels ?? {}).filter((level) => Number(level) > 0);
  return levels.length > 0 || (stored.profile ?? null) !== null;
};

const activate = async (page: Page, selector: string, how: 'click' | 'Enter' | 'Space'): Promise<void> => {
  const trigger = page.locator(selector);
  if (how === 'click') {
    await trigger.click();
    return;
  }
  await trigger.focus();
  await page.keyboard.press(how);
};

const assertDialogEffect = async (page: Page, widget: WidgetLocators, spec: DialogCase): Promise<void> => {
  const trigger = page.locator(spec.selector);
  for (const how of ['click', 'Enter'] as const) {
    await page.waitForTimeout(TOGGLE_GUARD_MS);
    await activate(page, spec.selector, how);
    await expectOpen(widget);
    await closeWithEscape(page);
    await expect(trigger).toBeFocused();
  }
};

const assertDialogAria = async (page: Page, widget: WidgetLocators, spec: DialogCase): Promise<void> => {
  const trigger = page.locator(spec.selector);
  if (spec.link) await expect(trigger).toHaveAttribute('role', 'button', { timeout: WIRING_TIMEOUT });
  if (spec.expanded) await expect(trigger).toHaveAttribute(OPENED, 'false', { timeout: WIRING_TIMEOUT });
  for (const how of ['click', 'Space'] as const) {
    await page.waitForTimeout(TOGGLE_GUARD_MS);
    await activate(page, spec.selector, how);
    await expectOpen(widget);
    if (spec.expanded) await expect(trigger).toHaveAttribute(OPENED, 'true');
    await closeWithEscape(page);
    if (spec.expanded) await expect(trigger).toHaveAttribute(OPENED, 'false');
    await expect(trigger).toBeFocused();
  }
};

const isApplied = async (page: Page, spec: StateCase): Promise<boolean> => {
  const state = await stateOf(page);
  return spec.kind === 'profile' ? state.profile === spec.key : state.features[spec.key] === spec.level;
};

const expectApplied = async (page: Page, spec: StateCase): Promise<void> => {
  await expect.poll(() => isApplied(page, spec), { timeout: PANEL_TIMEOUT }).toBe(true);
  await expect(page.locator(spec.selector)).toHaveAttribute('aria-pressed', 'true');
  if (spec.htmlClass !== null) await expect(page.locator('html')).toHaveClass(spec.htmlClass);
};

const assertStateEffect = async (page: Page, spec: StateCase): Promise<void> => {
  await activate(page, spec.selector, 'click');
  await expectApplied(page, spec);
  expect((await stateOf(page)).open).toBe(false);

  await page.reload();
  await waitForApi(page);
  await expectApplied(page, spec);
  const restored = (await eventsOf(page)).filter((entry) => entry.name === 'change' && entry.detail.source === 'restore');
  expect(restored.length).toBeGreaterThan(0);

  await resetThroughApi(page);
  await expect(page.locator(spec.selector)).toHaveAttribute('aria-pressed', 'false');
  if (spec.htmlClass !== null) await expect(page.locator('html')).not.toHaveClass(spec.htmlClass);
  await activate(page, spec.selector, 'Enter');
  await expectApplied(page, spec);
};

const assertStatePressed = async (page: Page, spec: StateCase): Promise<void> => {
  const trigger = page.locator(spec.selector);
  if (spec.link) await expect(trigger).toHaveAttribute('role', 'button');
  await expect(trigger).toHaveAttribute('aria-pressed', 'false');
  await activate(page, spec.selector, 'Space');
  await expectApplied(page, spec);
};

for (const strategy of STRATEGIES) {
  const smoke = SMOKE_STRATEGIES.has(strategy);
  const tag = (condition = true): string => (smoke && condition ? ' @smoke' : '');

  test.describe(`triggers [${strategy}, launcher hidden]`, () => {
    test.beforeEach(async ({ context, page, settings }) => {
      await settings.patch({
        performance: { preset: 'custom', strategy },
        widget: { launcher: 'hidden' },
        triggers: { selectors: [CUSTOM_SELECTOR] },
      });
      await context.addCookies([{ ...FIXTURE_COOKIE, url: BASE_URL }]);
      await installEventLog(page);
    });

    for (const spec of CASES) {
      test(`${spec.id} takes effect by click and Enter${tag(SMOKE_CASES.has(spec.id))}`, async ({ page }) => {
        const errors = collectErrors(page);
        const widget = await gotoFixture(page);
        await expect(widget.launcher).toBeHidden();
        await expect(widget.host).toHaveAttribute('data-ka11y-launcher', 'hidden');
        if (spec.kind === 'dialog') await assertDialogEffect(page, widget, spec);
        else await assertStateEffect(page, spec);
        expect(errors).toEqual([]);
      });

      test(`${spec.id} wires ARIA and activates by Space${tag(SMOKE_CASES.has(spec.id))}`, async ({ page }) => {
        test.fail(KNOWN_PRODUCT_BUGS.has(spec.id), 'wireAria in src/ts/loader/triggers.ts skips this trigger kind');
        const widget = await gotoFixture(page);
        if (spec.kind === 'dialog') await assertDialogAria(page, widget, spec);
        else await assertStatePressed(page, spec);
      });
    }

    test(`unknown and disabled actions are ignored${tag()}`, async ({ page, settings }) => {
      await settings.patch({ features: { highContrast: { enabled: false } } });
      const errors = collectErrors(page);
      const widget = await gotoFixture(page);
      await page.locator('#t-unknown').click();
      await page.locator('#t-disabled').click();
      await page.evaluate(() => {
        const api = (window as unknown as FixtureWindow).kotlinskidevA11y;
        api.set('highContrast', 1);
        api.toggle('feature:highContrast');
        api.toggle('explode:now');
      });
      await page.locator('#t-data').click();
      await expect(page.locator('html')).toHaveClass(/ka11y-dark-contrast/);
      expect(await stateOf(page)).toEqual({ api: 1, open: false, profile: null, features: { darkContrast: 1 } });
      await expect(page.locator('html')).not.toHaveClass(/ka11y-high-contrast/);
      await expect(widget.panel).toHaveCount(0);
      expect(errors).toEqual([]);
    });

    test(`URL query applies a profile once and never stores it on its own${tag()}`, async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto('/?foo=1&ka11y=profile:adhdFriendly#keep');
      await waitForApi(page);
      await expect.poll(async () => (await stateOf(page)).profile, { timeout: PANEL_TIMEOUT }).toBe('adhdFriendly');
      await expect.poll(() => page.evaluate(() => location.search + location.hash)).toBe('?foo=1#keep');
      await expect(page.locator('#t-profile')).toHaveAttribute('aria-pressed', 'true');
      expect(await hasStoredChange(page)).toBe(false);

      await page.reload();
      await waitForApi(page);
      expect((await stateOf(page)).profile).toBeNull();

      await page.goto('/?ka11y=profile:adhdFriendly');
      await waitForApi(page);
      await expect.poll(async () => (await stateOf(page)).profile, { timeout: PANEL_TIMEOUT }).toBe('adhdFriendly');
      await page.locator('#t-data').click();
      await expect.poll(async () => (await stateOf(page)).features.darkContrast, { timeout: PANEL_TIMEOUT }).toBe(1);
      await expect.poll(() => hasStoredChange(page), { timeout: PANEL_TIMEOUT }).toBe(true);
      await page.goto('/');
      await waitForApi(page);
      await expect.poll(async () => (await stateOf(page)).profile, { timeout: PANEL_TIMEOUT }).toBe('adhdFriendly');
      expect((await stateOf(page)).features.darkContrast).toBe(1);
      expect(errors).toEqual([]);
    });

    test(`URL feature, landing hash, off and reset${tag()}`, async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto('/?ka11y=feature:darkContrast');
      await waitForApi(page);
      await expect.poll(async () => (await stateOf(page)).features.darkContrast, { timeout: PANEL_TIMEOUT }).toBe(1);
      expect(await hasStoredChange(page)).toBe(false);

      await page.goto('/#ka11y/feature:biggerText:2');
      await waitForApi(page);
      await expect.poll(async () => (await stateOf(page)).features.biggerText, { timeout: PANEL_TIMEOUT }).toBe(2);
      await expect.poll(() => page.evaluate(() => location.hash)).toBe('');
      expect(await hasStoredChange(page)).toBe(false);

      await page.goto('/');
      await waitForApi(page);
      await page.locator('#t-data').click();
      await expect.poll(() => hasStoredChange(page), { timeout: PANEL_TIMEOUT }).toBe(true);
      await page.goto('/?ka11y=reset');
      await waitForApi(page);
      expect(await stateOf(page)).toEqual({ api: 1, open: false, profile: null, features: {} });
      expect(await storedState(page)).toBeNull();

      await page.goto('/?ka11y=off');
      await expect(page.locator('html')).toHaveAttribute('data-ka11y-hidden', '');
      expect(errors).toEqual([]);
    });

    test(`URL actions outside the allowlist or disabled are ignored${tag()}`, async ({ page, settings }) => {
      await settings.patch({ features: { highContrast: { enabled: false } } });
      const errors = collectErrors(page);
      for (const action of ['toggle', 'close', 'statement', 'hide', 'explode', 'feature:highContrast', 'feature:__proto__']) {
        await page.goto(`/?ka11y=${encodeURIComponent(action)}`);
        await waitForApi(page);
        await page.locator('#t-data').click();
        await expect.poll(async () => (await stateOf(page)).features.darkContrast, { timeout: PANEL_TIMEOUT }).toBe(1);
        const state = await stateOf(page);
        expect(state.open).toBe(false);
        expect(state.profile).toBeNull();
        expect(Object.keys(state.features)).toEqual(['darkContrast']);
        expect(new URL(page.url(), BASE_URL).pathname).toBe('/');
        await page.evaluate(() => window.localStorage.clear());
      }
      expect(errors).toEqual([]);
    });

    test(`JS API methods and events${tag()}`, async ({ page }) => {
      const errors = collectErrors(page);
      const widget = await gotoFixture(page);

      const api = await page.evaluate(() => (window as unknown as FixtureWindow).kotlinskidevA11y.api);
      expect(api).toBe(1);
      const ready = (await eventsOf(page)).filter((entry) => entry.name === 'ready');
      expect(ready).toHaveLength(1);
      expect(ready[0]?.detail.api).toBe(1);
      expect(typeof ready[0]?.detail.version).toBe('string');
      const late = await page.evaluate(
        () =>
          new Promise<boolean>((resolve) => {
            (window as unknown as FixtureWindow).kotlinskidevA11y.on('ready', () => resolve(true));
          })
      );
      expect(late).toBe(true);

      await page.evaluate(() => (window as unknown as FixtureWindow).kotlinskidevA11y.open());
      await expectOpen(widget);
      expect((await stateOf(page)).open).toBe(true);
      await page.evaluate(() => (window as unknown as FixtureWindow).kotlinskidevA11y.toggle());
      await expectClosed(page);
      await page.evaluate(() => (window as unknown as FixtureWindow).kotlinskidevA11y.open());
      await expectOpen(widget);
      await page.evaluate(() => (window as unknown as FixtureWindow).kotlinskidevA11y.close());
      await expectClosed(page);
      const dialogEvents = (await eventsOf(page)).filter((entry) => entry.name === 'open' || entry.name === 'close');
      expect(dialogEvents.map((entry) => entry.name)).toEqual(['open', 'close', 'open', 'close']);
      expect(dialogEvents.every((entry) => typeof entry.detail.source === 'string')).toBe(true);

      const setLevel = async (feature: string, level: number | boolean, expected: number | undefined): Promise<void> => {
        await page.evaluate(({ name, value }) => (window as unknown as FixtureWindow).kotlinskidevA11y.set(name, value), { name: feature, value: level });
        await expect.poll(async () => (await stateOf(page)).features[feature], { timeout: PANEL_TIMEOUT }).toBe(expected);
      };
      await setLevel('darkContrast', true, 1);
      await expect(page.locator('html')).toHaveClass(/ka11y-dark-contrast/);
      await setLevel('biggerText', 2, 2);
      await setLevel('biggerText', 99, 3);
      await setLevel('biggerText', false, undefined);
      await page.evaluate(() => (window as unknown as FixtureWindow).kotlinskidevA11y.toggle('feature:darkContrast'));
      await expect.poll(async () => (await stateOf(page)).features.darkContrast, { timeout: PANEL_TIMEOUT }).toBeUndefined();
      await page.evaluate(() => (window as unknown as FixtureWindow).kotlinskidevA11y.toggle('profile:adhdFriendly'));
      await expect.poll(async () => (await stateOf(page)).profile, { timeout: PANEL_TIMEOUT }).toBe('adhdFriendly');

      const changes = (await eventsOf(page)).filter((entry) => entry.name === 'change');
      expect(changes.length).toBeGreaterThanOrEqual(5);
      expect(changes.every((entry) => entry.detail.source === 'api')).toBe(true);
      expect(changes.at(-1)?.detail.state?.profile).toBe('adhdFriendly');

      await page.evaluate(() => (window as unknown as FixtureWindow).kotlinskidevA11y.reset());
      await expect.poll(() => stateOf(page), { timeout: PANEL_TIMEOUT }).toEqual({ api: 1, open: false, profile: null, features: {} });

      const unsubscribed = await page.evaluate(async () => {
        const api = (window as unknown as FixtureWindow).kotlinskidevA11y;
        let calls = 0;
        const stop = api.on('change', () => {
          calls += 1;
        });
        api.set('darkContrast', 1);
        await api.getState();
        const afterFirst = calls;
        stop();
        api.set('darkContrast', 0);
        await api.getState();
        return { afterFirst, calls };
      });
      expect(unsubscribed.afterFirst).toBe(1);
      expect(unsubscribed.calls).toBe(1);
      expect(errors).toEqual([]);
    });

    test(`focus returns to the opener, the previous element or the page body${tag()}`, async ({ page }) => {
      const errors = collectErrors(page);
      const widget = await gotoFixture(page);

      await page.locator('#t-before').focus();
      await page.keyboard.press('Alt+Shift+A');
      await expectOpen(widget);
      await closeWithEscape(page);
      await expect(page.locator('#t-before')).toBeFocused();

      await page.locator('#t-before').focus();
      await page.evaluate(() => (window as unknown as FixtureWindow).kotlinskidevA11y.open());
      await expectOpen(widget);
      await closeWithEscape(page);
      await expect(page.locator('#t-before')).toBeFocused();

      await page.evaluate(() => {
        (document.activeElement as HTMLElement | null)?.blur();
      });
      await page.evaluate(() => (window as unknown as FixtureWindow).kotlinskidevA11y.open());
      await expectOpen(widget);
      await closeWithEscape(page);
      await expect.poll(() => page.evaluate(() => document.activeElement === document.body)).toBe(true);
      await expect.poll(() => page.evaluate(() => document.body.hasAttribute('tabindex'))).toBe(false);
      await expect(widget.launcher).toBeHidden();
      expect(errors).toEqual([]);
    });

    test(`page and open panel have no serious axe violations${tag()}`, async ({ page }) => {
      const widget = await gotoFixture(page);
      await expect(page.locator('#t-profile')).toHaveAttribute('role', 'button');
      const scan = async (selector: string): Promise<string[]> => {
        const results = await new AxeBuilder({ page }).include(selector).analyze();
        return results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? '')).map((violation) => `${violation.id}: ${violation.help}`);
      };
      expect(await scan('#ka11y-fixture-triggers')).toEqual([]);
      await page.locator('#t-class').click();
      await expectOpen(widget);
      expect(await scan('#ka11y-root')).toEqual([]);
    });

    test(`triggers clicked before the loader arrives apply exactly once${tag()}`, async ({ page }) => {
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route('**/build/loader.js*', async (route) => {
        await gate;
        await route.continue();
      });
      await page.goto('/', { waitUntil: 'commit' });
      await page.locator('#t-profile').click();
      await page.locator('#t-data').click();
      await page.locator('#t-shortcode button').click();
      release();
      const widget = widgetFor(page);
      await waitForApi(page);
      await expectOpen(widget);
      await expect.poll(async () => (await stateOf(page)).profile, { timeout: PANEL_TIMEOUT }).toBe('adhdFriendly');
      await expect.poll(async () => (await stateOf(page)).features.darkContrast, { timeout: PANEL_TIMEOUT }).toBe(1);
    });
  });
}
