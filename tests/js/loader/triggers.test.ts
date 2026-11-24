import { startLoader } from '../../../src/ts/loader';
import { bindTriggers } from '../../../src/ts/loader/triggers';
import type { InlineConfig, KA11yCommand } from '../../../src/ts/shared/types';
import { configure, createEnv, inlineConfig, mountHost, type Env } from './helpers';

const setup = (config: InlineConfig) => {
  const host = mountHost();
  const push = jest.fn((command: KA11yCommand) => command);
  const prefetch = jest.fn();
  bindTriggers({ config, host, push, prefetch, hiddenKey: 'ka11y-hidden' });
  return { host, push, prefetch };
};

const withLoad = (overrides: Partial<InlineConfig['load']>): InlineConfig => {
  const base = inlineConfig();
  return { ...base, load: { ...base.load, ...overrides } };
};

const shortcutEvent = (init: KeyboardEventInit = {}): KeyboardEvent =>
  new KeyboardEvent('keydown', { altKey: true, shiftKey: true, code: 'KeyA', key: 'A', cancelable: true, ...init });

describe('loader triggers', () => {
  let env: Env;

  beforeEach(() => {
    env = createEnv();
  });

  afterEach(() => env.dispose());

  it('queues a toggle with the launcher as opener on host click', () => {
    const { host, push } = setup(inlineConfig());
    host.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(push).toHaveBeenCalledWith({
      action: 'toggle',
      source: 'launcher',
      opener: host.shadowRoot?.querySelector('.ka11y-launcher'),
    });
  });

  it.each(['pointerenter', 'focusin', 'touchstart'])('prefetches once on %s with hover', (type) => {
    const { host, prefetch } = setup(inlineConfig());
    host.dispatchEvent(new Event(type));
    host.dispatchEvent(new Event('focusin'));
    host.dispatchEvent(new Event('touchstart'));
    expect(prefetch).toHaveBeenCalledTimes(1);
  });

  it('removes all intent listeners once one fires', () => {
    const host = mountHost();
    const remove = jest.spyOn(host, 'removeEventListener');
    bindTriggers({ config: inlineConfig(), host, push: jest.fn(), prefetch: jest.fn(), hiddenKey: 'ka11y-hidden' });
    host.dispatchEvent(new Event('focusin'));
    expect(remove.mock.calls.map(([type]) => type).sort()).toEqual(['focusin', 'pointerenter', 'touchstart']);
  });

  it('does not prefetch on a touch pointerenter', () => {
    const { host, prefetch } = setup(inlineConfig());
    const event = new Event('pointerenter');
    Object.defineProperty(event, 'pointerType', { value: 'touch' });
    host.dispatchEvent(event);
    expect(prefetch).not.toHaveBeenCalled();
  });

  it.each(['none', 'idle'] as const)('does not prefetch on intent with %s', (prefetchMode) => {
    const { host, prefetch } = setup(withLoad({ prefetch: prefetchMode }));
    host.dispatchEvent(new Event('pointerenter'));
    host.dispatchEvent(new Event('focusin'));
    expect(prefetch).not.toHaveBeenCalled();
  });

  it('opens and shows the hidden toolbar for the hash at boot', () => {
    history.replaceState(null, '', '#kotlinskidev-a11y');
    document.documentElement.setAttribute('data-ka11y-hidden', '');
    sessionStorage.setItem('ka11y-hidden', '1');
    localStorage.setItem('ka11y-hidden', String(Date.now() + 100000));
    const host = mountHost();
    host.hidden = true;
    const push = jest.fn();
    bindTriggers({ config: inlineConfig(), host, push, prefetch: jest.fn(), hiddenKey: 'ka11y-hidden' });
    expect(push).toHaveBeenCalledWith({ action: 'open', source: 'hash' });
    expect(host.hidden).toBe(false);
    expect(document.documentElement.hasAttribute('data-ka11y-hidden')).toBe(false);
    expect(sessionStorage.getItem('ka11y-hidden')).toBeNull();
    expect(localStorage.getItem('ka11y-hidden')).toBeNull();
  });

  it('opens on hashchange', () => {
    const { push } = setup(inlineConfig());
    expect(push).not.toHaveBeenCalled();
    history.replaceState(null, '', '#kotlinskidev-a11y');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(push).toHaveBeenCalledWith({ action: 'open', source: 'hash' });
  });

  it('ignores other hashes', () => {
    const { push } = setup(inlineConfig());
    history.replaceState(null, '', '#other');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(push).not.toHaveBeenCalled();
  });

  it('prevents the anchor click and opens', () => {
    const { push } = setup(inlineConfig());
    const anchor = document.createElement('a');
    anchor.href = '#kotlinskidev-a11y';
    document.body.append(anchor);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    anchor.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(push).toHaveBeenCalledWith({ action: 'open', source: 'hash' });
  });

  it('leaves unrelated clicks alone', () => {
    const { push } = setup(inlineConfig());
    const button = document.createElement('button');
    document.body.append(button);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    button.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });

  it('toggles on the parsed shortcut', () => {
    const { push } = setup(inlineConfig());
    const event = shortcutEvent();
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(push).toHaveBeenCalledWith({ action: 'toggle', source: 'shortcut' });
  });

  it('ignores keys that do not match the combo', () => {
    const { push } = setup(inlineConfig());
    document.dispatchEvent(shortcutEvent({ shiftKey: false }));
    document.dispatchEvent(shortcutEvent({ code: 'KeyB', key: 'b' }));
    expect(push).not.toHaveBeenCalled();
  });

  it('ignores the shortcut when the toolbar is hidden', () => {
    const { push } = setup(inlineConfig());
    document.documentElement.setAttribute('data-ka11y-hidden', '');
    document.dispatchEvent(shortcutEvent());
    expect(push).not.toHaveBeenCalled();
  });

  it('ignores the shortcut when it is disabled or unparsed', () => {
    const base = inlineConfig();
    const { push } = setup({ ...base, shortcut: { ...base.shortcut, enabled: false } });
    document.dispatchEvent(shortcutEvent());
    expect(push).not.toHaveBeenCalled();
  });

  it('removes the bootstrap capture listener at install', () => {
    const early = jest.fn();
    window.kotlinskidevA11yRuntime = { s: [], c: [], e: early };
    const remove = jest.spyOn(document, 'removeEventListener');
    configure(inlineConfig());
    mountHost();
    startLoader({});
    expect(remove).toHaveBeenCalledWith('click', early, true);
    expect(window.kotlinskidevA11yRuntime?.e).toBeUndefined();
  });
});
