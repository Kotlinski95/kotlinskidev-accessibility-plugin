import { mountLauncher } from '../../../src/ts/loader/launcher';
import type { InlineConfig } from '../../../src/ts/shared/types';
import { inlineConfig, mountHost } from './helpers';

const withLauncher = (mode: 'floating' | 'inline' | 'hidden', mount: string): InlineConfig => ({ ...inlineConfig(), launcher: { mode, mount } });

describe('mountLauncher', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  it('moves the host into the mount and keeps its shadow root', () => {
    const mount = document.createElement('nav');
    mount.id = 'slot';
    document.body.append(mount);
    const host = mountHost();
    const shadow = host.shadowRoot;
    mountLauncher(withLauncher('inline', '#slot'), host);
    expect(host.parentElement).toBe(mount);
    expect(host.shadowRoot).toBe(shadow);
    expect(host.shadowRoot?.querySelector('.ka11y-launcher')).not.toBeNull();
  });

  it.each([
    ['a missing mount', '#nowhere'],
    ['a throwing selector', '[['],
    ['an empty selector', ''],
  ])('falls back to floating and warns for %s', (_label, selector) => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const host = mountHost();
    mountLauncher(withLauncher('inline', selector), host);
    expect(host.getAttribute('data-ka11y-launcher')).toBe('floating');
    expect(host.parentElement).toBe(document.body);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('falls back when the mount is inside the host', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const host = mountHost();
    host.innerHTML = '<span id="inner"></span>';
    mountLauncher(withLauncher('inline', '#inner'), host);
    expect(host.getAttribute('data-ka11y-launcher')).toBe('floating');
  });

  it.each(['floating', 'hidden'] as const)('does nothing in %s mode', (mode) => {
    const host = mountHost();
    mountLauncher(withLauncher(mode, '#slot'), host);
    expect(host.hasAttribute('data-ka11y-launcher')).toBe(false);
  });

  it('does nothing without a launcher config', () => {
    const host = mountHost();
    mountLauncher(inlineConfig(), host);
    expect(host.attributes).toHaveLength(1);
  });
});
