const PREFERENCE_KEY = 'ka11y-voice-pref';
const PREMIUM_NAME = /premium|siri/i;
const ENHANCED_NAME = /enhanced|natural|neural/i;
const KNOWN_GOOD_NAME = /^(samantha|alex|daniel|karen|moira|tessa|serena|oliver|zosia|ewa|ava|kate|anna)\b/i;
const ROBOTIC_NAME =
  /^(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|junior|kathy|organ|pipe organ|ralph|superstar|trinoids|whisper|wobble|zarvox|fred|princess|bruce|agnes|vicki|victoria)\b/i;
const ROBOTIC_VENDOR = /google|microsoft online|\(online\)|espeak|festival/i;

export interface ReadPagePreference {
  voice?: string;
  rate?: number;
}

export const RATE_MIN = 0.5;
export const RATE_MAX = 2;

export const normalizeLang = (tag: string): string => tag.replace(/_/g, '-');

const primaryOf = (tag: string): string => normalizeLang(tag).toLowerCase().split('-')[0] ?? '';

const qualityOf = (voice: SpeechSynthesisVoice): number => {
  let score = voice.default ? 1 : 0;
  if (PREMIUM_NAME.test(voice.name)) score += 6;
  else if (ENHANCED_NAME.test(voice.name)) score += 5;
  if (KNOWN_GOOD_NAME.test(voice.name)) score += 2;
  if (ROBOTIC_NAME.test(voice.name)) score -= 10;
  if (ROBOTIC_VENDOR.test(voice.name)) score -= 3;
  return score;
};

const bestOf = (voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null =>
  voices.reduce<SpeechSynthesisVoice | null>((top, voice) => (top === null || qualityOf(voice) > qualityOf(top) ? voice : top), null);

const readStoredPreference = (): string => {
  try {
    return localStorage.getItem(PREFERENCE_KEY) ?? '';
  } catch {
    return '';
  }
};

export const readPreference = (): ReadPagePreference => window.kotlinskidevA11yReadPage ?? {};

export const clampRate = (rate: unknown): number =>
  typeof rate === 'number' && Number.isFinite(rate) ? Math.min(Math.max(rate, RATE_MIN), RATE_MAX) : 1;

const preferredByName = (voices: SpeechSynthesisVoice[], wanted: string): SpeechSynthesisVoice | null => {
  const needle = wanted.trim().toLowerCase();
  if (needle === '' || needle === 'auto') return null;
  const matches = voices.filter((voice) => voice.voiceURI.toLowerCase() === needle || voice.name.toLowerCase().includes(needle));
  return bestOf(matches.filter((voice) => voice.localService)) ?? bestOf(matches);
};

export const pickVoice = (lang: string): SpeechSynthesisVoice | null => {
  const voices = window.speechSynthesis.getVoices();
  const named = preferredByName(voices, readPreference().voice ?? readStoredPreference());
  if (named) return named;
  const tag = normalizeLang(lang).toLowerCase();
  const primary = primaryOf(lang);
  const sameLanguage = voices.filter((voice) => primaryOf(voice.lang) === primary);
  const isExact = (voice: SpeechSynthesisVoice): boolean => normalizeLang(voice.lang).toLowerCase() === tag;
  const tiers = [
    sameLanguage.filter((voice) => voice.localService && isExact(voice)),
    sameLanguage.filter((voice) => voice.localService),
    sameLanguage.filter(isExact),
    sameLanguage,
  ];
  const tier = tiers.find((group) => group.length > 0);
  return tier ? bestOf(tier) : null;
};
