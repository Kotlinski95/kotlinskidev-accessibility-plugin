import type { FeatureModule } from '../../apply';
import { buildExcludeSelector } from './exclusions';

export const COGNITIVE_ATTRIBUTE = 'data-ka11y-cr';

interface Replacement {
  original: Text;
  nodes: ChildNode[];
}

const BATCH_SIZE = 120;
const WORD_PATTERN = /[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu;
const SKIPPED_PARENTS: ReadonlySet<string> = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEXTAREA',
  'INPUT',
  'SELECT',
  'OPTION',
  'TEMPLATE',
]);

let queue: Text[] = [];
let replacements: Replacement[] = [];
let frame = 0;

const createBold = (text: string): HTMLElement => {
  const bold = document.createElement('b');
  bold.setAttribute(COGNITIVE_ATTRIBUTE, '');
  bold.textContent = text;
  return bold;
};

const splitWords = (text: string): ChildNode[] | null => {
  const nodes: ChildNode[] = [];
  let cursor = 0;
  Array.from(text.matchAll(WORD_PATTERN)).forEach((match) => {
    const index = match.index ?? 0;
    if (index > cursor) nodes.push(document.createTextNode(text.slice(cursor, index)));
    const letters = Array.from(match[0]);
    const half = Math.ceil(letters.length / 2);
    nodes.push(createBold(letters.slice(0, half).join('')));
    if (half < letters.length) nodes.push(document.createTextNode(letters.slice(half).join('')));
    cursor = index + match[0].length;
  });
  if (nodes.length === 0) return null;
  if (cursor < text.length) nodes.push(document.createTextNode(text.slice(cursor)));
  return nodes;
};

const collectTextNodes = (): Text[] => {
  const skipSelector = [buildExcludeSelector(), `[${COGNITIVE_ATTRIBUTE}]`, '[contenteditable]:not([contenteditable="false"])'].join(',');
  const acceptNode = (node: Node): number => {
    const parent = node.parentElement;
    if (!parent || SKIPPED_PARENTS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
    if ((node.nodeValue ?? '').trim() === '') return NodeFilter.FILTER_REJECT;
    return parent.closest(skipSelector) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode });
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  return nodes;
};

const transform = (original: Text): void => {
  if (!original.parentNode) return;
  const nodes = splitWords(original.nodeValue ?? '');
  if (!nodes) return;
  replacements.push({ original, nodes });
  original.replaceWith(...nodes);
};

const onFrame = (): void => {
  frame = 0;
  queue.splice(0, BATCH_SIZE).forEach(transform);
  if (queue.length > 0) schedule();
};

const schedule = (): void => {
  if (frame === 0) frame = window.requestAnimationFrame(onFrame);
};

const revert = ({ original, nodes }: Replacement): void => {
  const first = nodes[0];
  if (first?.parentNode) first.parentNode.insertBefore(original, first);
  nodes.forEach((node) => node.remove());
};

const on = (): void => {
  if (queue.length > 0 || replacements.length > 0) return;
  queue = collectTextNodes();
  schedule();
};

const off = (): void => {
  if (frame !== 0) window.cancelAnimationFrame(frame);
  frame = 0;
  queue = [];
  const pending = replacements;
  replacements = [];
  pending.reverse().forEach(revert);
};

export const cognitiveReading: FeatureModule = { key: 'cognitiveReading', on, off };
