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
