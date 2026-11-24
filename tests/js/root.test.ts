import { resolveHost } from '../../src/ts/frontend/root';
import { createConfig } from './helpers';

describe('resolveHost', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('writes a valid BCP 47 language tag on the host', () => {
    const host = resolveHost(document, createConfig({ locale: 'pl_PL' }));
    expect(host.lang).toBe('pl-PL');
  });

  it('marks right-to-left locales on the host', () => {
    const host = resolveHost(document, createConfig({ locale: 'ar', rtl: true }));
    expect(host.dir).toBe('rtl');
  });
});
