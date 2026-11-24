import { ensureShadow } from '../../../src/ts/loader/dsd';
import { mountHost } from './helpers';

describe('loader declarative shadow DOM fallback', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('moves the template content into an attached open shadow root', () => {
    const host = mountHost(false);
    expect(host.shadowRoot).toBeNull();
    const shadow = ensureShadow(host);
    expect(host.shadowRoot).toBe(shadow);
    expect(shadow.mode).toBe('open');
    expect(shadow.querySelector('.ka11y-launcher')).not.toBeNull();
    expect(host.querySelector('template')).toBeNull();
  });

  it('leaves an existing shadow root untouched', () => {
    const host = mountHost(true);
    const before = host.shadowRoot;
    const launcher = before?.querySelector('.ka11y-launcher');
    expect(ensureShadow(host)).toBe(before);
    expect(host.shadowRoot?.querySelector('.ka11y-launcher')).toBe(launcher);
    expect(host.shadowRoot?.childNodes).toHaveLength(1);
  });

  it('attaches an empty shadow root when there is no template', () => {
    const host = document.createElement('div');
    expect(ensureShadow(host).childNodes).toHaveLength(0);
  });
});
