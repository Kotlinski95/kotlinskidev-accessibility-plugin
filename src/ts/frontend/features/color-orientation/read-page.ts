import type { FeatureModule } from '../../apply';
import { featureClassBase } from '../../feature-utils';
import { HOST_ID } from './overlay';
import { addRootClass, removeRootClass } from './root-class';

const READABLE_SELECTOR = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, figcaption, dt, dd, td, th, label, a, button, summary';
const CLASS_NAME = featureClassBase('readPage');

let listening = false;

const hasSpeech = (): boolean => 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

const pageLanguage = (): string => document.documentElement.lang || navigator.language || 'en';

export const readableTextOf = (target: Element): string => {
  const block = target.closest(READABLE_SELECTOR) ?? target;
  return (block.textContent ?? '').replace(/\s+/g, ' ').trim();
};

const onDocumentClick = (event: MouseEvent): void => {
  const target = event.target;
  if (!(target instanceof Element) || target.closest(`#${HOST_ID}`)) return;
  const text = readableTextOf(target);
  window.speechSynthesis.cancel();
  if (text === '') return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = pageLanguage();
  window.speechSynthesis.speak(utterance);
};

const on = (): void => {
  addRootClass(CLASS_NAME);
  if (listening || !hasSpeech()) return;
  document.addEventListener('click', onDocumentClick, true);
  listening = true;
};

const off = (): void => {
  removeRootClass(CLASS_NAME);
  if (listening) document.removeEventListener('click', onDocumentClick, true);
  listening = false;
  if (hasSpeech()) window.speechSynthesis.cancel();
};

export const readPage: FeatureModule = { key: 'readPage', on, off };
