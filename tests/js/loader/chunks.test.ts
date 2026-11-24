import { startLoader } from '../../../src/ts/loader';
import { attachRuntime, createChunkLoader, type ChunkLoader } from '../../../src/ts/loader/chunks';
import type { ChunkRecord } from '../../../src/ts/shared/types';
import {
  BASE,
  configure,
  createEnv,
  createFakes,
  flush,
  GROUPS,
  inlineConfig,
  jsonResponse,
  mountHost,
  panelData,
  stubFetch,
  type Env,
} from './helpers';

const createLoader = (nonce = '', cfasync: string | null = null): ChunkLoader => {
  const loader = createChunkLoader(inlineConfig(), nonce, cfasync);
  attachRuntime(loader.register);
  return loader;
};

describe('loader chunk loading', () => {
  let env: Env;

  beforeEach(() => {
    jest.useFakeTimers();
    env = createEnv();
    jest.useFakeTimers();
  });

  afterEach(() => env.dispose());

  it('injects an absolute url with the ver query', () => {
    const loader = createLoader();
    void loader.load('kernel', 'high');
    expect(env.scripts).toHaveLength(1);
    expect(env.scripts[0]?.src).toBe(`${BASE}kernel.js?ver=k1`);
    expect(env.scripts[0]?.async).toBe(false);
  });

  it('copies the nonce and data-cfasync', () => {
    const loader = createLoader('abc123', 'false');
    void loader.load('kernel', 'high');
    expect(env.scripts[0]?.nonce).toBe('abc123');
    expect(env.scripts[0]?.getAttribute('data-cfasync')).toBe('false');
  });

  it('omits data-cfasync when the loader had none', () => {
    const loader = createLoader('abc123');
    void loader.load('kernel', 'high');
    expect(env.scripts[0]?.hasAttribute('data-cfasync')).toBe(false);
  });

  it('uses the requested fetch priority', () => {
    const loader = createLoader();
    void loader.load('kernel', 'high');
    void loader.load('panel', 'low');
    const priorities = env.scripts.map((script) => script.getAttribute('fetchpriority'));
    expect(priorities).toEqual(['high', 'low']);
  });

  it('resolves with the factory result once the record registers', async () => {
    const fakes = createFakes();
    const loader = createLoader();
    const loading = loader.load('kernel', 'high');
    env.deliverByName('kernel', fakes.kernelRecord);
    await expect(loading).resolves.toEqual({ bootKernel: fakes.bootKernel });
  });

  it('passes the kernel exports to other factories', async () => {
    const fakes = createFakes();
    const factory = jest.fn(() => ({ ok: true }));
    const loader = createLoader();
    const loading = loader.load('panel', 'high');
    env.deliverByName('kernel', fakes.kernelRecord);
    env.deliverByName('panel', ['panel', 1, factory]);
    await expect(loading).resolves.toEqual({ ok: true });
    expect(factory).toHaveBeenCalledWith({ bootKernel: fakes.bootKernel });
  });

  it('is independent of script order, even for a record that arrives early', async () => {
    const fakes = createFakes();
    const loader = createLoader();
    window.kotlinskidevA11yRuntime?.c.push(fakes.panelRecord);
    const loading = loader.load('panel', 'high');
    await flush();
    expect(env.scripts.map((script) => script.src)).toEqual([`${BASE}kernel.js?ver=k1`]);
    env.deliverByName('kernel', fakes.kernelRecord);
    await expect(loading).resolves.toEqual({ mount: fakes.mount });
  });

  it('ignores a duplicate record', async () => {
    const loader = createLoader();
    const first = jest.fn(() => 'first');
    const second = jest.fn(() => 'second');
    window.kotlinskidevA11yRuntime?.c.push(['kernel', 1, first], ['kernel', 1, second]);
    await expect(loader.load('kernel', 'high')).resolves.toBe('first');
    expect(second).not.toHaveBeenCalled();
    expect(env.scripts).toHaveLength(0);
  });

  it('drains records pushed before the loader ran', () => {
    const fakes = createFakes();
    window.kotlinskidevA11yRuntime = { s: [], c: [fakes.kernelRecord] };
    const loader = createLoader();
    expect(loader.has('kernel')).toBe(true);
  });

  it('treats an ABI mismatch as a failure and retries once', async () => {
    const loader = createLoader();
    const loading = loader.load('kernel', 'high');
    const settled = loading.catch((error: Error) => error);
    const stale: ChunkRecord = ['kernel', 2, () => ({})];
    env.deliverByName('kernel', stale);
    await flush();
    jest.advanceTimersByTime(1000);
    await flush();
    env.deliver(env.scripts[1] as HTMLScriptElement, stale);
    expect(await settled).toBeInstanceOf(Error);
    expect(loader.has('kernel')).toBe(false);
    expect(env.scripts).toHaveLength(2);
  });

  it('retries once with &retry=1 after 1000 ms and then succeeds', async () => {
    const fakes = createFakes();
    const loader = createLoader();
    const loading = loader.load('kernel', 'high');
    env.fail(env.scripts[0] as HTMLScriptElement);
    await flush();
    expect(env.scripts).toHaveLength(1);
    jest.advanceTimersByTime(999);
    await flush();
    expect(env.scripts).toHaveLength(1);
    jest.advanceTimersByTime(1);
    await flush();
    expect(env.scripts).toHaveLength(2);
    expect(env.scripts[1]?.src).toBe(`${BASE}kernel.js?ver=k1&retry=1`);
    env.deliver(env.scripts[1] as HTMLScriptElement, fakes.kernelRecord);
    await expect(loading).resolves.toBeDefined();
  });

  it('rejects after a second failure', async () => {
    const loader = createLoader();
    const settled = loader.load('kernel', 'high').catch((error: Error) => error);
    env.fail(env.scripts[0] as HTMLScriptElement);
    await flush();
    jest.advanceTimersByTime(1000);
    await flush();
    env.fail(env.scripts[1] as HTMLScriptElement);
    expect(await settled).toBeInstanceOf(Error);
    expect(env.scripts).toHaveLength(2);
  });

  it('counts a 15 s timeout as an error', async () => {
    const loader = createLoader();
    const settled = loader.load('kernel', 'high').catch((error: Error) => error);
    jest.advanceTimersByTime(15_000);
    await flush();
    expect(env.scripts).toHaveLength(1);
    jest.advanceTimersByTime(1000);
    await flush();
    expect(env.scripts).toHaveLength(2);
    jest.advanceTimersByTime(15_000);
    expect(await settled).toBeInstanceOf(Error);
  });

  it('removes a failed script element', async () => {
    const parent = document.createElement('div');
    const loader = createLoader();
    void loader.load('kernel', 'high').catch(() => undefined);
    const script = env.scripts[0] as HTMLScriptElement;
    parent.append(script);
    env.fail(script);
    expect(script.isConnected).toBe(false);
  });

  it('clears a rejected load so the next call retries', async () => {
    const fakes = createFakes();
    const loader = createLoader();
    const first = loader.load('kernel', 'high').catch(() => undefined);
    env.fail(env.scripts[0] as HTMLScriptElement);
    await flush();
    jest.advanceTimersByTime(1000);
    await flush();
    env.fail(env.scripts[1] as HTMLScriptElement);
    await first;
    const again = loader.load('kernel', 'high');
    expect(env.scripts).toHaveLength(3);
    env.deliver(env.scripts[2] as HTMLScriptElement, fakes.kernelRecord);
    await expect(again).resolves.toBeDefined();
  });
});

