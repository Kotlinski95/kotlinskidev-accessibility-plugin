import { createVoiceField } from '../../../src/ts/admin/fields/voice';
import { change, sampleContext } from './helpers';

jest.mock('@wordpress/i18n', () => jest.requireActual('./wp-mocks').i18nMock, { virtual: true });

const voice = (name: string, lang: string): SpeechSynthesisVoice => ({ name, lang, voiceURI: name, localService: true, default: false });

const installSynth = (voices: SpeechSynthesisVoice[]) => {
  const listeners: Array<() => void> = [];
  const synth = {
    getVoices: jest.fn(() => voices),
    addEventListener: jest.fn((_type: string, listener: () => void) => void listeners.push(listener)),
  };
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synth });
  return { synth, fire: (): void => listeners.forEach((listener) => listener()) };
};

afterEach(() => {
  Reflect.deleteProperty(window, 'speechSynthesis');
  document.body.replaceChildren();
});

describe('voice field', () => {
  it('lists Automatic first and the installed voices', () => {
    installSynth([voice('Ewa', 'pl-PL'), voice('Samantha', 'en-US')]);
    const ctx = sampleContext();
    const field = createVoiceField(ctx, { path: 'readPage.voice', label: 'Voice' });
    const select = field.querySelector('select') as HTMLSelectElement;
    expect([...select.options].map((option) => option.value)).toEqual(['', 'Ewa', 'Samantha']);
    expect(select.options[0]?.textContent).toBe('Automatic');
    select.value = 'Ewa';
    change(select, 'change');
    expect(ctx.state.get('readPage.voice')).toBe('Ewa');
  });

  it('keeps a saved voice that is not installed on this device', () => {
    installSynth([voice('Ewa', 'pl-PL')]);
    const ctx = sampleContext();
    ctx.state.set('readPage.voice', 'Zosia');
    const select = createVoiceField(ctx, { path: 'readPage.voice', label: 'Voice' }).querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('Zosia');
    expect(select.selectedOptions[0]?.textContent).toContain('not installed');
  });

  it('falls back to a text input without speech synthesis and upgrades when voices load', () => {
    const ctx = sampleContext();
    const plain = createVoiceField(ctx, { path: 'readPage.voice', label: 'Voice' });
    expect(plain.querySelector('select')).toBeNull();
    expect(plain.querySelector('input[type="text"]')).not.toBeNull();

    const voices: SpeechSynthesisVoice[] = [];
    const { fire } = installSynth(voices);
    const late = createVoiceField(ctx, { path: 'readPage.voice', label: 'Voice' });
    document.body.append(late);
    const input = late.querySelector('input') as HTMLInputElement;
    const id = input.id;
    expect(late.querySelector('select')).toBeNull();
    voices.push(voice('Ewa', 'pl-PL'));
    fire();
    const select = late.querySelector('select') as HTMLSelectElement;
    expect(select.id).toBe(id);
    expect(late.querySelector('label')?.getAttribute('for')).toBe(id);
  });
});
