import { startLoader } from '../../../src/ts/loader';
import { installQueue } from '../../../src/ts/loader/queue';
import type { KA11yCommand } from '../../../src/ts/shared/types';
import { configure, createEnv, createFakes, flush, GROUPS, inlineConfig, jsonResponse, mountHost, panelData, stubFetch, type Env } from './helpers';

describe('loader command queue', () => {
  let env: Env;

  beforeEach(() => {
    env = createEnv();
  });

  afterEach(() => env.dispose());

  it('drains a pre-loader array in order', () => {
    const seen: string[] = [];
    const handler = (command: KA11yCommand): void => void seen.push(command.action);
    window.kotlinskidevA11yQueue = [{ action: 'open' }, { action: 'close' }, { action: 'toggle:a' }];
    installQueue({ open: handler, close: handler, toggle: handler });
    expect(seen).toEqual(['open', 'close', 'toggle:a']);
  });

  it('dispatches pushes after install at once', () => {
    const handler = jest.fn();
    const queue = installQueue({ open: handler });
    expect(window.kotlinskidevA11yQueue).toBe(queue);
    queue.push({ action: 'open', source: 'api' });
    expect(handler).toHaveBeenCalledWith({ action: 'open', source: 'api' });
  });

  it.each(['toString', 'constructor', 'valueOf', 'hasOwnProperty'])('never dispatches to the inherited %s', (name) => {
    const handler = jest.fn();
    const queue = installQueue({ open: handler });
    expect(() => queue.push({ action: name })).not.toThrow();
    queue.push({ action: '__proto__' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('drops invalid actions', () => {
    const handler = jest.fn();
    const queue = installQueue({ open: handler, toggle: handler });
    queue.push(
      { action: 'Open' },
      { action: 'open;x' },
      { action: 'open:a:b:c' },
      { action: 'open: spaced' },
      { action: '' },
      { action: 5 as unknown as string },
      null as unknown as KA11yCommand,
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it('accepts name:arg:arg actions', () => {
    const handler = jest.fn();
    installQueue({ open: handler }).push({ action: 'open:a-1:b_2' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('ignores unknown valid actions', () => {
    const handler = jest.fn();
    installQueue({ open: handler }).push({ action: 'zoom:in' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('collapses two toggles from one source within 50 ms', () => {
    jest.useFakeTimers();
    const handler = jest.fn();
    const queue = installQueue({ toggle: handler });
    queue.push({ action: 'toggle', source: 'launcher' });
    jest.advanceTimersByTime(10);
    queue.push({ action: 'toggle', source: 'launcher' });
    expect(handler).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(60);
    queue.push({ action: 'toggle', source: 'launcher' });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('keeps toggles from different sources', () => {
    const handler = jest.fn();
    const queue = installQueue({ toggle: handler });
    queue.push({ action: 'toggle', source: 'launcher' }, { action: 'toggle', source: 'shortcut' });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('replays open then close as closed once the panel is ready', async () => {
    const fakes = createFakes();
    const order: string[] = [];
    fakes.dialog.open.mockImplementation(() => void order.push('open'));
    fakes.dialog.close.mockImplementation(() => void order.push('close'));
    configure(inlineConfig());
    mountHost();
    stubFetch(() => Promise.resolve(jsonResponse(panelData())));
    window.kotlinskidevA11yQueue = [{ action: 'open', source: 'early' }];
    startLoader({ groups: GROUPS });
    (window.kotlinskidevA11yQueue as { push(...c: KA11yCommand[]): number }).push({ action: 'close' });
    await flush();
    env.deliverByName('kernel', fakes.kernelRecord);
    env.deliverByName('panel', fakes.panelRecord);
    await flush();
    expect(order).toEqual(['open', 'close']);
    expect(fakes.mount).toHaveBeenCalledTimes(1);
  });

  it('ignores close while the panel was never opened', async () => {
    configure(inlineConfig());
    mountHost();
    startLoader({ groups: GROUPS });
    (window.kotlinskidevA11yQueue as { push(...c: KA11yCommand[]): number }).push({ action: 'close' });
    await flush();
    expect(env.scripts).toHaveLength(0);
  });
});

describe('loader command routing', () => {
  let env: Env;

  const start = (overrides: Partial<ReturnType<typeof inlineConfig>> = {}) => {
    const fakes = createFakes();
    configure(inlineConfig(overrides));
    mountHost();
    stubFetch(() => Promise.resolve(jsonResponse(panelData())));
    startLoader({ groups: GROUPS });
    const queue = window.kotlinskidevA11yQueue as { push(...c: KA11yCommand[]): number };
    return { fakes, queue };
  };

  const deliver = async (fakes: ReturnType<typeof createFakes>): Promise<void> => {
    await flush();
    env.deliverByName('kernel', fakes.kernelRecord);
    env.deliverByName('panel', fakes.panelRecord);
    await flush();
  };

  beforeEach(() => {
    env = createEnv();
  });

  afterEach(() => env.dispose());

  it('drops a url command whose name is not allowed and cleans the url', async () => {
    history.replaceState(null, '', '/?ka11y=toggle&keep=1#top');
    const { fakes, queue } = start({ triggers: { s: '', u: ['open'] } });
    queue.push({ action: 'toggle', source: 'url' });
    await flush();
    expect(env.scripts).toHaveLength(0);
    expect(fakes.dialog.toggle).not.toHaveBeenCalled();
    expect(location.search).toBe('?keep=1');
    expect(location.hash).toBe('#top');
  });

  it('allows the default url actions when triggers is absent', async () => {
    history.replaceState(null, '', '/?ka11y=open');
    const { fakes, queue } = start();
    queue.push({ action: 'open', source: 'url' });
    await deliver(fakes);
    expect(fakes.dialog.open).toHaveBeenCalledTimes(1);
    expect(location.search).toBe('');
  });

  it('removes an action hash after a url command and keeps the query', async () => {
    history.replaceState(null, '', '/?a=1#ka11y/open');
    const { queue } = start();
    queue.push({ action: 'open', source: 'url' });
    expect(location.hash).toBe('');
    expect(location.search).toBe('?a=1');
  });

  it.each(['close', 'toggle', 'reset', 'statement', 'hide', 'show', 'trigger'])('never accepts %s from the url', async (name) => {
    const { queue } = start();
    const fetchMock = stubFetch(() => Promise.resolve(jsonResponse(panelData())));
    const host = document.getElementById('ka11y-root') as HTMLElement;
    host.hidden = true;
    queue.push({ action: name, source: 'url' });
    await flush();
    expect(env.scripts).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(host.hidden).toBe(true);
  });

  it('resolves a trigger command from the opener and re-dispatches it', async () => {
    const { fakes, queue } = start();
    const button = document.createElement('button');
    button.className = 'ka11y-open';
    queue.push({ action: 'trigger', source: 'trigger', opener: button });
    await deliver(fakes);
    expect(fakes.dialog.open).toHaveBeenCalledWith(button);
  });

  it('drops a trigger command without a resolvable opener', async () => {
    const { fakes, queue } = start();
    queue.push({ action: 'trigger', source: 'trigger' }, { action: 'trigger', source: 'trigger', opener: document.createElement('div') });
    await flush();
    expect(env.scripts).toHaveLength(0);
    expect(fakes.dialog.open).not.toHaveBeenCalled();
  });

  it('routes kernel actions to kernel.run when it exists and ignores them when it does not', async () => {
    const { fakes, queue } = start();
    queue.push({ action: 'feature:biggerText:2', source: 'api' });
    await flush();
    env.deliverByName('kernel', fakes.kernelRecord);
    await flush();
    const run = jest.fn(() => Promise.resolve());
    (fakes.kernelApi as unknown as { run: jest.Mock }).run = run;
    queue.push({ action: 'profile:visionImpaired', source: 'api' }, { action: 'reset', source: 'api' });
    await flush();
    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenCalledWith({ action: 'reset', source: 'api' });
  });

  it('replays dialog and kernel actions in order', async () => {
    const order: string[] = [];
    const { fakes } = start();
    fakes.dialog.open.mockImplementation(() => void order.push('open'));
    (fakes.kernelApi as unknown as { run: jest.Mock }).run = jest.fn((command: KA11yCommand) => {
      order.push(command.action);
      return Promise.resolve();
    });
    const queue = window.kotlinskidevA11yQueue as { push(...c: KA11yCommand[]): number };
    queue.push({ action: 'feature:a:1' }, { action: 'open' }, { action: 'reset' });
    await deliver(fakes);
    expect(order).toEqual(['feature:a:1', 'reset', 'open']);
  });

  it('shows a hidden toolbar before open from any source but the launcher', async () => {
    const { fakes, queue } = start();
    const host = document.getElementById('ka11y-root') as HTMLElement;
    host.hidden = true;
    document.documentElement.setAttribute('data-ka11y-hidden', '');
    queue.push({ action: 'open', source: 'api' });
    expect(host.hidden).toBe(false);
    expect(document.documentElement.hasAttribute('data-ka11y-hidden')).toBe(false);
    await deliver(fakes);
    expect(fakes.dialog.open).toHaveBeenCalled();
  });

  it('hides for the session and closes, then shows again', async () => {
    const { fakes, queue } = start();
    const host = document.getElementById('ka11y-root') as HTMLElement;
    queue.push({ action: 'hide', source: 'trigger' });
    expect(host.hidden).toBe(true);
    expect(document.documentElement.hasAttribute('data-ka11y-hidden')).toBe(true);
    expect(sessionStorage.getItem('ka11y-hidden')).toBe('1');
    queue.push({ action: 'show', source: 'trigger' });
    expect(host.hidden).toBe(false);
    expect(sessionStorage.getItem('ka11y-hidden')).toBeNull();
    await flush();
    expect(fakes.dialog.open).not.toHaveBeenCalled();
  });

  it('drops dialog actions while the device query matches', async () => {
    window.matchMedia = jest.fn(() => ({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() }) as unknown as MediaQueryList);
    const { queue } = start({ hiddenMedia: '(max-width: 600px)' });
    queue.push({ action: 'open', source: 'api' }, { action: 'toggle', source: 'api' });
    await flush();
    expect(env.scripts).toHaveLength(0);
    Reflect.deleteProperty(window, 'matchMedia');
  });

  it.each([
    ['https://example.test/statement', true],
    ['javascript:alert(1)', false],
    ['', false],
  ])('statement navigates only to http(s): %s', async (url, navigates) => {
    const assign = jest.fn();
    Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, assign, href: 'https://example.test/', search: '', hash: '', pathname: '/' } });
    const { queue } = start();
    stubFetch(() => Promise.resolve(jsonResponse({ ...panelData(), statementUrl: url })));
    queue.push({ action: 'statement', source: 'trigger' });
    await flush();
    expect(assign).toHaveBeenCalledTimes(navigates ? 1 : 0);
  });
});
