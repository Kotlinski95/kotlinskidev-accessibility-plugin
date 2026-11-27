import type { FeatureModule } from '../../apply';
import { featureClassBase } from '../../feature-utils';
import { HOST_ID } from './overlay';
import { addRootClass, removeRootClass } from './root-class';
import { clampRate, ensureReadPreference, hoverDelay, normalizeLang, pickVoice, readPreference, readTrigger } from './read-voice';
import type { ReadTarget } from './read-target';
import { READABLE_SELECTOR, focusTargetOf, hoverTargetOf, touchTargetOf } from './read-target';

export { pickVoice };

const CLASS_NAME = featureClassBase('readPage');

const VOICE_WAIT_MS = 1000;
const CHUNK_REMOTE = 180;
const CHUNK_LOCAL = 1200;
const KEEPALIVE_MS = 10000;
const REPEAT_WINDOW_MS = 2000;
const LISTEN: AddEventListenerOptions = { capture: true, passive: true };

let listening = false;
let generation = 0;
let keepAlive = 0;
let queued: SpeechSynthesisUtterance[] = [];
let intentTimer = 0;
let hoveredElement: Element | null = null;
let lastElement: Element | null = null;
let lastReadAt = 0;
let pointerDriven = false;

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

const isOwnWidget = (target: Element): boolean => target.closest(`#${HOST_ID}`) !== null;

const clearIntent = (): void => {
  if (intentTimer !== 0) window.clearTimeout(intentTimer);
  intentTimer = 0;
};

const isRepeat = (element: Element): boolean =>
  element === lastElement && (window.speechSynthesis.speaking || window.speechSynthesis.pending || Date.now() - lastReadAt < REPEAT_WINDOW_MS);

const begin = (element: Element, text: string): void => {
  cancelSpeech();
  lastElement = element;
  lastReadAt = Date.now();
  const id = generation;
  const lang = languageOf(element);
  window.setTimeout(() => {
    if (id !== generation) return;
    void voiceFor(lang).then((voice) => speakAll(text, lang, voice, id));
  }, 0);
};

const readNow = (target: ReadTarget | null): void => {
  if (target === null || isRepeat(target.element)) return;
  begin(target.element, target.text);
};

const elementOf = (event: Event): Element | null => (event.target instanceof Element && !isOwnWidget(event.target) ? event.target : null);

const onDocumentClick = (event: Event): void => {
  const mode = readTrigger();
  const target = elementOf(event);
  if (mode === 'hover' || target === null) return;
  const block = target.closest(READABLE_SELECTOR) ?? target;
  const text = readableTextOf(target);
  if (mode === 'both' && isRepeat(block)) return;
  if (text === '') {
    cancelSpeech();
    return;
  }
  begin(block, text);
};

const onPointerOver = (event: Event): void => {
  if (readTrigger() === 'click' || (event as PointerEvent).pointerType === 'touch') return;
  const target = elementOf(event);
  const resolved = target === null ? null : hoverTargetOf(target);
  if (resolved === null) {
    hoveredElement = null;
    clearIntent();
    return;
  }
  if (resolved.element === hoveredElement) return;
  hoveredElement = resolved.element;
  clearIntent();
  intentTimer = window.setTimeout(() => {
    intentTimer = 0;
    readNow(resolved);
  }, hoverDelay());
};

const onFocusIn = (event: Event): void => {
  if (readTrigger() === 'click' || pointerDriven) return;
  const target = elementOf(event);
  if (target === null) return;
  clearIntent();
  readNow(focusTargetOf(target));
};

const onTouchStart = (event: Event): void => {
  if (readTrigger() === 'click') return;
  const target = elementOf(event);
  if (target !== null) readNow(touchTargetOf(target));
};

const onPointerDown = (): void => {
  pointerDriven = true;
};

const onKeyDown = (event: Event): void => {
  pointerDriven = false;
  if ((event as KeyboardEvent).key !== 'Escape') return;
  clearIntent();
  cancelSpeech();
};

const onPageLeave = (): void => {
  if (readTrigger() === 'click') return;
  hoveredElement = null;
  clearIntent();
  cancelSpeech();
};

const onPageHide = (): void => cancelSpeech();

const DOCUMENT_LISTENERS: ReadonlyArray<readonly [string, EventListener]> = [
  ['click', onDocumentClick],
  ['pointerover', onPointerOver],
  ['focusin', onFocusIn],
  ['touchstart', onTouchStart],
  ['pointerdown', onPointerDown],
  ['keydown', onKeyDown],
];

const on = (): void => {
  addRootClass(CLASS_NAME);
  if (listening || !hasSpeech()) return;
  warmVoices();
  ensureReadPreference();
  DOCUMENT_LISTENERS.forEach(([type, listener]) => document.addEventListener(type, listener, LISTEN));
  document.documentElement.addEventListener('pointerleave', onPageLeave, LISTEN);
  window.addEventListener('pagehide', onPageHide);
  listening = true;
};

const off = (): void => {
  removeRootClass(CLASS_NAME);
  if (listening) {
    DOCUMENT_LISTENERS.forEach(([type, listener]) => document.removeEventListener(type, listener, LISTEN));
    document.documentElement.removeEventListener('pointerleave', onPageLeave, LISTEN);
    window.removeEventListener('pagehide', onPageHide);
  }
  listening = false;
  clearIntent();
  hoveredElement = null;
  lastElement = null;
  pointerDriven = false;
  if (hasSpeech()) cancelSpeech();
};

export const readPage: FeatureModule = { key: 'readPage', on, off };
