import { startLoader } from '../../../src/ts/loader';
import type { KotlinskidevA11yApi } from '../../../src/ts/shared/types';
import { configure, createEnv, createFakes, flush, GROUPS, inlineConfig, jsonResponse, mountHost, panelData, stubFetch, type Env } from './helpers';

const api = (): KotlinskidevA11yApi => window.kotlinskidevA11y as unknown as KotlinskidevA11yApi;

describe('loader api', () => {
  let env: Env;

  const start = (): ReturnType<typeof createFakes> => {
    const fakes = createFakes();
    configure(inlineConfig());
    mountHost();
    stubFetch(() => Promise.resolve(jsonResponse(panelData())));
    startLoader({ groups: GROUPS });
    return fakes;
  };

  beforeEach(() => {
    env = createEnv();
  });

  afterEach(() => env.dispose());

  it('installs the versioned api next to the config fields', () => {
    start();
    expect((window.kotlinskidevA11y as unknown as { v: string }).v).toBe('0.2.0');
    expect(api().api).toBe(1);
    ['open', 'close', 'toggle', 'set', 'reset', 'getState', 'on'].forEach((name) => expect(typeof api()[name as 'open']).toBe('function'));
  });

  it('pushes api-source commands for open, close, toggle and reset', () => {
    start();
    const opener = document.createElement('button');
    const queue = window.kotlinskidevA11yQueue as { push: jest.Mock };
    const push = jest.spyOn(queue, 'push');
    api().open(opener);
    api().close();
    api().toggle();
    api().reset();
    expect(push.mock.calls.map(([command]) => command)).toEqual([
      { action: 'open', source: 'api', opener },
      { action: 'close', source: 'api', opener: undefined },
      { action: 'toggle', source: 'api', opener: undefined },
      { action: 'reset', source: 'api', opener: undefined },
    ]);
  });

  it('toggles a feature or profile target and passes any other string through', () => {
    start();
    const queue = window.kotlinskidevA11yQueue as { push: jest.Mock };
    const push = jest.spyOn(queue, 'push');
    api().toggle('feature:darkContrast');
    api().toggle('profile:adhdFriendly');
    api().toggle('bogus');
    expect(push.mock.calls.map(([command]) => command.action)).toEqual(['feature:darkContrast', 'profile:adhdFriendly', 'bogus']);
  });

  it.each([
    [true, 'feature:biggerText:1'],
    [false, 'feature:biggerText:0'],
    [2, 'feature:biggerText:2'],
    [2.9, 'feature:biggerText:2'],
  ])('maps set(%p) to %s', (level, expected) => {
    start();
    const push = jest.spyOn(window.kotlinskidevA11yQueue as { push: jest.Mock }, 'push');
    api().set('biggerText', level);
    expect(push).toHaveBeenCalledWith(expect.objectContaining({ action: expected, source: 'api' }));
  });

  it.each([Number.NaN, Infinity, -Infinity])('drops set with %p', (level) => {
    start();
    const push = jest.spyOn(window.kotlinskidevA11yQueue as { push: jest.Mock }, 'push');
    api().set('biggerText', level);
    expect(push).not.toHaveBeenCalled();
  });

  it('getState loads the kernel only and reports the panel open state', async () => {
    const fakes = start();
    const state = { api: 1, open: false, profile: null, features: { biggerText: 2 } };
    (fakes.kernelApi as unknown as { state: () => unknown }).state = () => state;
    const pending = api().getState();
    await flush();
    env.deliverByName('kernel', fakes.kernelRecord);
    await expect(pending).resolves.toEqual(state);
    expect(env.scripts.some((script) => script.src.includes('/panel.js'))).toBe(false);
  });

  it('getState reports open while the panel is open', async () => {
    const fakes = start();
    fakes.dialog.isOpen.mockReturnValue(true);
    (fakes.kernelApi as unknown as { state: () => unknown }).state = () => ({ api: 1, open: false, profile: null, features: {} });
    api().open();
    await flush();
    env.deliverByName('kernel', fakes.kernelRecord);
    env.deliverByName('panel', fakes.panelRecord);
    await flush();
    const pending = api().getState();
    await flush();
    await expect(pending).resolves.toMatchObject({ open: true });
  });

  it('on subscribes to ka11y events with their detail and unsubscribes', () => {
    start();
    const listener = jest.fn();
    const off = api().on('change', listener);
    document.dispatchEvent(new CustomEvent('ka11y:change', { detail: { n: 1 } }));
    off();
    document.dispatchEvent(new CustomEvent('ka11y:change', { detail: { n: 2 } }));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ n: 1 });
  });

  it('fires ka11y:ready once with the api version and calls late ready listeners', async () => {
    const seen: unknown[] = [];
    document.addEventListener('ka11y:ready', (event) => seen.push((event as CustomEvent).detail));
    start();
    expect(seen).toEqual([{ api: 1, version: '0.2.0' }]);
    const late = jest.fn();
    api().on('ready', late);
    expect(late).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(late).toHaveBeenCalledWith({ api: 1, version: '0.2.0' });
    expect(seen).toHaveLength(1);
  });
});
