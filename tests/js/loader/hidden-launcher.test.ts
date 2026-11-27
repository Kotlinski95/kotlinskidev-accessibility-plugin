import { startLoader } from '../../../src/ts/loader';
import { configure, createEnv, createFakes, flush, GROUPS, inlineConfig, jsonResponse, mountHost, panelData, stubFetch, type Env, type Fakes } from './helpers';

const runBootstrap = async (): Promise<void> => {
  jest.resetModules();
  await import('../../../src/ts/bootstrap/index');
};

interface Page {
  fakes: Fakes;
  host: HTMLElement;
  trigger: HTMLButtonElement;
}

const setup = async (): Promise<Page> => {
  const fakes = createFakes();
  configure(inlineConfig({ launcher: { mode: 'hidden', mount: '' } }));
  (window.kotlinskidevA11y as unknown as { storage: unknown }).storage = { mode: 'local', key: 'ka11y', ttlDays: 365 };
  const host = mountHost();
  host.setAttribute('data-ka11y-launcher', 'hidden');
  host.shadowRoot?.querySelector('.ka11y-launcher')?.setAttribute('hidden', '');
  const trigger = document.createElement('button');
  trigger.setAttribute('data-ka11y', 'open');
  document.body.append(trigger);
  stubFetch(() => Promise.resolve(jsonResponse(panelData())));
  await runBootstrap();
  return { fakes, host, trigger };
};

const deliver = async (fakes: Fakes, env: Env): Promise<void> => {
  await flush();
  env.deliverByName('kernel', fakes.kernelRecord);
  env.deliverByName('panel', fakes.panelRecord);
  await flush();
};

describe('hidden launcher', () => {
  let env: Env;

  beforeEach(() => {
    env = createEnv();
  });

  afterEach(() => {
    const listener = window.kotlinskidevA11yRuntime?.e;
    if (listener) document.removeEventListener('click', listener, true);
    env.dispose();
  });

  it('opens from a data-ka11y button clicked before the loader is ready', async () => {
    const { fakes, trigger } = await setup();
    trigger.click();
    startLoader({ groups: GROUPS });
    await deliver(fakes, env);
    expect(fakes.dialog.open).toHaveBeenCalledWith(trigger);
  });

  it('opens from a data-ka11y button clicked after the loader is ready', async () => {
    const { fakes, trigger } = await setup();
    startLoader({ groups: GROUPS });
    trigger.click();
    await deliver(fakes, env);
    expect(fakes.dialog.open).toHaveBeenCalledWith(trigger);
  });

  it('opens through the public api with the clicked element as opener', async () => {
    const { fakes, trigger } = await setup();
    startLoader({ groups: GROUPS });
    const api = window.kotlinskidevA11y as unknown as { api: number; open(opener?: HTMLElement): void };
    expect(api.api).toBe(1);
    api.open(trigger);
    await deliver(fakes, env);
    expect(fakes.dialog.open).toHaveBeenCalledWith(trigger);
  });

  it('shows a toolbar hidden by the visitor and opens', async () => {
    const { fakes, host, trigger } = await setup();
    document.documentElement.setAttribute('data-ka11y-hidden', '');
    host.hidden = true;
    startLoader({ groups: GROUPS });
    trigger.click();
    await deliver(fakes, env);
    expect(document.documentElement.hasAttribute('data-ka11y-hidden')).toBe(false);
    expect(host.hidden).toBe(false);
    expect(fakes.dialog.open).toHaveBeenCalledWith(trigger);
  });

  it('keeps the launcher hidden after the panel opens', async () => {
    const { fakes, host, trigger } = await setup();
    startLoader({ groups: GROUPS });
    trigger.click();
    await deliver(fakes, env);
    expect(host.getAttribute('data-ka11y-launcher')).toBe('hidden');
    expect((host.shadowRoot?.querySelector('.ka11y-launcher') as HTMLElement).hidden).toBe(true);
  });
});