describe('loader open flow failure and recovery', () => {
  let env: Env;

  beforeEach(() => {
    jest.useFakeTimers();
    env = createEnv();
    jest.useFakeTimers();
    stubFetch(() => Promise.resolve(jsonResponse(panelData())));
  });

  afterEach(() => env.dispose());

  it('shows the error state on the launcher and recovers on the next click', async () => {
    const fakes = createFakes();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    configure(inlineConfig());
    const host = mountHost();
    const launcher = host.shadowRoot?.querySelector('.ka11y-launcher') as HTMLElement;
    startLoader({ groups: GROUPS, nonce: 'n1' });
    launcher.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(host.dataset.state).toBe('loading');
    env.scripts.filter((script) => script.src.includes('panel.js')).forEach((script) => env.fail(script));
    env.scripts.filter((script) => script.src.includes('kernel.js')).forEach((script) => env.fail(script));
    await flush();
    jest.advanceTimersByTime(1000);
    await flush();
    env.scripts.filter((script) => script.src.includes('retry=1')).forEach((script) => env.fail(script));
    await flush();
    expect(host.dataset.state).toBe('error');
    expect(launcher.getAttribute('aria-label')).toBe('Could not load. Try again.');
    expect(warn).toHaveBeenCalledWith('[kotlinskidev-a11y]', expect.any(String));

    jest.advanceTimersByTime(100);
    launcher.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(host.dataset.state).toBe('loading');
    expect(launcher.getAttribute('aria-label')).toBe('Open accessibility settings');
    const fresh = env.scripts.slice(-2);
    expect(fresh.every((script) => !script.src.includes('retry=1'))).toBe(true);
    const freshKernel = fresh.find((script) => script.src.includes('kernel.js')) as HTMLScriptElement;
    const freshPanel = fresh.find((script) => script.src.includes('panel.js')) as HTMLScriptElement;
    env.deliver(freshKernel, fakes.kernelRecord);
    env.deliver(freshPanel, fakes.panelRecord);
    await flush();
    expect(host.dataset.state).toBeUndefined();
    expect(fakes.dialog.toggle).toHaveBeenCalledTimes(1);
  });

  it('propagates the nonce to injected chunks from a user action', async () => {
    configure(inlineConfig());
    const host = mountHost();
    startLoader({ groups: GROUPS, nonce: 'n1', cfasync: 'false' });
    host.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await flush();
    expect(env.scripts.length).toBeGreaterThan(0);
    env.scripts.forEach((script) => {
      expect(script.nonce).toBe('n1');
      expect(script.getAttribute('data-cfasync')).toBe('false');
      expect(script.getAttribute('fetchpriority')).toBe('high');
    });
  });

  it('boots the kernel and mounts with the merged config on open', async () => {
    const fakes = createFakes();
    configure(inlineConfig());
    const host = mountHost();
    startLoader({ groups: GROUPS });
    host.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    env.deliverByName('kernel', fakes.kernelRecord);
    env.deliverByName('panel', fakes.panelRecord);
    await flush();
    expect(fakes.bootKernel).toHaveBeenCalledTimes(1);
    expect(fakes.kernelApi.ensurePageCss).toHaveBeenCalled();
    const options = fakes.mount.mock.calls[0]?.[0] as { config: { strings: Record<string, string>; hash: string }; shadow: ShadowRoot };
    expect(options.shadow).toBe(host.shadowRoot);
    expect(options.config.strings.open).toBe('Open accessibility settings');
    expect(options.config.strings.panelTitle).toBe('Accessibility');
    expect(fakes.dialog.toggle).toHaveBeenCalledTimes(1);
  });

  it('forwards the command opener to the dialog', async () => {
    const fakes = createFakes();
    configure(inlineConfig());
    const host = mountHost();
    startLoader({ groups: GROUPS });
    const opener = document.createElement('button');
    window.kotlinskidevA11yQueue?.push({ action: 'open', source: 'api', opener });
    env.deliverByName('kernel', fakes.kernelRecord);
    env.deliverByName('panel', fakes.panelRecord);
    await flush();
    expect(host.dataset.state).toBeUndefined();
    expect(fakes.dialog.open).toHaveBeenCalledWith(opener);
  });

  it('leaves launcher clicks to the dialog once the panel is mounted', async () => {
    const fakes = createFakes();
    configure(inlineConfig());
    const host = mountHost();
    startLoader({ groups: GROUPS });
    host.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    env.deliverByName('kernel', fakes.kernelRecord);
    env.deliverByName('panel', fakes.panelRecord);
    await flush();
    expect(fakes.dialog.toggle).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(100);
    host.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await flush();
    expect(fakes.dialog.toggle).toHaveBeenCalledTimes(1);
    window.kotlinskidevA11yQueue?.push({ action: 'close', source: 'api' });
    await flush();
    expect(fakes.dialog.close).toHaveBeenCalledTimes(1);
  });

  it('ignores prototype keys in the saved runtime list', () => {
    window.kotlinskidevA11yRuntime = { s: ['__proto__', 'constructor', 'toString'], c: [] };
    configure(inlineConfig());
    mountHost();
    startLoader({ groups: GROUPS });
    expect(env.scripts.map((script) => script.src.split('/').pop()?.split('?')[0])).toEqual(['kernel.js']);
  });

  it('falls back to a built-in message when the load error string is empty', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    configure(inlineConfig({ strings: { open: 'Open accessibility settings', loadError: '' } }));
    const host = mountHost();
    const launcher = host.shadowRoot?.querySelector('.ka11y-launcher') as HTMLElement;
    startLoader({ groups: GROUPS, nonce: 'n1' });
    launcher.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    env.scripts.forEach((script) => env.fail(script));
    await flush();
    jest.advanceTimersByTime(1000);
    await flush();
    env.scripts.filter((script) => script.src.includes('retry=1')).forEach((script) => env.fail(script));
    await flush();
    expect(host.dataset.state).toBe('error');
    expect(launcher.getAttribute('aria-label')).not.toBe('');
    expect(launcher.getAttribute('aria-label')).toBe('Try again');
    expect(warn).toHaveBeenCalled();
  });

  it('loads the kernel and saved groups regardless of strategy and boots once', async () => {
    const fakes = createFakes();
    window.kotlinskidevA11yRuntime = { s: ['biggerText', 'darkContrast'], c: [] };
    configure(inlineConfig());
    mountHost();
    startLoader({ groups: GROUPS });
    expect(env.scripts.map((script) => script.src.split('/').pop()?.split('?')[0]).sort()).toEqual([
      'color.js',
      'content.js',
      'kernel.js',
    ]);
    env.deliverByName('kernel', fakes.kernelRecord);
    env.deliverByName('content', fakes.groupRecord('content'));
    env.deliverByName('color', fakes.groupRecord('color'));
    await flush();
    expect(fakes.bootKernel).toHaveBeenCalledTimes(1);
    expect(fakes.kernelApi.addFeatures).toHaveBeenCalledTimes(2);
    expect(fakes.mount).not.toHaveBeenCalled();
  });

  it('exposes groupOf and loadGroup to the kernel and loads a group once', async () => {
    const fakes = createFakes();
    configure(inlineConfig());
    const host = mountHost();
    startLoader({ groups: GROUPS });
    host.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    env.deliverByName('kernel', fakes.kernelRecord);
    await flush();
    const options = fakes.bootKernel.mock.calls[0]?.[0] as {
      groupOf(key: string): string | null;
      loadGroup(name: 'content'): Promise<void>;
    };
    expect(options.groupOf('biggerText')).toBe('content');
    expect(options.groupOf('unknown')).toBeNull();
    ['__proto__', 'constructor', 'toString', 'hasOwnProperty'].forEach((key) => expect(options.groupOf(key)).toBeNull());
    const first = options.loadGroup('content');
    void options.loadGroup('content');
    env.deliverByName('content', fakes.groupRecord('content'));
    await first;
    expect(fakes.kernelApi.addFeatures).toHaveBeenCalledTimes(1);
    expect(env.scripts.filter((script) => script.src.includes('content.js'))).toHaveLength(1);
  });
});
