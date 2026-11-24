import { ROOT_ID } from '../../root';

export const MAGNIFIER_ATTRIBUTE = 'data-ka11y-magnifier';

export const SKIPPED_TAGS: ReadonlySet<string> = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEMPLATE',
  'LINK',
  'META',
  'HEAD',
  'TITLE',
  'BASE',
]);

const isValidSelector = (selector: string): boolean => {
  try {
    document.createDocumentFragment().querySelector(selector);
    return true;
  } catch {
    return false;
  }
};

export const buildExcludeSelector = (): string => {
  const base = [`#${ROOT_ID}`, `[${MAGNIFIER_ATTRIBUTE}]`];
  const custom = window.kotlinskidevA11y?.advanced?.excludeSelectors?.trim() ?? '';
  if (custom !== '' && isValidSelector(custom)) base.push(custom);
  return base.join(',');
};

export const elementOf = (node: Node): Element | null =>
  node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;

export const createExclusion = (extraSelector = ''): ((node: Node) => boolean) => {
  const selector = [buildExcludeSelector(), extraSelector].filter((part) => part !== '').join(',');
  return (node: Node): boolean => {
    const element = elementOf(node);
    return element === null || element.closest(selector) !== null;
  };
};
