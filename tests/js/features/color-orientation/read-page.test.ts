import { chunkText, pickVoice, readPage } from '../../../../src/ts/frontend/features/color-orientation/read-page';
import { bindReadPreferenceSource } from '../../../../src/ts/frontend/features/color-orientation/read-voice';
import { resetDocument } from './helpers';

interface FakeUtterance {
  text: string;
  lang: string;
  voice: SpeechSynthesisVoice | null;
  onend: (() => void) | null;
  rate?: number;
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
        rate = 1;
        pitch = 1;
        volume = 1;
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
    voiceList.current = [remote, local];
    expect(pickVoice('pl-PL')).toBe(local);
    voiceList.current = [makeVoice('A', 'pl-PL', false), makeVoice('B', 'pl-PL', false, true)];
    expect(pickVoice('pl-PL')?.name).toBe('B');
    voiceList.current = [makeVoice('A', 'pl-PL', false), makeVoice('C', 'pl-PL', false)];
    expect(pickVoice('pl-PL')?.name).toBe('A');
  });

  it('strictly prefers any local voice over a remote or Google voice', () => {
    const google = makeVoice('Google polski', 'pl-PL', false, true);
    const localOther = makeVoice('Zosia', 'pl', true);
    voiceList.current = [google, localOther];
    expect(pickVoice('pl-PL')).toBe(localOther);
    const localRegional = makeVoice('Daniel', 'en-GB', true);
    voiceList.current = [makeVoice('Google US English', 'en-US', false, true), localRegional];
    expect(pickVoice('en-US')).toBe(localRegional);
  });

  it('avoids novelty and robotic macOS voices', () => {
    voiceList.current = [makeVoice('Albert', 'en-US', true), makeVoice('Zarvox', 'en-US', true), makeVoice('Samantha', 'en-US', true)];
    expect(pickVoice('en-US')?.name).toBe('Samantha');
    voiceList.current = [makeVoice('Fred', 'en-US', true), makeVoice('Whisper', 'en-US', true)];
    expect(pickVoice('en-US')?.name).toBe('Fred');
  });

  it('honours an explicit voice name from the page config', () => {
    window.kotlinskidevA11yReadPage = { voice: 'ewa' };
    voiceList.current = [enhanced, makeVoice('Ewa', 'pl-PL', true)];
    expect(pickVoice('pl-PL')?.name).toBe('Ewa');
    window.kotlinskidevA11yReadPage = { voice: 'auto' };
    expect(pickVoice('pl-PL')).toBe(enhanced);
    delete window.kotlinskidevA11yReadPage;
  });

  it('honours a visitor voice preference but ignores the old auto-pinned key', () => {
    voiceList.current = [enhanced, local];
    localStorage.setItem('ka11y-voice', local.voiceURI);
    expect(pickVoice('pl-PL')).toBe(enhanced);
    localStorage.setItem('ka11y-voice-pref', 'Local Polish');
    expect(pickVoice('pl-PL')).toBe(local);
  });

  it('falls back to the primary subtag and returns null without a match', () => {
    expect(pickVoice('en-GB')).toBe(english);
    expect(pickVoice('de')).toBeNull();
  });

  it('never writes the auto-picked voice to storage', () => {
    pickVoice('pl-PL');
    expect(localStorage.length).toBe(0);
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

  it('queues every chunk up front with rate, pitch and volume set', async () => {
    voiceList.current = [makeVoice('Daniel', 'pl-PL', false), makeVoice('Remote2', 'pl-PL', false)];
    const sentence = `${'word '.repeat(30).trim()}. `;
    document.body.innerHTML = `<p id="p">${sentence.repeat(4)}</p>`;
    window.kotlinskidevA11yReadPage = { rate: 5 };
    readPage.on(true);
    document.getElementById('p')?.click();
    await flush();
    expect(speak.mock.calls.length).toBeGreaterThan(1);
    const first = speak.mock.calls[0]?.[0] as FakeUtterance & { rate: number; pitch: number; volume: number };
    expect(first.rate).toBe(2);
    expect(first.pitch).toBe(1);
    expect(first.volume).toBe(1);
    (speak.mock.calls.map((call) => call[0] as FakeUtterance)).forEach((item) => expect(item.text.length).toBeLessThanOrEqual(180));
    delete window.kotlinskidevA11yReadPage;
  });

  describe('admin settings', () => {
    const bind = (current: { voice?: string; rate?: number } | undefined, ensure = jest.fn(() => Promise.resolve())): jest.Mock => {
      bindReadPreferenceSource({ current: () => current, ensure });
      return ensure;
    };

    afterEach(() => {
      bindReadPreferenceSource(null);
      delete window.kotlinskidevA11yReadPage;
    });

    it('uses the voice from the settings and keeps automatic for an empty name', () => {
      voiceList.current = [enhanced, makeVoice('Ewa', 'pl-PL', true)];
      bind({ voice: 'Ewa', rate: 1 });
      expect(pickVoice('pl-PL')?.name).toBe('Ewa');
      bind({ voice: '', rate: 1 });
      expect(pickVoice('pl-PL')).toBe(enhanced);
    });

    it('lets the window override win over the settings', () => {
      voiceList.current = [enhanced, makeVoice('Ewa', 'pl-PL', true)];
      bind({ voice: 'Ewa' });
      window.kotlinskidevA11yReadPage = { voice: 'zosia' };
      expect(pickVoice('pl-PL')).toBe(enhanced);
    });

    it('uses the speaking speed from the settings and the override beats it', async () => {
      bind({ voice: '', rate: 1.4 });
      readPage.on(true);
      document.getElementById('p')?.click();
      await flush();
      expect((speak.mock.calls[0]?.[0] as FakeUtterance).rate).toBe(1.4);
      readPage.off();
      speak.mockClear();
      window.kotlinskidevA11yReadPage = { rate: 0.7 };
      readPage.on(true);
      document.getElementById('p')?.click();
      await flush();
      expect((speak.mock.calls[0]?.[0] as FakeUtterance).rate).toBe(0.7);
    });

    it('asks for the panel data when the feature turns on', () => {
      const ensure = bind(undefined);
      readPage.on(true);
      expect(ensure).toHaveBeenCalledTimes(1);
    });

    it('does not fail when the panel data cannot load', () => {
      bind(undefined, jest.fn(() => Promise.reject(new Error('offline'))));
      expect(() => readPage.on(true)).not.toThrow();
    });
  });

  it('reads long text in a few big chunks with a local voice', async () => {
    const sentence = `${'word '.repeat(30).trim()}. `;
    document.body.innerHTML = `<p id="p">${sentence.repeat(4)}</p>`;
    readPage.on(true);
    document.getElementById('p')?.click();
    await flush();
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it('uses the lang of the nearest element before the document language', async () => {
    document.body.innerHTML = '<p id="p" lang="en-US">Hello there</p>';
    voiceList.current = [enhanced, english];
    readPage.on(true);
    document.getElementById('p')?.click();
    await flush();
    expect((speak.mock.calls[0]?.[0] as FakeUtterance).voice).toBe(english);
  });

  it('keeps a remote voice alive with pause and resume', async () => {
    voiceList.current = [remote];
    const pause = jest.fn();
    const resume = jest.fn();
    Object.assign(synth, { pause, resume });
    synth.speaking = true;
    readPage.on(true);
    document.getElementById('p')?.click();
    await flush();
    jest.advanceTimersByTime(10000);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(resume).toHaveBeenCalledTimes(1);
    readPage.off();
    jest.advanceTimersByTime(20000);
    expect(pause).toHaveBeenCalledTimes(1);
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
