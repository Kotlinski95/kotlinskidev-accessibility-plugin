export type FeatureGroupId = 'content' | 'color' | 'orientation';

export interface FeatureGroup {
  id: FeatureGroupId;
  titleKey: string;
  features: readonly string[];
}

export const FEATURE_GROUPS: readonly FeatureGroup[] = [
  {
    id: 'content',
    titleKey: 'groupContent',
    features: [
      'biggerText',
      'lineHeight',
      'letterSpacing',
      'fontWeight',
      'readableFont',
      'dyslexicFont',
      'textAlign',
      'highlightLinks',
      'bigCursor',
      'textMagnifier',
      'cognitiveReading',
    ],
  },
  {
    id: 'color',
    titleKey: 'groupColor',
    features: ['darkContrast', 'lightContrast', 'highContrast', 'monochrome', 'saturation'],
  },
  {
    id: 'orientation',
    titleKey: 'groupOrientation',
    features: [
      'readingLine',
      'readingMask',
      'readPage',
      'keyboardNavigation',
      'hideImages',
      'muteSounds',
      'highlightTitles',
      'highlightAll',
      'stopAnimations',
      'skipToContent',
    ],
  },
];

export const FEATURE_LEVEL_LABELS: Readonly<Record<string, readonly string[]>> = {
  biggerText: ['levelLow', 'levelMedium', 'levelHigh'],
  lineHeight: ['levelLow', 'levelMedium', 'levelHigh'],
  textAlign: ['levelLeft', 'levelCenter', 'levelRight'],
  saturation: ['levelLow', 'levelHigh'],
};

export const levelCountOf = (key: string): number => FEATURE_LEVEL_LABELS[key]?.length ?? 1;
