import { __ } from '@wordpress/i18n';
import type { FieldContext } from '../context';
import { button, h, uid } from '../dom';
import type { FieldOptions } from '../dom';

const MODIFIER_KEYS = new Set(['Control', 'Alt', 'Shift', 'Meta']);

export const comboFromEvent = (event: KeyboardEvent): string | null => {
  if (MODIFIER_KEYS.has(event.key)) return null;
  const parts: string[] = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey) parts.push('Meta');
  if (parts.length === 0) return null;
  parts.push(event.key.length === 1 ? event.key.toUpperCase() : event.key);
  return parts.join('+');
};

export const createComboField = (ctx: FieldContext, options: FieldOptions): HTMLElement => {
  const id = uid('ka11y-combo');
  const current = ctx.state.get(options.path);
  const display = h('input', { type: 'text', class: 'regular-text ka11y-combo__value', id, readonly: true });
  display.value = typeof current === 'string' ? current : '';
  let recording = false;

  const stop = (): void => {
    recording = false;
    record.textContent = __('Record shortcut', 'kotlinskidev-accessibility');
    record.setAttribute('aria-pressed', 'false');
    display.removeEventListener('keydown', onKeydown);
    display.removeEventListener('blur', onBlur);
  };

  function onKeydown(event: KeyboardEvent): void {
    if (!recording) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      stop();
      record.focus();
      return;
    }
    const combo = comboFromEvent(event);
    event.preventDefault();
    if (combo === null) return;
    display.value = combo;
    ctx.state.set(options.path, combo);
    stop();
    record.focus();
  }

  function onBlur(): void {
    if (recording) stop();
  }

  const onRecord = (): void => {
    if (recording) {
      stop();
      return;
    }
    recording = true;
    record.textContent = __('Press the new combination, or Escape to cancel', 'kotlinskidev-accessibility');
    record.setAttribute('aria-pressed', 'true');
    display.addEventListener('keydown', onKeydown);
    display.addEventListener('blur', onBlur);
    display.focus();
  };

  const record = button(__('Record shortcut', 'kotlinskidev-accessibility'), 'button', onRecord);
  record.setAttribute('aria-pressed', 'false');

  const help = options.help ? h('p', { class: 'description ka11y-field__help', id: `${id}-help` }, options.help) : null;
  if (help) display.setAttribute('aria-describedby', help.id);

  return h(
    'div',
    { class: 'ka11y-field ka11y-field--combo' },
    h('label', { class: 'ka11y-field__label', for: id }, options.label),
    h('div', { class: 'ka11y-combo' }, display, record),
    help
  );
};
