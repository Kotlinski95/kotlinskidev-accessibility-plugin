import type { FeatureModule } from '../../apply';
import { biggerText } from './bigger-text';
import { bigCursor } from './big-cursor';
import { cognitiveReading } from './cognitive-reading';
import { dyslexicFont } from './dyslexic-font';
import { fontWeight } from './font-weight';
import { highlightLinks } from './highlight-links';
import { letterSpacing } from './letter-spacing';
import { lineHeight } from './line-height';
import { readableFont } from './readable-font';
import { textAlign } from './text-align';
import { textMagnifier } from './text-magnifier';

export const contentFeatures: FeatureModule[] = [
  biggerText,
  lineHeight,
  letterSpacing,
  fontWeight,
  readableFont,
  dyslexicFont,
  textAlign,
  highlightLinks,
  bigCursor,
  textMagnifier,
  cognitiveReading,
];
