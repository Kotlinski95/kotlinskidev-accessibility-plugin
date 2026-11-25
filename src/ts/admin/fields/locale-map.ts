import { __ } from '@wordpress/i18n';
import type { FieldContext } from '../context';
import { h, isRecord, uid, markPath } from '../dom';
import { createTabs } from '../tabs';

export interface LocaleMapOptions {
  path: string;
  label: string;
  mode: 'strings' | 'document';
  keys?: readonly string[];
  defaults?: Readonly<Record<string, string>>;
}

const readOverrides = (ctx: FieldContext, path: string): Record<string, string> => {
  const value = ctx.state.get(path);
  if (!isRecord(value)) return {};
  const entries = Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
  return Object.fromEntries(entries);
};

const buildStringsPanel = (ctx: FieldContext, options: LocaleMapOptions, locale: string): HTMLElement => {
  const path = `${options.path}.${locale}`;
  const overrides = readOverrides(ctx, path);
  const defaults = options.defaults ?? {};
  const filterId = uid('ka11y-filter');
  const filter = h('input', { type: 'search', class: 'regular-text ka11y-locale__filter', id: filterId });
  const rows = (options.keys ?? []).map((key) => {
    const inputId = uid('ka11y-label');
    const input = h('input', { type: 'text', class: 'large-text ka11y-locale__input', id: inputId, placeholder: defaults[key] ?? '' });
    input.value = overrides[key] ?? '';
    const onInput = (): void => ctx.state.set(path, { ...readOverrides(ctx, path), [key]: input.value });
    input.addEventListener('input', onInput);
    const row = h(
      'div',
      { class: 'ka11y-locale__row' },
      h('label', { class: 'ka11y-locale__key', for: inputId }, key),
      input
    );
    row.dataset.search = `${key} ${defaults[key] ?? ''}`.toLowerCase();
    return row;
  });

  const onFilter = (): void => {
    const needle = filter.value.trim().toLowerCase();
    for (const row of rows) row.hidden = needle !== '' && !(row.dataset.search ?? '').includes(needle);
  };
  filter.addEventListener('input', onFilter);

  return h(
    'div',
    { class: 'ka11y-locale__panel' },
    h('label', { class: 'ka11y-field__label', for: filterId }, __('Filter labels', 'kotlinskidev-accessibility')),
    filter,
    h('div', { class: 'ka11y-locale__rows' }, ...rows)
  );
};

const buildDocumentPanel = (ctx: FieldContext, options: LocaleMapOptions, locale: string): HTMLElement => {
  const path = `${options.path}.${locale}`;
  const id = uid('ka11y-doc');
  const current = ctx.state.get(path);
  const textarea = h('textarea', { class: 'large-text ka11y-textarea', id, rows: 10 });
  textarea.value = typeof current === 'string' ? current : '';
  const onInput = (): void => ctx.state.set(path, textarea.value);
  textarea.addEventListener('input', onInput);

  return h('div', { class: 'ka11y-locale__panel' }, h('label', { class: 'ka11y-field__label', for: id }, options.label), textarea);
};

const buildLocaleMapField = (ctx: FieldContext, options: LocaleMapOptions): HTMLElement => {
  const locales = ctx.config.locales;
  const specs = locales.map((locale) => ({
    id: locale.code,
    label: locale.name === locale.code ? locale.code : `${locale.name} (${locale.code})`,
    panel: options.mode === 'strings' ? buildStringsPanel(ctx, options, locale.code) : buildDocumentPanel(ctx, options, locale.code),
  }));

  return h(
    'div',
    { class: 'ka11y-field ka11y-field--locale-map' },
    h('h3', { class: 'ka11y-subheading' }, options.label),
    createTabs(specs, { label: options.label }).element
  );
};

export const createLocaleMapField = (ctx: FieldContext, options: LocaleMapOptions): HTMLElement => markPath(buildLocaleMapField(ctx, options), options.path);
