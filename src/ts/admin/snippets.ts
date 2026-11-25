export type SnippetElement = 'button' | 'link';

export type SnippetKind = 'html' | 'link' | 'shortcode' | 'php' | 'javascript' | 'url';

export interface SnippetInput {
  action: string;
  label: string;
  element: SnippetElement;
  extraClass: string;
  homeUrl: string;
  urlActions: readonly string[];
}

export type SnippetSet = Record<SnippetKind, string | null>;

export const MAX_LABEL_LENGTH = 100;
export const MAX_CLASSES = 10;

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
};

export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);

export const escapeQuoted = (value: string): string => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const isControl = (character: string): boolean => {
  const code = character.charCodeAt(0);
  return code < 32 || code === 127;
};

export const cleanLabel = (value: string): string => [...value].map((character) => (isControl(character) ? ' ' : character)).join('').trim().slice(0, MAX_LABEL_LENGTH);

export const shortcodeLabel = (value: string): string => cleanLabel(value).replace(/["[\]]/g, '').trim();

export const classTokens = (value: string): string[] => {
  const tokens = value
    .split(/\s+/)
    .map((token) => token.replace(/[^A-Za-z0-9_-]/g, ''))
    .filter((token) => token !== '');
  return [...new Set(tokens)].slice(0, MAX_CLASSES);
};

export const actionName = (action: string): string => action.split(':')[0] ?? '';

const classAttribute = (tokens: readonly string[]): string => (tokens.length === 0 ? '' : ` class="${escapeHtml(tokens.join(' '))}"`);

const htmlSnippet = (input: SnippetInput, label: string): string => {
  const action = escapeHtml(input.action);
  const classes = classAttribute(classTokens(input.extraClass));
  return `<button type="button"${classes} data-ka11y="${action}">${escapeHtml(label)}</button>`;
};

const linkSnippet = (input: SnippetInput, label: string): string => {
  const classes = classAttribute(classTokens(input.extraClass));
  const action = escapeHtml(input.action);
  return `<a href="#ka11y/${action}"${classes} data-ka11y="${action}" role="button">${escapeHtml(label)}</a>`;
};

const shortcodeSnippet = (input: SnippetInput): string => {
  const parts = [`action="${input.action}"`];
  const label = shortcodeLabel(input.label);
  if (label !== '') parts.push(`label="${label}"`);
  if (input.element === 'link') parts.push('element="link"');
  const classes = classTokens(input.extraClass);
  if (classes.length > 0) parts.push(`class="${classes.join(' ')}"`);
  return `[kotlinskidev_a11y_button ${parts.join(' ')}]`;
};

const phpSnippet = (input: SnippetInput): string => {
  const entries = [`'action' => '${escapeQuoted(input.action)}'`];
  const label = cleanLabel(input.label);
  if (label !== '') entries.push(`'label' => '${escapeQuoted(label)}'`);
  if (input.element === 'link') entries.push("'element' => 'link'");
  const classes = classTokens(input.extraClass);
  if (classes.length > 0) entries.push(`'class' => '${escapeQuoted(classes.join(' '))}'`);
  return `<?php kotlinskidev_a11y_button( array( ${entries.join(', ')} ) ); ?>`;
};

const javascriptSnippet = (action: string): string => {
  if (action === 'open' || action === 'close' || action === 'toggle') return `kotlinskidevA11y.${action}();`;
  return `kotlinskidevA11y.toggle('${escapeQuoted(action)}');`;
};

const urlSnippet = (input: SnippetInput): string | null => {
  if (!input.urlActions.includes(actionName(input.action))) return null;
  const base = input.homeUrl === '' ? '/' : input.homeUrl;
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}ka11y=${encodeURIComponent(input.action)}`;
};

export const buildSnippets = (input: SnippetInput): SnippetSet => {
  const label = cleanLabel(input.label);
  return {
    html: htmlSnippet(input, label),
    link: linkSnippet(input, label),
    shortcode: shortcodeSnippet(input),
    php: phpSnippet(input),
    javascript: javascriptSnippet(input.action),
    url: urlSnippet(input),
  };
};

export const composeAction = (base: string, level: number | null): string => (level === null ? base : `${base}:${level}`);
