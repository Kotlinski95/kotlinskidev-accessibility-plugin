import type { FeatureModule } from '../../apply';
import { featureClassBase } from '../../feature-utils';
import { HOST_ID } from './overlay';
import { addRootClass, removeRootClass } from './root-class';
import { clampRate, ensureReadPreference, normalizeLang, pickVoice, readPreference } from './read-voice';

export { pickVoice };

const READABLE_SELECTOR = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, figcaption, dt, dd, td, th, label, a, button, summary';
const CLASS_NAME = featureClassBase('readPage');

const VOICE_WAIT_MS = 1000;
const CHUNK_REMOTE = 180;
const CHUNK_LOCAL = 1200;
const KEEPALIVE_MS = 10000;

let listening = false;
let generation = 0;
let keepAlive = 0;
let queued: SpeechSynthesisUtterance[] = [];

const hasSpeech = (): boolean => 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

const languageOf = (target: Element): string => {
  const scoped = target.closest('[lang]')?.getAttribute('lang') ?? '';
  return normalizeLang(scoped || document.documentElement.lang || navigator.language || 'en');
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

export const chunkText = (text: string, max: number = CHUNK_REMOTE): string[] => {
  const sentences = text.match(/[^.!?…]+[.!?…]*\s*/g) ?? [text];
  const chunks: string[] = [];
  let current = '';
  const push = (piece: string): void => {
    if (current !== '' && current.length + piece.length > max) {
      chunks.push(current.trim());
      current = '';
    }
    current += piece;
  };
  sentences.forEach((sentence) => {
    if (sentence.length <= max) {
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

const stopKeepAlive = (): void => {
  if (keepAlive !== 0) window.clearInterval(keepAlive);
  keepAlive = 0;
};

const startKeepAlive = (): void => {
  stopKeepAlive();
  keepAlive = window.setInterval(() => {
    const synth = window.speechSynthesis;
    if (!synth.speaking) {
      stopKeepAlive();
      return;
    }
    synth.pause();
    synth.resume();
  }, KEEPALIVE_MS);
};

const cancelSpeech = (): void => {
  generation += 1;
  stopKeepAlive();
  queued = [];
  const synth = window.speechSynthesis;
  if (synth.speaking || synth.pending) synth.cancel();
};

const speakAll = (text: string, lang: string, voice: SpeechSynthesisVoice | null, id: number): void => {
  if (id !== generation) return;
  const isLocal = voice?.localService === true;
  const rate = clampRate(readPreference().rate);
  queued = chunkText(text, isLocal ? CHUNK_LOCAL : CHUNK_REMOTE).map((chunk) => {
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.lang = voice?.lang ?? lang;
    if (voice) utterance.voice = voice;
    utterance.rate = rate;
    utterance.pitch = 1;
    utterance.volume = 1;
    return utterance;
  });
  const last = queued[queued.length - 1];
  if (last) last.onend = (): void => stopKeepAlive();
  queued.forEach((utterance) => window.speechSynthesis.speak(utterance));
  if (!isLocal) startKeepAlive();
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
  const lang = languageOf(target);
  window.setTimeout(() => {
    if (id !== generation) return;
    void voiceFor(lang).then((voice) => speakAll(text, lang, voice, id));
  }, 0);
};

const onPageHide = (): void => cancelSpeech();

const on = (): void => {
  addRootClass(CLASS_NAME);
  if (listening || !hasSpeech()) return;
  warmVoices();
  ensureReadPreference();
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
