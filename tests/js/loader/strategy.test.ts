import { startLoader } from '../../../src/ts/loader';
import type { InlineConfig, LoadStrategy, PrefetchMode } from '../../../src/ts/shared/types';
import { configure, createEnv, createFakes, flush, GROUPS, inlineConfig, jsonResponse, mountHost, panelData, stubFetch, type Env } from './helpers';

const configFor = (strategy: LoadStrategy, prefetch: PrefetchMode = 'hover'): InlineConfig => {
  const base = inlineConfig();
  return { ...base, load: { ...base.load, strategy, prefetch } };
};

const setReadyState = (value: DocumentReadyState): void => {
  Object.defineProperty(document, 'readyState', { value, configurable: true });
};

const scriptNames = (env: Env): string[] => env.scripts.map((script) => script.src.split('/').pop()?.split('?')[0] ?? '');

describe('loader strategies', () => {
  let env: Env;
  let idle: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    env = createEnv();
    jest.useFakeTimers();
    stubFetch(() => Promise.resolve(jsonResponse(panelData())));
    idle = jest.fn();
    (window as unknown as { requestIdleCallback: unknown }).requestIdleCallback = idle;
    mountHost();
  });

  afterEach(() => {
    delete (document as unknown as { readyState?: unknown }).readyState;
    delete (window as unknown as { requestIdleCallback?: unknown }).requestIdleCallback;
    env.dispose();
  });

  it('interaction injects nothing at boot', () => {
    configure(configFor('interaction'));
    startLoader({ groups: GROUPS });
    jest.advanceTimersByTime(20_000);
    expect(env.scripts).toHaveLength(0);
    expect(idle).not.toHaveBeenCalled();
  });

  it('idle waits for load and a requestIdleCallback', () => {
    setReadyState('interactive');
    configure(configFor('idle'));
    startLoader({ groups: GROUPS });
    expect(env.scripts).toHaveLength(0);
    window.dispatchEvent(new Event('load'));
    expect(idle).toHaveBeenCalledWith(expect.any(Function), { timeout: 3000 });
    expect(env.scripts).toHaveLength(0);
    idle.mock.calls[0][0]();
    expect(scriptNames(env).sort()).toEqual(['kernel.js', 'panel.js']);
  });

  it('idle falls back to a 1500 ms timeout without requestIdleCallback', () => {
    delete (window as unknown as { requestIdleCallback?: unknown }).requestIdleCallback;
    configure(configFor('idle'));
    startLoader({ groups: GROUPS });
    jest.advanceTimersByTime(1499);
    expect(env.scripts).toHaveLength(0);
    jest.advanceTimersByTime(1);
    expect(scriptNames(env).sort()).toEqual(['kernel.js', 'panel.js']);
  });

  it.each(['defer', 'async'] as const)('%s injects at once', (strategy) => {
    configure(configFor(strategy));
    startLoader({ groups: GROUPS });
    expect(scriptNames(env).sort()).toEqual(['kernel.js', 'panel.js']);
  });

  it('interaction with idle prefetch warms after load and idle', () => {
    configure(configFor('interaction', 'idle'));
    startLoader({ groups: GROUPS });
    expect(idle).toHaveBeenCalledTimes(1);
    idle.mock.calls[0][0]();
    expect(scriptNames(env).sort()).toEqual(['kernel.js', 'panel.js']);
  });

  it('eager injects nothing when every record arrives', () => {
    const fakes = createFakes();
    window.kotlinskidevA11yRuntime = { s: [], c: [] };
    configure(configFor('eager'));
    startLoader({ groups: GROUPS });
    window.kotlinskidevA11yRuntime?.c.push(
      fakes.kernelRecord,
      fakes.panelRecord,
      fakes.groupRecord('content'),
      fakes.groupRecord('color'),
      fakes.groupRecord('orientation'),
    );
    jest.advanceTimersByTime(10_000);
    expect(env.scripts).toHaveLength(0);
  });

  it('eager injects missing chunks after 10 s', () => {
    const fakes = createFakes();
    configure(configFor('eager'));
    startLoader({ groups: GROUPS });
    window.kotlinskidevA11yRuntime?.c.push(fakes.kernelRecord, fakes.panelRecord);
    jest.advanceTimersByTime(9999);
    expect(env.scripts).toHaveLength(0);
    jest.advanceTimersByTime(1);
    expect(scriptNames(env).sort()).toEqual(['color.js', 'content.js', 'orientation.js']);
  });

  it('warm never builds panel DOM', async () => {
    const fakes = createFakes();
    configure(configFor('defer'));
    startLoader({ groups: GROUPS });
    env.deliverByName('kernel', fakes.kernelRecord);
    env.deliverByName('panel', fakes.panelRecord);
    await flush();
    expect(fakes.mount).not.toHaveBeenCalled();
    expect(fakes.bootKernel).not.toHaveBeenCalled();
  });
});
