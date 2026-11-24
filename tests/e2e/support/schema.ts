export const FEATURE_LEVELS: Readonly<Record<string, number>> = {
  biggerText: 3,
  lineHeight: 3,
  letterSpacing: 1,
  fontWeight: 1,
  readableFont: 1,
  dyslexicFont: 1,
  textAlign: 3,
  highlightLinks: 1,
  bigCursor: 1,
  textMagnifier: 1,
  cognitiveReading: 1,
  darkContrast: 1,
  lightContrast: 1,
  highContrast: 1,
  monochrome: 1,
  saturation: 2,
  readingLine: 1,
  readingMask: 1,
  readPage: 1,
  keyboardNavigation: 1,
  hideImages: 1,
  muteSounds: 1,
  highlightTitles: 1,
  highlightAll: 1,
  stopAnimations: 1,
  skipToContent: 1,
};

export const PROFILE_KEYS: readonly string[] = ['visionImpaired', 'seizureSafe', 'adhdFriendly', 'blindness', 'epilepsySafe'];

export const kebab = (name: string): string => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
