import { bindHashOpen, OPEN_HASH } from '../../src/ts/frontend/hash-open';

describe('hash-open', () => {
  let unbind: () => void = () => undefined;

  beforeEach(() => {
    window.location.hash = '';
    document.body.innerHTML = '';
  });

  afterEach(() => unbind());

  it('opens on load when the hash matches', () => {
    window.location.hash = OPEN_HASH;
    const onOpen = jest.fn();
    unbind = bindHashOpen({ onOpen });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('does not open on load without the hash', () => {
    const onOpen = jest.fn();
    unbind = bindHashOpen({ onOpen });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('opens on hashchange', () => {
    const onOpen = jest.fn();
    unbind = bindHashOpen({ onOpen });
    window.location.hash = OPEN_HASH;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('opens when a trigger link is clicked and prevents navigation', () => {
    document.body.innerHTML = `<a id="t" href="${OPEN_HASH}"><span id="inner">Open</span></a><a id="o" href="#other">x</a>`;
    const onOpen = jest.fn();
    unbind = bindHashOpen({ onOpen });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.getElementById('inner')?.dispatchEvent(event);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    document.getElementById('o')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('stops listening after unbind', () => {
    document.body.innerHTML = `<a id="t" href="${OPEN_HASH}">Open</a>`;
    const onOpen = jest.fn();
    bindHashOpen({ onOpen })();
    document.getElementById('t')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(onOpen).not.toHaveBeenCalled();
  });
});
