import { getFeature, unregisterFeature } from '../../../../src/ts/frontend/apply';
import { allFeatures, registerAllFeatures } from '../../../../src/ts/frontend/features';
import { contentFeatures } from '../../../../src/ts/frontend/features/content';

const CONTENT_KEYS = [
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

describe('content feature registry', () => {
  afterEach(() => allFeatures.forEach((module) => unregisterFeature(module.key)));

  it('exports every content feature key once', () => {
    expect(contentFeatures.map((module) => module.key)).toEqual(CONTENT_KEYS);
  });

  it('registers content features with the applier', () => {
    registerAllFeatures();
    CONTENT_KEYS.forEach((key) => expect(getFeature(key)).toBeDefined());
  });
});
