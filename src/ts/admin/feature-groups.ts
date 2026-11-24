import { __ } from '@wordpress/i18n';

export interface AdminFeatureGroup {
  id: string;
  label: string;
  features: readonly string[];
}

const CONTENT: readonly string[] = [
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
];

const COLOR: readonly string[] = ['darkContrast', 'lightContrast', 'highContrast', 'monochrome', 'saturation'];

const LEVEL_LABEL_KEYS: Readonly<Record<string, readonly string[]>> = {
  biggerText: ['levelLow', 'levelMedium', 'levelHigh'],
  lineHeight: ['levelLow', 'levelMedium', 'levelHigh'],
  textAlign: ['levelLeft', 'levelCenter', 'levelRight'],
  saturation: ['levelLow', 'levelHigh'],
};

export const levelLabelKeys = (feature: string): readonly string[] => LEVEL_LABEL_KEYS[feature] ?? [];

export const featureGroups = (features: readonly string[]): AdminFeatureGroup[] => {
  const content = features.filter((feature) => CONTENT.includes(feature));
  const color = features.filter((feature) => COLOR.includes(feature));
  const orientation = features.filter((feature) => !CONTENT.includes(feature) && !COLOR.includes(feature));
  return [
    { id: 'content', label: __('Content', 'kotlinskidev-accessibility'), features: content },
    { id: 'color', label: __('Color', 'kotlinskidev-accessibility'), features: color },
    { id: 'orientation', label: __('Orientation', 'kotlinskidev-accessibility'), features: orientation },
  ];
};
