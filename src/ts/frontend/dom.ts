export type AttributeValue = string | boolean | undefined;

export type Attributes = Record<string, AttributeValue>;

export const createElement = <K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  attributes: Attributes = {},
  children: Array<Node | string> = []
): HTMLElementTagNameMap[K] => {
  const element = doc.createElement(tag);
  Object.entries(attributes).forEach(([name, value]) => {
    if (value === undefined || value === false) return;
    element.setAttribute(name, value === true ? '' : value);
  });
  children.forEach((child) => element.append(child));
  return element;
};

const SVG_NS = 'http://www.w3.org/2000/svg';

export const createSvg = (doc: Document, pathData: string): SVGSVGElement => {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'ka11y-svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = doc.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', pathData);
  svg.append(path);
  return svg;
};
