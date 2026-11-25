import { startLoader } from '../../../src/ts/loader';
import { bindTriggers, resolveTrigger, wireAria } from '../../../src/ts/loader/triggers';
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

  it('keeps the bootstrap capture listener at install', () => {
    const early = jest.fn();
    window.kotlinskidevA11yRuntime = { s: [], c: [], e: early };
    const remove = jest.spyOn(document, 'removeEventListener');
    configure(inlineConfig());
    mountHost();
    startLoader({});
    expect(remove).not.toHaveBeenCalledWith('click', early, true);
    expect(window.kotlinskidevA11yRuntime?.e).toBe(early);
  });

  describe('resolveTrigger', () => {
    const element = (markup: string): Element => {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = markup;
      return wrapper.firstElementChild as Element;
    };
    const config = (selectors = ''): InlineConfig => ({ ...inlineConfig(), triggers: { s: selectors, u: ['open'] } });

    it.each([
      ['<button data-ka11y="profile:adhdFriendly" class="ka11y-open">', 'profile:adhdFriendly'],
      ['<a href="#ka11y/feature%3AbiggerText%3A2" data-ka11y="close">', 'close'],
      ['<a href="#ka11y/feature%3AbiggerText%3A2" class="ka11y-open">', 'feature:biggerText:2'],
      ['<a href="#kotlinskidev-a11y" class="menu">', 'open'],
      ['<button class="ka11y-open">', 'open'],
      ['<li class="menu"><a>', 'toggle'],
    ])('resolves %s to %s', (markup, expected) => {
      expect(resolveTrigger(element(markup), config('.menu'))).toBe(expected);
    });

    it.each([
      ['<button data-ka11y="Open">'],
      ['<button data-ka11y="trigger">'],
      ['<button data-ka11y="open;x">'],
      ['<a href="#ka11y/%E0%A4%A">'],
      ['<button>'],
    ])('returns null for %s', (markup) => {
      expect(resolveTrigger(element(markup), config())).toBeNull();
    });

    it('returns null for a missing element, the html element and a broken selector', () => {
      expect(resolveTrigger(null, config())).toBeNull();
      document.documentElement.setAttribute('data-ka11y', 'error');
      expect(resolveTrigger(document.documentElement, config())).toBeNull();
      document.documentElement.removeAttribute('data-ka11y');
      expect(resolveTrigger(element('<button>'), config('[['))).toBeNull();
    });
  });

  describe('action hash', () => {
    it('pushes a url command at boot and on hashchange', () => {
      history.replaceState(null, '', '#ka11y/feature%3AbiggerText%3A2');
      const { push } = setup(inlineConfig());
      expect(push).toHaveBeenCalledWith({ action: 'feature:biggerText:2', source: 'url' });
      history.replaceState(null, '', '#ka11y/profile:visionImpaired');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      expect(push).toHaveBeenLastCalledWith({ action: 'profile:visionImpaired', source: 'url' });
    });

    it('ignores a malformed escape without throwing', () => {
      history.replaceState(null, '', '#ka11y/%E0%A4%A');
      expect(() => setup(inlineConfig())).not.toThrow();
    });

    it('keeps the open hash in the address bar', () => {
      history.replaceState(null, '', '#kotlinskidev-a11y');
      setup(inlineConfig());
      expect(location.hash).toBe('#kotlinskidev-a11y');
    });
  });

  describe('space on link triggers', () => {
    const spaceOn = (markup: string): { click: jest.Mock; event: KeyboardEvent } => {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = markup;
      document.body.append(wrapper);
      const target = wrapper.firstElementChild as HTMLElement;
      const click = jest.fn();
      target.addEventListener('click', click);
      const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      return { click, event };
    };

    it('clicks an a[role=button] trigger once', () => {
      setup(inlineConfig());
      const { click, event } = spaceOn('<a href="#ka11y/open" role="button">x</a>');
      expect(click).toHaveBeenCalledTimes(1);
      expect(event.defaultPrevented).toBe(true);
    });

    it.each([{ repeat: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }])('ignores space with %o', (init) => {
      setup(inlineConfig());
      const wrapper = document.createElement('div');
      wrapper.innerHTML = '<a href="#kotlinskidev-a11y" role="button">x</a>';
      document.body.append(wrapper);
      const target = wrapper.firstElementChild as HTMLElement;
      const click = jest.fn();
      target.addEventListener('click', click);
      target.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true, ...init }));
      expect(click).not.toHaveBeenCalled();
    });

    it('ignores space already handled by another listener', () => {
      setup(inlineConfig());
      const wrapper = document.createElement('div');
      wrapper.innerHTML = '<a href="#kotlinskidev-a11y" role="button">x</a>';
      document.body.append(wrapper);
      const target = wrapper.firstElementChild as HTMLElement;
      const click = jest.fn();
      target.addEventListener('click', click);
      target.addEventListener('keydown', (event) => event.preventDefault());
      target.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
      expect(click).not.toHaveBeenCalled();
    });

    it('activates a non-native custom trigger and a link trigger with Enter and Space once each', () => {
      setup({ ...inlineConfig(), triggers: { s: '.menu', u: ['open'] } });
      const item = spaceOn('<li class="menu" role="button">x</li>');
      expect(item.click).toHaveBeenCalledTimes(1);
      const wrapper = document.createElement('div');
      wrapper.innerHTML = '<li class="menu" role="button">x</li><a href="#kotlinskidev-a11y" role="button">y</a>';
      document.body.append(wrapper);
      const click = jest.fn();
      wrapper.addEventListener('click', click);
      const enter = (index: number): KeyboardEvent => {
        const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        (wrapper.children[index] as HTMLElement).dispatchEvent(event);
        return event;
      };
      expect(enter(0).defaultPrevented).toBe(true);
      expect(enter(1).defaultPrevented).toBe(true);
      expect(click).toHaveBeenCalledTimes(2);
    });

    it('does nothing on a plain link or a non-trigger role button', () => {
      setup(inlineConfig());
      expect(spaceOn('<a href="#ka11y/open">x</a>').click).not.toHaveBeenCalled();
      expect(spaceOn('<a href="/x" role="button">x</a>').click).not.toHaveBeenCalled();
    });
  });

  describe('wireAria', () => {
    const BASE = '[data-ka11y]:not(html),a[href^="#ka11y/"],a[href="#kotlinskidev-a11y"],.ka11y-open,#ka11y-root';

    const wire = (markup: string): Element => {
      document.body.innerHTML = markup;
      window.kotlinskidevA11yRuntime = { s: [], c: [], q: BASE };
      wireAria(inlineConfig());
      return document.body.firstElementChild as Element;
    };

    it('wires dialog triggers and sets role on links', () => {
      const link = wire('<a href="#ka11y/open">x</a>');
      expect(link.getAttribute('role')).toBe('button');
      expect(link.getAttribute('aria-controls')).toBe('ka11y-root');
      expect(link.getAttribute('aria-expanded')).toBe('false');
      expect(link.getAttribute('aria-haspopup')).toBe('dialog');
    });

    it('wires toggle like open and close with controls only', () => {
      expect(wire('<button data-ka11y="toggle">x</button>').getAttribute('aria-expanded')).toBe('false');
      const close = wire('<button data-ka11y="close">x</button>');
      expect(close.getAttribute('aria-controls')).toBe('ka11y-root');
      expect(close.hasAttribute('aria-expanded')).toBe(false);
    });

    it.each(['feature:biggerText', 'profile:visionImpaired'])('wires aria-pressed for %s', (action) => {
      expect(wire(`<button data-ka11y="${action}">x</button>`).getAttribute('aria-pressed')).toBe('false');
    });

    it('does not throw on prototype-named actions', () => {
      expect(() => wire('<button data-ka11y="constructor">x</button>')).not.toThrow();
      expect(() => wire('<button data-ka11y="__proto__">x</button>')).not.toThrow();
      expect(wire('<button data-ka11y="constructor">x</button>').getAttributeNames()).toEqual(['data-ka11y']);
    });

    it('wires hash links, class opens and custom selector elements', () => {
      document.body.innerHTML =
        '<a href="#kotlinskidev-a11y">a</a><span class="ka11y-open">b</span><ul><li class="menu"><a href="/x">c</a></li></ul><i class="menu">d</i>';
      window.kotlinskidevA11yRuntime = { s: [], c: [], q: BASE };
      wireAria({ ...inlineConfig(), triggers: { s: '.menu a, i.menu', u: ['open'] } });
      const hash = document.body.children[0] as HTMLElement;
      const klass = document.body.children[1] as HTMLElement;
      const custom = document.querySelector('.menu a') as HTMLElement;
      const plain = document.querySelector('i.menu') as HTMLElement;
      [hash, klass, custom, plain].forEach((element) => {
        expect(element.getAttribute('role')).toBe('button');
        expect(element.getAttribute('aria-haspopup')).toBe('dialog');
        expect(element.getAttribute('aria-controls')).toBe('ka11y-root');
        expect(element.getAttribute('aria-expanded')).toBe('false');
      });
      expect(hash.hasAttribute('tabindex')).toBe(false);
      expect(custom.hasAttribute('tabindex')).toBe(false);
      expect(klass.getAttribute('tabindex')).toBe('0');
      expect(plain.getAttribute('tabindex')).toBe('0');
    });

    it('never overwrites existing attributes and skips other actions', () => {
      const button = wire('<button data-ka11y="open" aria-expanded="true" aria-haspopup="menu">x</button>');
      expect(button.getAttribute('aria-expanded')).toBe('true');
      expect(button.getAttribute('aria-haspopup')).toBe('menu');
      expect(button.getAttribute('aria-controls')).toBe('ka11y-root');
      expect(wire('<button data-ka11y="reset">x</button>').getAttributeNames()).toEqual(['data-ka11y']);
      expect(wire('<button data-ka11y="bogus!">x</button>').getAttributeNames()).toEqual(['data-ka11y']);
    });
  });
});
