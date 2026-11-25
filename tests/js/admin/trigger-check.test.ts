import { checkTriggers, exceedsSelectorList, selectorIssue } from '../../../src/ts/admin/trigger-check';
import type { FetchLike, TriggerCheckInput } from '../../../src/ts/admin/trigger-check';

const input = (overrides: Partial<TriggerCheckInput> = {}): TriggerCheckInput => ({
  launcher: 'hidden',
  shortcutEnabled: true,
  selectors: [],
  homeUrl: 'https://example.test/',
  ...overrides,
});

const page = (body: string): FetchLike => jest.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(`<html><body>${body}</body></html>`) });

describe('checkTriggers', () => {
  it('skips the fetch unless the launcher is hidden', async () => {
    const fetcher = page('');
    expect(await checkTriggers(input({ launcher: 'floating' }), fetcher)).toEqual({ status: 'skipped' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('fetches the home page without credentials', async () => {
    const fetcher = page('');
    await checkTriggers(input(), fetcher);
    expect(fetcher).toHaveBeenCalledWith('https://example.test/', { credentials: 'omit' });
  });

  it('warns when nothing is found and the shortcut is on', async () => {
    expect((await checkTriggers(input(), page('<p>none</p>'))).status).toBe('warning');
  });

  it('errors when nothing is found and the shortcut is off', async () => {
    expect((await checkTriggers(input({ shortcutEnabled: false }), page('<p>none</p>'))).status).toBe('error');
  });

  it.each([
    '<a href="#kotlinskidev-a11y">x</a>',
    '<a href="#ka11y/profile:adhdFriendly">x</a>',
    '<button class="ka11y-open">x</button>',
    '<button data-ka11y="feature:darkContrast">x</button>',
  ])('finds %s', async (markup) => {
    expect((await checkTriggers(input({ shortcutEnabled: false }), page(markup))).status).toBe('found');
  });

  it('ignores the html error flag', async () => {
    const fetcher: FetchLike = jest.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('<html data-ka11y="error"><body></body></html>') });
    expect((await checkTriggers(input(), fetcher)).status).toBe('warning');
  });

  it('finds custom selectors and survives invalid ones', async () => {
    const markup = '<ul class="menu"><li><a href="/x">A11y</a></li></ul>';
    expect((await checkTriggers(input({ selectors: ['(((', '.menu > li > a'] }), page(markup))).status).toBe('found');
    expect((await checkTriggers(input({ selectors: ['((('] }), page(markup))).status).toBe('warning');
  });

  it('reports a failed fetch and a bad response as unreachable', async () => {
    const failing: FetchLike = jest.fn().mockRejectedValue(new Error('offline'));
    const bad: FetchLike = jest.fn().mockResolvedValue({ ok: false, text: () => Promise.resolve('') });
    expect((await checkTriggers(input(), failing)).status).toBe('unreachable');
    expect((await checkTriggers(input(), bad)).status).toBe('unreachable');
  });
});

describe('selector rules', () => {
  it('flags invalid, broad and long selectors', () => {
    expect(selectorIssue('.ok > a')).toBeNull();
    expect(selectorIssue('(((')).toBe('invalid');
    expect(selectorIssue('body')).toBe('broad');
    expect(selectorIssue('.a, *')).toBe('broad');
    expect(selectorIssue(`.${'a'.repeat(200)}`)).toBe('long');
  });

  it('applies the 10 entry and 300 character limits', () => {
    expect(exceedsSelectorList(Array.from({ length: 10 }, (_, index) => `.a${index}`))).toBe(false);
    expect(exceedsSelectorList(Array.from({ length: 11 }, (_, index) => `.a${index}`))).toBe(true);
    expect(exceedsSelectorList([`.${'a'.repeat(150)}`, `.${'b'.repeat(150)}`])).toBe(true);
  });
});
