export type AttrValue = string | number | boolean | undefined | null;
export type Child = Node | string | null | undefined | false;

export interface FieldOptions {
  path: string;
  label: string;
  help?: string;
  bare?: boolean;
}

let counter = 0;

export const uid = (prefix: string): string => {
  counter += 1;
  return `${prefix}-${counter}`;
};

export const appendChildren = (parent: Node, children: readonly Child[]): void => {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
};

export const h = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Readonly<Record<string, AttrValue>> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    element.setAttribute(name, value === true ? '' : String(value));
  }
  appendChildren(element, children);
  return element;
};

export const PATH_ATTRIBUTE = 'data-ka11y-path';

export const markPath = <T extends HTMLElement>(element: T, path: string): T => {
  element.setAttribute(PATH_ATTRIBUTE, path);
  return element;
};

export const wrapField = (control: HTMLElement, options: FieldOptions): HTMLElement => {
  if (options.bare === true) {
    control.setAttribute('aria-label', options.label);
    return control;
  }
  const id = uid('ka11y-field');
  control.id = id;
  const help = options.help ? h('p', { class: 'description ka11y-field__help', id: `${id}-help` }, options.help) : null;
  if (help) control.setAttribute('aria-describedby', help.id);
  return h(
    'div',
    { class: 'ka11y-field' },
    h('label', { class: 'ka11y-field__label', for: id }, options.label),
    control,
    help
  );
};

export const fieldset = (legend: string, className: string, ...children: Child[]): HTMLFieldSetElement =>
  h('fieldset', { class: `ka11y-fieldset ${className}`.trim() }, h('legend', { class: 'ka11y-fieldset__legend' }, legend), ...children);

export const button = (label: string, className: string, onClick: () => void): HTMLButtonElement => {
  const element = h('button', { type: 'button', class: className }, label);
  element.addEventListener('click', onClick);
  return element;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const errorMessage = (error: unknown, fallback: string): string => {
  if (isRecord(error) && typeof error.message === 'string' && error.message !== '') return error.message;
  if (error instanceof Error && error.message !== '') return error.message;
  return fallback;
};
