import { createApi } from '../../../src/ts/admin/api';
import type { Fetcher } from '../../../src/ts/admin/api';

jest.mock('@wordpress/i18n', () => jest.requireActual('./wp-mocks').i18nMock, { virtual: true });
jest.mock('@wordpress/api-fetch', () => jest.requireActual('./wp-mocks').apiFetchMock, { virtual: true });

const ROOT = 'https://example.test/wp-json/kotlinskidev-a11y/v1/';

describe('admin api', () => {
  const fetcher = jest.fn();
  const api = createApi({ restRoot: ROOT, nonce: 'abc' }, fetcher as unknown as Fetcher);

  beforeEach(() => {
    fetcher.mockReset();
    fetcher.mockResolvedValue({ ok: true });
  });

  it('gets settings with the nonce header', async () => {
    await api.getSettings();
    expect(fetcher).toHaveBeenCalledWith({ url: `${ROOT}settings`, method: 'GET', headers: { 'X-WP-Nonce': 'abc' } });
  });

  it('posts settings as data', async () => {
    await api.saveSettings({ a: 1 });
    expect(fetcher).toHaveBeenCalledWith({ url: `${ROOT}settings`, method: 'POST', headers: { 'X-WP-Nonce': 'abc' }, data: { a: 1 } });
  });

  it('reads the schema', async () => {
    await api.getSchema();
    expect(fetcher).toHaveBeenCalledWith(expect.objectContaining({ url: `${ROOT}schema`, method: 'GET' }));
  });

  it('exports, imports and resets', async () => {
    await api.exportSettings();
    fetcher.mockResolvedValueOnce({ settings: { b: 2 }, dropped: [], locked: [] });
    await expect(api.importSettings({ b: 2 }, false)).resolves.toEqual({ settings: { b: 2 }, dropped: [], locked: [] });
    await api.resetSettings();
    expect(fetcher).toHaveBeenNthCalledWith(1, expect.objectContaining({ url: `${ROOT}export`, method: 'GET' }));
    expect(fetcher).toHaveBeenNthCalledWith(2, expect.objectContaining({ url: `${ROOT}import`, method: 'POST', data: { b: 2 } }));
    expect(fetcher).toHaveBeenNthCalledWith(3, expect.objectContaining({ url: `${ROOT}reset`, method: 'POST' }));
  });

  it('sends dry runs as a query flag and resets with paths', async () => {
    await api.previewSave({ a: 1 });
    await api.importSettings({ b: 2 }, true);
    await api.previewReset(['tokens']);
    await api.resetSettings(['tokens', 'theme']);
    await api.resetSettings();
    expect(fetcher).toHaveBeenNthCalledWith(1, expect.objectContaining({ url: `${ROOT}settings?dry_run=true`, method: 'POST', data: { a: 1 } }));
    expect(fetcher).toHaveBeenNthCalledWith(2, expect.objectContaining({ url: `${ROOT}import?dry_run=true`, data: { b: 2 } }));
    expect(fetcher).toHaveBeenNthCalledWith(3, expect.objectContaining({ url: `${ROOT}reset?dry_run=true`, data: { paths: ['tokens'] } }));
    expect(fetcher).toHaveBeenNthCalledWith(4, expect.objectContaining({ url: `${ROOT}reset`, data: { paths: ['tokens', 'theme'] } }));
    expect(fetcher).toHaveBeenNthCalledWith(5, expect.objectContaining({ url: `${ROOT}reset`, data: {} }));
  });

  it('appends the dry run flag to a plain permalink root', async () => {
    const plain = createApi({ restRoot: 'https://example.test/?rest_route=/ns/', nonce: 'n' }, fetcher as unknown as Fetcher);
    await plain.previewReset();
    expect(fetcher).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://example.test/?rest_route=/ns/reset&dry_run=true' }));
  });

  it('propagates rejections', async () => {
    fetcher.mockRejectedValue(new Error('boom'));
    await expect(api.getSettings()).rejects.toThrow('boom');
  });
});
