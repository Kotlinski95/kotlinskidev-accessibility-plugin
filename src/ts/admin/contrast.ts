import { resolveColor } from './theme-color';

export const TEXT_MINIMUM = 4.5;
export const UI_MINIMUM = 3;

export type ContrastTokens = Readonly<Record<string, unknown>>;

export interface ContrastPair {
  foreground: string;
  background: string;
  minimum: number;
}

export interface ContrastReading extends ContrastPair {
  ratio: number | null;
  pass: boolean;
}

export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  { foreground: 'onPrimary', background: 'primary', minimum: TEXT_MINIMUM },
  { foreground: 'onPrimaryDark', background: 'primaryDark', minimum: TEXT_MINIMUM },
  { foreground: 'onHeader', background: 'headerBg', minimum: TEXT_MINIMUM },
  { foreground: 'textLight', background: 'surfaceLight', minimum: TEXT_MINIMUM },
  { foreground: 'textDark', background: 'surfaceDark', minimum: TEXT_MINIMUM },
  { foreground: 'primary', background: 'surfaceLight', minimum: UI_MINIMUM },
  { foreground: 'primaryDark', background: 'surfaceDark', minimum: UI_MINIMUM },
];

type Rgb = readonly [number, number, number];

const HEX_PATTERN = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export const parseColor = (input: unknown): Rgb | null => {
  const value = resolveColor(input);
  if (typeof value !== 'string' || !HEX_PATTERN.test(value)) return null;
  const digits = value.slice(1);
  const expanded = digits.length <= 4 ? [...digits].map((digit) => digit + digit).join('') : digits;
  const channel = (index: number): number => parseInt(expanded.slice(index * 2, index * 2 + 2), 16);
  return [channel(0), channel(1), channel(2)];
};

const linearize = (channel: number): number => {
  const unit = channel / 255;
  return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
};

export const relativeLuminance = ([red, green, blue]: Rgb): number =>
  0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue);

export const contrastRatio = (foreground: unknown, background: unknown): number | null => {
  const front = parseColor(foreground);
  const back = parseColor(background);
  if (front === null || back === null) return null;
  const first = relativeLuminance(front);
  const second = relativeLuminance(back);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
};

export const formatRatio = (ratio: number): string => (Math.floor(ratio * 10) / 10).toFixed(1);

export const readPair = (pair: ContrastPair, tokens: ContrastTokens): ContrastReading => {
  const ratio = contrastRatio(tokens[pair.foreground], tokens[pair.background]);
  return { ...pair, ratio, pass: ratio !== null && ratio >= pair.minimum };
};

export const readPairs = (tokens: ContrastTokens): ContrastReading[] => CONTRAST_PAIRS.map((pair) => readPair(pair, tokens));

export const pairsFor = (token: string, tokens: ContrastTokens): ContrastReading[] =>
  readPairs(tokens).filter((reading) => reading.foreground === token || reading.background === token);

export const failingPairs = (tokens: ContrastTokens): ContrastReading[] =>
  readPairs(tokens).filter((reading) => reading.ratio !== null && !reading.pass);
