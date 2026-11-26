import type { Fetcher } from '../../../src/ts/admin/api';
import { buildMaintenancePanel } from '../../../src/ts/admin/panels/maintenance';
import { isSameOriginUrl } from '../../../src/ts/admin/updates';
import type { ChannelState } from '../../../src/ts/admin/updates';
import { sampleContext } from './helpers';

jest.mock('@wordpress/i18n', () => jest.requireActual('./wp-mocks').i18nMock, { virtual: true });

const state = (overrides: Partial<ChannelState> = {}): ChannelState => ({
  channel: 'stable',
  stored: 'stable',
  locked: false,
  updaterEnabled: true,
  floor: '0.4.0',
  ...overrides,
});

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const fakeFetcher = (routes: Record<string, unknown>): { fetcher: Fetcher; calls: Array<{ url?: string; method?: string; data?: unknown; headers?: Record<string, string> }> } => {
  const calls: Array<{ url?: string; method?: string; data?: unknown; headers?: Record<string, string> }> = [];
  const fetcher = (<T,>(options: { url?: string; method?: string; data?: unknown; headers?: Record<string, string> }): Promise<T> => {
    calls.push(options);
    const key = `${options.method} ${(options.url ?? '').replace(/^.*kotlinskidev-a11y\/v1\//, '')}`;
    const value = routes[key];
    return value instanceof Error ? Promise.reject(value) : Promise.resolve(value as T);
  }) as Fetcher;
  return { fetcher, calls };
};

const mount = async (routes: Record<string, unknown>) => {
  const ctx = sampleContext();
  const { fetcher, calls } = fakeFetcher(routes);
  const panel = buildMaintenancePanel(ctx, fetcher);
  document.body.replaceChildren(panel);
  await settle();
  return { ctx, panel, calls };
};

describe('updates card', () => {
  it('is absent without a fetcher', () => {
    const panel = buildMaintenancePanel(sampleContext(), null);
    expect(panel.querySelector('.ka11y-card--updates')).toBeNull();
  });

  it('is removed when the user may not manage updates', async () => {
    const { panel } = await mount({ 'GET update-channel': new Error('forbidden') });
    expect(panel.querySelector('.ka11y-card--updates')).toBeNull();
    expect(panel.querySelector('h3')?.textContent).toBe('Uninstall');
  });

  it('shows the channel select and does not call GitHub routes on load', async () => {
    const { panel, calls } = await mount({ 'GET update-channel': state({ channel: 'beta' }) });
    const card = panel.querySelector('.ka11y-card--updates') as HTMLElement;
    const select = card.querySelector('select') as HTMLSelectElement;
    expect(card.hidden).toBe(false);
    expect(select.value).toBe('beta');
    expect(select.disabled).toBe(false);
    expect(calls.map((call) => call.url?.includes('releases'))).not.toContain(true);
    expect(calls[0]?.headers?.['X-WP-Nonce']).toBe(sampleContext().config.nonce);
  });

  it('disables the select when a constant locks the channel', async () => {
    const { panel } = await mount({ 'GET update-channel': state({ locked: true }) });
    const select = panel.querySelector('select') as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect(panel.querySelector('#ka11y-update-channel-help')?.textContent).toBe('Locked by site configuration.');
  });

  it('disables everything when the updater is off', async () => {
    const { panel } = await mount({ 'GET update-channel': state({ updaterEnabled: false }) });
    expect((panel.querySelector('select') as HTMLSelectElement).disabled).toBe(true);
    expect((panel.querySelector('.ka11y-card--updates button') as HTMLButtonElement).hidden).toBe(true);
  });

  it('posts the chosen channel and reports success', async () => {
    const { ctx, panel, calls } = await mount({
      'GET update-channel': state(),
      'POST update-channel': state({ channel: 'beta', stored: 'beta' }),
    });
    const select = panel.querySelector('select') as HTMLSelectElement;
    select.value = 'beta';
    select.dispatchEvent(new Event('change'));
    await settle();
    expect(calls.at(-1)).toMatchObject({ method: 'POST', data: { channel: 'beta' } });
    expect(ctx.notices.element.textContent).toBe('Update channel saved.');
    expect(select.value).toBe('beta');
  });

  it('reports a failed save', async () => {
    const { ctx, panel } = await mount({ 'GET update-channel': state(), 'POST update-channel': Object.assign(new Error('Locked'), { message: 'Locked' }) });
    (panel.querySelector('select') as HTMLSelectElement).dispatchEvent(new Event('change'));
    await settle();
    expect(ctx.notices.element.textContent).toBe('Locked');
  });

  it('lists rollback links from the server on demand', async () => {
    const origin = window.location.origin;
    const { panel, calls } = await mount({
      'GET update-channel': state(),
      'GET releases?refresh=true': {
        releases: [
          { version: '0.4.0', prerelease: false, url: `${origin}/wp-admin/admin.php?page=kotlinskidev-a11y-rollback&version=0.4.0&_wpnonce=abc` },
          { version: '0.3.0', prerelease: true, url: 'https://evil.example.test/steal' },
        ],
      },
    });
    (panel.querySelector('.ka11y-card--updates button') as HTMLButtonElement).click();
    await settle();
    const links = [...panel.querySelectorAll<HTMLAnchorElement>('.ka11y-rollback-list a')];
    expect(links.map((link) => link.textContent)).toEqual(['Roll back to 0.4.0']);
    expect(links[0]?.href).toContain('kotlinskidev-a11y-rollback');
    expect(calls.at(-1)?.url).toContain('releases?refresh=true');
  });

  it('says so when nothing can be rolled back to', async () => {
    const { panel } = await mount({ 'GET update-channel': state(), 'GET releases?refresh=true': { releases: [] } });
    (panel.querySelector('.ka11y-card--updates button') as HTMLButtonElement).click();
    await settle();
    expect(panel.querySelector('.ka11y-rollback-list')?.textContent).toBe('No older versions are available for rollback.');
  });

  it('keeps the uninstall card', async () => {
    const { panel } = await mount({ 'GET update-channel': state() });
    expect(panel.querySelector('[data-ka11y-path="maintenance.keepDataOnUninstall"]')).not.toBeNull();
  });
});

describe('isSameOriginUrl', () => {
  it('accepts only the page origin', () => {
    expect(isSameOriginUrl('/wp-admin/x', 'https://a.test')).toBe(true);
    expect(isSameOriginUrl('https://a.test/y', 'https://a.test')).toBe(true);
    expect(isSameOriginUrl('https://b.test/y', 'https://a.test')).toBe(false);
    expect(isSameOriginUrl('javascript:alert(1)', 'https://a.test')).toBe(false);
  });
});

describe('updates card in network scope', () => {
  it('talks to the site-level update routes', async () => {
    const ctx = sampleContext();
    ctx.schema.scope = 'network';
    ctx.config.restRoot = 'https://example.test/wp-json/kotlinskidev-a11y/v1/network/';
    const { fetcher, calls } = fakeFetcher({ 'GET update-channel': state() });
    document.body.replaceChildren(buildMaintenancePanel(ctx, fetcher));
    await settle();
    expect(calls[0]?.url).toBe('https://example.test/wp-json/kotlinskidev-a11y/v1/update-channel');
  });
});
