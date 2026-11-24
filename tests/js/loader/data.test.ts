import { createChunkLoader } from '../../../src/ts/loader/chunks';
import { inlineConfig, jsonResponse, panelData, stubFetch } from './helpers';

const [PRIMARY, FALLBACK] = inlineConfig().data as [string, string];

describe('loader panel data', () => {
  afterEach(() => {
    delete (globalThis as unknown as { fetch?: unknown }).fetch;
  });

  it('uses the primary url when it answers', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(jsonResponse(panelData())));
    const data = await createChunkLoader(inlineConfig(), '', null).fetchData();
    expect(data.hash).toBe('abcdef012345');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(PRIMARY, { credentials: 'same-origin' });
  });

  it('falls back to REST when the primary is 404', async () => {
    const fetchMock = stubFetch((url) => Promise.resolve(url === PRIMARY ? jsonResponse({}, false) : jsonResponse(panelData())));
    const data = await createChunkLoader(inlineConfig(), '', null).fetchData();
    expect(data.hash).toBe('abcdef012345');
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([PRIMARY, FALLBACK]);
  });

  it('falls back when the primary rejects', async () => {
    stubFetch((url) => (url === PRIMARY ? Promise.reject(new Error('network')) : Promise.resolve(jsonResponse(panelData()))));
    await expect(createChunkLoader(inlineConfig(), '', null).fetchData()).resolves.toMatchObject({ locale: 'en_US' });
  });

  it('rejects when both fail', async () => {
    stubFetch(() => Promise.resolve(jsonResponse({}, false)));
    await expect(createChunkLoader(inlineConfig(), '', null).fetchData()).rejects.toThrow();
  });

  it('memoizes a success', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(jsonResponse(panelData())));
    const loader = createChunkLoader(inlineConfig(), '', null);
    await Promise.all([loader.fetchData(), loader.fetchData()]);
    await loader.fetchData();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('clears the memo after a rejection', async () => {
    let failing = true;
    const fetchMock = stubFetch(() => Promise.resolve(failing ? jsonResponse({}, false) : jsonResponse(panelData())));
    const loader = createChunkLoader(inlineConfig(), '', null);
    await expect(loader.fetchData()).rejects.toThrow();
    failing = false;
    await expect(loader.fetchData()).resolves.toMatchObject({ hash: 'abcdef012345' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
