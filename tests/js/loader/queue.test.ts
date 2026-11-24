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
