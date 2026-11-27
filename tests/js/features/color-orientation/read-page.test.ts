import { chunkText, pickVoice, readPage } from '../../../../src/ts/frontend/features/color-orientation/read-page';
import { resetDocument } from './helpers';

interface FakeUtterance {
  text: string;
  lang: string;
  voice: SpeechSynthesisVoice | null;
  onend: (() => void) | null;
}

const makeVoice = (name: string, lang: string, localService: boolean, isDefault = false): SpeechSynthesisVoice =>
  ({ name, lang, localService, default: isDefault, voiceURI: name }) as SpeechSynthesisVoice;

const enhanced = makeVoice('Zosia (Enhanced)', 'pl-PL', true);
const local = makeVoice('Local Polish', 'pl_PL', true);
const remote = makeVoice('Remote Polish', 'pl-PL', false, true);
const english = makeVoice('English', 'en-US', true);

describe('readPage', () => {
  const speak = jest.fn();
  const cancel = jest.fn();
  const listeners: Record<string, Array<() => void>> = {};
  const voiceList: { current: SpeechSynthesisVoice[] } = { current: [] };
  const synth = {
    speak,
    cancel,
    speaking: false,
    pending: false,
    getVoices: jest.fn((): SpeechSynthesisVoice[] => voiceList.current),
    addEventListener: jest.fn((type: string, fn: () => void) => {
      (listeners[type] ??= []).push(fn);
    }),
    removeEventListener: jest.fn((type: string, fn: () => void) => {
      listeners[type] = (listeners[type] ?? []).filter((item) => item !== fn);
    }),
  };

  const flush = async (): Promise<void> => {
    jest.advanceTimersByTime(0);
    await Promise.resolve();
    await Promise.resolve();
  };

  beforeEach(() => {
    jest.useFakeTimers();
    resetDocument();
    localStorage.clear();
    speak.mockClear();
    cancel.mockClear();
    synth.speaking = false;
    synth.pending = false;
    voiceList.current = [remote, local, enhanced, english];
    Object.keys(listeners).forEach((key) => {
      listeners[key] = [];
    });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synth });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      writable: true,
      value: class {
        lang = '';
        voice: SpeechSynthesisVoice | null = null;
        onend: (() => void) | null = null;
        constructor(public text: string) {}
      },
    });
    document.documentElement.lang = 'pl_PL';
    document.body.innerHTML = '<p id="p">Hello <b id="b">brave</b>  world</p><div id="ka11y-root"><button id="x">skip</button></div>';
  });

  afterEach(() => {
    readPage.off();
    jest.useRealTimers();
    document.documentElement.removeAttribute('lang');
  });

  it('reads the clicked block with the picked voice and normalised language', async () => {
    readPage.on(true);
    document.getElementById('b')?.click();
    expect(speak).not.toHaveBeenCalled();
    await flush();
    expect(speak).toHaveBeenCalledTimes(1);
    const utterance = speak.mock.calls[0]?.[0] as FakeUtterance;
    expect(utterance.text).toBe('Hello brave world');
    expect(utterance.lang).toBe('pl-PL');
    expect(utterance.voice).toBe(enhanced);
  });

  it('ranks enhanced, then local, then default, then first', () => {
    expect(pickVoice('pl-PL')).toBe(enhanced);
    localStorage.clear();
    voiceList.current = [remote, local];
    expect(pickVoice('pl-PL')).toBe(local);
    localStorage.clear();
    voiceList.current = [makeVoice('A', 'pl-PL', false), makeVoice('B', 'pl-PL', false, true)];
    expect(pickVoice('pl-PL')?.name).toBe('B');
    localStorage.clear();
    voiceList.current = [makeVoice('A', 'pl-PL', false), makeVoice('C', 'pl-PL', false)];
    expect(pickVoice('pl-PL')?.name).toBe('A');
  });

  it('falls back to the primary subtag and returns null without a match', () => {
    expect(pickVoice('en-GB')).toBe(english);
    expect(pickVoice('de')).toBeNull();
  });

  it('persists the voice and prefers it while available', () => {
    pickVoice('pl-PL');
    expect(localStorage.getItem('ka11y-voice')).toBe(enhanced.voiceURI);
    localStorage.setItem('ka11y-voice', remote.voiceURI);
    expect(pickVoice('pl-PL')).toBe(remote);
    localStorage.setItem('ka11y-voice', 'gone');
    expect(pickVoice('pl-PL')).toBe(enhanced);
  });

  it('survives storage failures', () => {
    const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(pickVoice('pl-PL')).toBe(enhanced);
    spy.mockRestore();
  });

  it('waits for voiceschanged when no voices are loaded', async () => {
    voiceList.current = [];
    readPage.on(true);
    document.getElementById('p')?.click();
    await flush();
    expect(speak).not.toHaveBeenCalled();
    voiceList.current = [enhanced];
    listeners.voiceschanged?.slice().forEach((fn) => fn());
    await flush();
    expect(speak).toHaveBeenCalledTimes(1);
    expect((speak.mock.calls[0]?.[0] as FakeUtterance).voice).toBe(enhanced);
  });

  it('speaks without a voice after the voice wait times out', async () => {
    voiceList.current = [];
    readPage.on(true);
    document.getElementById('p')?.click();
    await flush();
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    await Promise.resolve();
    expect(speak).toHaveBeenCalledTimes(1);
    expect((speak.mock.calls[0]?.[0] as FakeUtterance).voice).toBeNull();
  });

  it('chunks long text and chains utterances through onend', async () => {
    const sentence = `${'word '.repeat(30).trim()}. `;
    document.body.innerHTML = `<p id="p">${sentence.repeat(4)}</p>`;
    const chunks = chunkText(document.getElementById('p')?.textContent ?? '');
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => expect(chunk.length).toBeLessThanOrEqual(180));
    readPage.on(true);
    document.getElementById('p')?.click();
    await flush();
    expect(speak).toHaveBeenCalledTimes(1);
    (speak.mock.calls[0]?.[0] as FakeUtterance).onend?.();
    expect(speak).toHaveBeenCalledTimes(2);
    expect((speak.mock.calls[1]?.[0] as FakeUtterance).text).toBe(chunks[1]);
  });

  it('splits a single oversized sentence on word boundaries', () => {
    const chunks = chunkText('word '.repeat(100).trim());
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => expect(chunk.length).toBeLessThanOrEqual(180));
  });

  it('cancels only while speaking or pending', async () => {
    readPage.on(true);
    cancel.mockClear();
    document.getElementById('p')?.click();
    expect(cancel).not.toHaveBeenCalled();
    synth.speaking = true;
    document.getElementById('p')?.click();
    expect(cancel).toHaveBeenCalledTimes(1);
    await flush();
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it('cancels on pagehide and stops after off', () => {
    readPage.on(true);
    synth.speaking = true;
    window.dispatchEvent(new Event('pagehide'));
    expect(cancel).toHaveBeenCalledTimes(1);
    readPage.off();
    cancel.mockClear();
    window.dispatchEvent(new Event('pagehide'));
    expect(cancel).not.toHaveBeenCalled();
  });

  it('ignores clicks inside the widget host', async () => {
    readPage.on(true);
    document.getElementById('x')?.click();
    await flush();
    expect(speak).not.toHaveBeenCalled();
  });

  it('stops listening on off', async () => {
    readPage.on(true);
    readPage.off();
    document.getElementById('p')?.click();
    await flush();
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
