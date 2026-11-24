import { startLoader } from '../../../src/ts/loader';
import type { InlineConfig } from '../../../src/ts/shared/types';
import { configure, createEnv, GROUPS, inlineConfig, mountHost, type Env } from './helpers';

interface FakeQuery {
  matches: boolean;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
  change(matches: boolean): void;
}

const stubMatchMedia = (matches: boolean): FakeQuery => {
  const listeners = new Set<() => void>();
  const query: FakeQuery = {
    matches,
    addEventListener: (_type, listener) => void listeners.add(listener),
    removeEventListener: (_type, listener) => void listeners.delete(listener),
    change(next) {
      query.matches = next;
      listeners.forEach((listener) => listener());
    },
  };
  (window as unknown as { matchMedia: unknown }).matchMedia = jest.fn(() => query);
  return query;
};

const config = (overrides: Partial<InlineConfig> = {}, deviceSkip = true): InlineConfig => {
  const base = inlineConfig({ hiddenMedia: '(max-width: 600px)', ...overrides });
  return { ...base, load: { ...base.load, deviceSkip, strategy: 'defer' } };
};

describe('loader device skip', () => {
  let env: Env;

  beforeEach(() => {
    env = createEnv();
  });

  afterEach(() => {
    delete (window as unknown as { matchMedia?: unknown }).matchMedia;
    env.dispose();
  });

  it('binds nothing and injects nothing on a hidden device', () => {
    stubMatchMedia(true);
    configure(config());
    const host = mountHost();
    startLoader({ groups: GROUPS });
    host.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    host.dispatchEvent(new Event('focusin'));
    expect(env.scripts).toHaveLength(0);
  });

  it('still loads the kernel and saved groups on a hidden device', () => {
    stubMatchMedia(true);
    window.kotlinskidevA11yRuntime = { s: ['biggerText', 'lineHeight'], c: [] };
    configure(config());
    mountHost();
    startLoader({ groups: { ...GROUPS, lineHeight: 'content' } });
    const names = env.scripts.map((script) => script.src.split('/').pop()?.split('?')[0]).sort();
    expect(names).toEqual(['content.js', 'kernel.js']);
  });

  it('binds triggers and runs the strategy when the media change makes it visible', () => {
    const query = stubMatchMedia(true);
    configure(config());
    mountHost();
    startLoader({ groups: GROUPS });
    expect(env.scripts).toHaveLength(0);
    query.change(false);
    expect(env.scripts.length).toBeGreaterThan(0);
  });

  it('binds anyway when deviceSkip is false', () => {
    stubMatchMedia(true);
    configure(config({}, false));
    mountHost();
    startLoader({ groups: GROUPS });
    expect(env.scripts.length).toBeGreaterThan(0);
  });

  it('treats an empty hiddenMedia as visible', () => {
    configure(config({ hiddenMedia: '' }));
    mountHost();
    startLoader({ groups: GROUPS });
    expect(env.scripts.length).toBeGreaterThan(0);
  });
});
