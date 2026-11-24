import { readPage } from '../../../../src/ts/frontend/features/color-orientation/read-page';
import { resetDocument } from './helpers';

describe('readPage', () => {
  const speak = jest.fn();
  const cancel = jest.fn();

  beforeEach(() => {
    resetDocument();
    speak.mockClear();
    cancel.mockClear();
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak, cancel } });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      writable: true,
      value: class {
        lang = '';
        constructor(public text: string) {}
      },
    });
    document.documentElement.lang = 'pl';
    document.body.innerHTML = '<p id="p">Hello <b id="b">brave</b>  world</p><div id="ka11y-root"><button id="x">skip</button></div>';
  });

  afterEach(() => {
    readPage.off();
    document.documentElement.removeAttribute('lang');
  });

  it('reads the clicked block with the document language', () => {
    readPage.on(true);
    document.getElementById('b')?.click();
    expect(cancel).toHaveBeenCalled();
    expect(speak).toHaveBeenCalledTimes(1);
    const utterance = speak.mock.calls[0]?.[0] as { text: string; lang: string };
    expect(utterance.text).toBe('Hello brave world');
    expect(utterance.lang).toBe('pl');
  });

  it('ignores clicks inside the widget host', () => {
    readPage.on(true);
    document.getElementById('x')?.click();
    expect(speak).not.toHaveBeenCalled();
  });

  it('cancels speech and stops listening on off', () => {
    readPage.on(true);
    readPage.off();
    expect(cancel).toHaveBeenCalled();
    document.getElementById('p')?.click();
    expect(speak).not.toHaveBeenCalled();
    expect(document.documentElement.hasAttribute('class')).toBe(false);
  });

  it('does not throw without speech support', () => {
    delete (window as unknown as Record<string, unknown>).speechSynthesis;
    expect(() => {
      readPage.on(true);
      readPage.off();
    }).not.toThrow();
  });
});
