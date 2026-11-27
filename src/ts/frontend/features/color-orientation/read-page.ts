import type { FeatureModule } from '../../apply';
import { featureClassBase } from '../../feature-utils';
import { HOST_ID } from './overlay';
import { addRootClass, removeRootClass } from './root-class';

const READABLE_SELECTOR = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, figcaption, dt, dd, td, th, label, a, button, summary';
const CLASS_NAME = featureClassBase('readPage');

const VOICE_KEY = 'ka11y-voice';
const VOICE_WAIT_MS = 1000;
const CHUNK_MAX = 180;
const PREFERRED_NAME = /enhanced|premium|siri|natural|neural/i;

let listening = false;
let generation = 0;

const hasSpeech = (): boolean => 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

const normalizeLang = (tag: string): string => tag.replace(/_/g, '-');

const pageLanguage = (): string => normalizeLang(document.documentElement.lang || navigator.language || 'en');

const readStoredVoice = (): string | null => {
  try {
    return localStorage.getItem(VOICE_KEY);
  } catch {
    return null;
  }
};

const storeVoice = (uri: string): void => {
  try {
    localStorage.setItem(VOICE_KEY, uri);
  } catch {
    return;
  }
};

const score = (voice: SpeechSynthesisVoice): number =>
  (PREFERRED_NAME.test(voice.name) ? 4 : 0) + (voice.localService ? 2 : 0) + (voice.default ? 1 : 0);

export const pickVoice = (lang: string): SpeechSynthesisVoice | null => {
  const tag = normalizeLang(lang).toLowerCase();
  const primary = tag.split('-')[0] ?? tag;
  const voices = window.speechSynthesis.getVoices();
  const exact = voices.filter((voice) => normalizeLang(voice.lang).toLowerCase() === tag);
  const candidates = exact.length > 0 ? exact : voices.filter((voice) => (normalizeLang(voice.lang).toLowerCase().split('-')[0] ?? '') === primary);
  if (candidates.length === 0) return null;
  const stored = readStoredVoice();
  const remembered = candidates.find((voice) => voice.voiceURI === stored);
  if (remembered) return remembered;
  const best = candidates.reduce((top, voice) => (score(voice) > score(top) ? voice : top));
  storeVoice(best.voiceURI);
  return best;
};

const voiceFor = (lang: string): Promise<SpeechSynthesisVoice | null> => {
  if (window.speechSynthesis.getVoices().length > 0) return Promise.resolve(pickVoice(lang));
  return new Promise((resolve) => {
    const finish = (): void => {
      window.speechSynthesis.removeEventListener('voiceschanged', finish);
      window.clearTimeout(timer);
      resolve(pickVoice(lang));
    };
    const timer = window.setTimeout(finish, VOICE_WAIT_MS);
    window.speechSynthesis.addEventListener('voiceschanged', finish);
  });
};

export const chunkText = (text: string): string[] => {
  const sentences = text.match(/[^.!?…]+[.!?…]*\s*/g) ?? [text];
  const chunks: string[] = [];
  let current = '';
  const push = (piece: string): void => {
    if (current !== '' && current.length + piece.length > CHUNK_MAX) {
      chunks.push(current.trim());
      current = '';
    }
    current += piece;
  };
  sentences.forEach((sentence) => {
    if (sentence.length <= CHUNK_MAX) {
      push(sentence);
      return;
    }
    sentence.split(/(?<=\s)/).forEach(push);
  });
  if (current.trim() !== '') chunks.push(current.trim());
  return chunks;
};

const warmVoices = (): void => {
  window.speechSynthesis.getVoices();
  const warm = (): void => {
    window.speechSynthesis.getVoices();
  };
  window.speechSynthesis.addEventListener('voiceschanged', warm, { once: true });
};

const cancelSpeech = (): void => {
  generation += 1;
  const synth = window.speechSynthesis;
  if (synth.speaking || synth.pending) synth.cancel();
};

const speakChunks = (chunks: string[], lang: string, voice: SpeechSynthesisVoice | null, id: number): void => {
  const [first, ...rest] = chunks;
  if (first === undefined || id !== generation) return;
  const utterance = new SpeechSynthesisUtterance(first);
  utterance.lang = voice?.lang ?? lang;
  if (voice) utterance.voice = voice;
  utterance.onend = (): void => speakChunks(rest, lang, voice, id);
  window.speechSynthesis.speak(utterance);
};

export const readableTextOf = (target: Element): string => {
  const block = target.closest(READABLE_SELECTOR) ?? target;
  return (block.textContent ?? '').replace(/\s+/g, ' ').trim();
};

const onDocumentClick = (event: MouseEvent): void => {
  const target = event.target;
  if (!(target instanceof Element) || target.closest(`#${HOST_ID}`)) return;
  const text = readableTextOf(target);
  cancelSpeech();
  if (text === '') return;
  const id = generation;
  const lang = pageLanguage();
  window.setTimeout(() => {
    if (id !== generation) return;
    void voiceFor(lang).then((voice) => speakChunks(chunkText(text), lang, voice, id));
  }, 0);
};

const onPageHide = (): void => cancelSpeech();

const on = (): void => {
  addRootClass(CLASS_NAME);
  if (listening || !hasSpeech()) return;
  warmVoices();
  document.addEventListener('click', onDocumentClick, true);
  window.addEventListener('pagehide', onPageHide);
  listening = true;
};

const off = (): void => {
  removeRootClass(CLASS_NAME);
  if (listening) {
    document.removeEventListener('click', onDocumentClick, true);
    window.removeEventListener('pagehide', onPageHide);
  }
  listening = false;
  if (hasSpeech()) cancelSpeech();
};

export const readPage: FeatureModule = { key: 'readPage', on, off };
