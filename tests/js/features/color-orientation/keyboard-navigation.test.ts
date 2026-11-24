import { keyboardNavigation } from '../../../../src/ts/frontend/features/color-orientation/keyboard-navigation';
import { mockMatchMedia, resetDocument } from './helpers';

const press = (key: string, init: KeyboardEventInit = {}, target: EventTarget = document.body): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
};

describe('keyboardNavigation', () => {
  beforeEach(() => {
    resetDocument();
    mockMatchMedia(false);
    document.body.innerHTML = `
      <h1 id="h1">One</h1>
      <a id="l1" href="#a">a</a>
      <h2 id="h2">Two</h2>
      <form id="f"><input id="in"><button id="btn" type="button">go</button></form>
      <img id="g" alt="x" src="x.png">
      <nav id="nav"><a id="l2" href="#b">b</a></nav>
      <div id="hidden" hidden><h3 id="h3">hidden</h3></div>
      <div id="ka11y-root"><button id="wb">w</button></div>`;
    keyboardNavigation.on(true);
  });

  afterEach(() => {
    keyboardNavigation.off();
  });

  it('adds the focus class and restores html on off', () => {
    expect(document.documentElement.classList.contains('ka11y-keyboard-navigation')).toBe(true);
    keyboardNavigation.off();
    expect(document.documentElement.hasAttribute('class')).toBe(false);
  });

  it('moves to next heading, wrapping, and prevents default', () => {
    const first = press('h');
    expect(first.defaultPrevented).toBe(true);
    expect(document.activeElement?.id).toBe('h1');
    press('h');
    expect(document.activeElement?.id).toBe('h2');
    press('h');
    expect(document.activeElement?.id).toBe('h1');
  });

  it('skips hidden headings', () => {
    press('h');
    press('h');
    press('h');
    expect(document.activeElement?.id).not.toBe('h3');
  });

  it('jumps to form, button, graphic, link and menu', () => {
    press('f');
    expect(document.activeElement?.id).toBe('f');
    press('b');
    expect(document.activeElement?.id).toBe('btn');
    press('g');
    expect(document.activeElement?.id).toBe('g');
    press('m');
    expect(document.activeElement?.id).toBe('nav');
    press('l');
    expect(document.activeElement?.id).toBe('l2');
  });

  it('uses a temporary tabindex and removes it on blur and off', () => {
    press('h');
    const heading = document.getElementById('h1') as HTMLElement;
    expect(heading.getAttribute('tabindex')).toBe('-1');
    document.getElementById('btn')?.focus();
    expect(heading.hasAttribute('tabindex')).toBe(false);
    press('h');
    keyboardNavigation.off();
    expect(document.getElementById('h1')?.hasAttribute('tabindex')).toBe(false);
  });

  it('scrolls into view without smooth behavior under reduced motion', () => {
    mockMatchMedia(true);
    const scroll = jest.fn();
    (document.getElementById('h1') as HTMLElement).scrollIntoView = scroll;
    press('h');
    expect(scroll).toHaveBeenCalledWith({ block: 'center', behavior: 'auto' });
  });

  it('uses smooth scrolling without reduced motion', () => {
    const scroll = jest.fn();
    (document.getElementById('h1') as HTMLElement).scrollIntoView = scroll;
    press('h');
    expect(scroll).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
  });

  it('ignores keys typed in inputs and the widget host', () => {
    const input = document.getElementById('in') as HTMLElement;
    const event = press('h', {}, input);
    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement?.id).not.toBe('h1');
    press('h', {}, document.getElementById('wb') as HTMLElement);
    expect(document.activeElement?.id).not.toBe('h1');
  });

  it('ignores contenteditable and textarea targets', () => {
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    const area = document.createElement('textarea');
    document.body.append(editable, area);
    expect(press('h', {}, editable).defaultPrevented).toBe(false);
    expect(press('h', {}, area).defaultPrevented).toBe(false);
  });

  it('ignores presses with modifier keys', () => {
    ['ctrlKey', 'metaKey', 'altKey', 'shiftKey'].forEach((modifier) => {
      expect(press('h', { [modifier]: true }).defaultPrevented).toBe(false);
    });
    expect(document.activeElement?.id).not.toBe('h1');
  });

  it('ignores unmapped keys and stops listening after off', () => {
    expect(press('x').defaultPrevented).toBe(false);
    keyboardNavigation.off();
    expect(press('h').defaultPrevented).toBe(false);
  });
});
