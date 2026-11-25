import { __, _n, sprintf } from '@wordpress/i18n';
import { confirmDialog } from './confirm-dialog';
import { h, isRecord } from './dom';
import type { SettingChange } from './types';

export const MAX_PREVIEW_ROWS = 50;
const MAX_VALUE_LENGTH = 120;

export interface PreviewNotes {
  adjusted?: readonly string[];
  locked?: readonly string[];
  dropped?: readonly string[];
}

export interface PreviewOptions {
  title: string;
  message: string;
  confirmLabel: string;
  changes: readonly SettingChange[];
  notes?: PreviewNotes;
}

const truncate = (text: string): string => (text.length > MAX_VALUE_LENGTH ? `${text.slice(0, MAX_VALUE_LENGTH)}…` : text);

export const formatValue = (value: unknown): string => {
  if (typeof value === 'boolean') return value ? __('On', 'kotlinskidev-accessibility') : __('Off', 'kotlinskidev-accessibility');
  if (value === null || value === undefined || value === '') return __('(empty)', 'kotlinskidev-accessibility');
  if (typeof value === 'string') return truncate(value);
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.length === 0 ? __('(none)', 'kotlinskidev-accessibility') : truncate(value.map(String).join(', '));
  if (isRecord(value)) return Object.keys(value).length === 0 ? __('(none)', 'kotlinskidev-accessibility') : truncate(JSON.stringify(value));
  return truncate(String(value));
};

const noteLines = (notes: PreviewNotes): string[] => [
  ...(notes.adjusted !== undefined && notes.adjusted.length > 0
    ? [sprintf(__('Adjusted to a valid value: %s.', 'kotlinskidev-accessibility'), notes.adjusted.join(', '))]
    : []),
  ...(notes.locked !== undefined && notes.locked.length > 0
    ? [sprintf(__('Locked by site configuration and left unchanged: %s.', 'kotlinskidev-accessibility'), notes.locked.join(', '))]
    : []),
  ...(notes.dropped !== undefined && notes.dropped.length > 0
    ? [sprintf(__('Ignored unknown settings: %s.', 'kotlinskidev-accessibility'), notes.dropped.join(', '))]
    : []),
];

export const buildChangeTable = (changes: readonly SettingChange[], notes: PreviewNotes = {}): HTMLElement => {
  const shown = changes.slice(0, MAX_PREVIEW_ROWS);
  const hidden = changes.length - shown.length;
  const rows = shown.map((change) =>
    h('tr', {}, h('th', { scope: 'row' }, h('code', {}, change.path)), h('td', {}, formatValue(change.from)), h('td', {}, formatValue(change.to)))
  );
  const table = h(
    'table',
    { class: 'widefat striped ka11y-changes__table' },
    h('caption', { class: 'screen-reader-text' }, sprintf(_n('%d change', '%d changes', changes.length, 'kotlinskidev-accessibility'), changes.length)),
    h(
      'thead',
      {},
      h(
        'tr',
        {},
        h('th', { scope: 'col' }, __('Setting', 'kotlinskidev-accessibility')),
        h('th', { scope: 'col' }, __('Current', 'kotlinskidev-accessibility')),
        h('th', { scope: 'col' }, __('New', 'kotlinskidev-accessibility'))
      )
    ),
    h('tbody', {}, ...rows)
  );
  const lines = noteLines(notes);
  return h(
    'div',
    { class: 'ka11y-changes', tabindex: 0, role: 'region', 'aria-label': __('Changes', 'kotlinskidev-accessibility') },
    table,
    hidden > 0
      ? h(
          'p',
          { class: 'ka11y-changes__more' },
          sprintf(_n('%d more change is not shown.', '%d more changes are not shown.', hidden, 'kotlinskidev-accessibility'), hidden)
        )
      : null,
    lines.length > 0 ? h('ul', { class: 'ka11y-changes__notes' }, ...lines.map((line) => h('li', {}, line))) : null
  );
};

export const previewChanges = (host: HTMLElement, options: PreviewOptions): Promise<boolean> => {
  if (options.changes.length === 0) return Promise.resolve(true);
  return confirmDialog(host, {
    title: options.title,
    message: options.message,
    confirmLabel: options.confirmLabel,
    content: buildChangeTable(options.changes, options.notes),
  });
};
