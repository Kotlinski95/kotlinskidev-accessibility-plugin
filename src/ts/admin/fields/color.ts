import type { FieldContext } from '../context';
import { h, uid } from '../dom';
import type { FieldOptions } from '../dom';

const COLOR_PATTERN = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const PICKER_PATTERN = /^#[0-9a-f]{6}$/i;

export const isColor = (value: string): boolean => COLOR_PATTERN.test(value);

export const createColorField = (ctx: FieldContext, options: FieldOptions): HTMLElement => {
  const current = ctx.state.get(options.path);
  const initial = typeof current === 'string' ? current : '';
  const picker = h('input', { type: 'color', class: 'ka11y-color__picker', tabindex: -1, 'aria-hidden': 'true' });
  const text = h('input', { type: 'text', class: 'ka11y-color__text', maxlength: 9, spellcheck: 'false' });
  text.value = initial;
  if (PICKER_PATTERN.test(initial)) picker.value = initial.toLowerCase();

  const onPickerInput = (): void => {
    text.value = picker.value;
    text.removeAttribute('aria-invalid');
    ctx.state.set(options.path, picker.value);
  };
  const onTextInput = (): void => {
    const value = text.value.trim();
    if (!isColor(value)) {
      text.setAttribute('aria-invalid', 'true');
      return;
    }
    text.removeAttribute('aria-invalid');
    if (PICKER_PATTERN.test(value)) picker.value = value.toLowerCase();
    ctx.state.set(options.path, value);
  };
  picker.addEventListener('input', onPickerInput);
  text.addEventListener('input', onTextInput);

  const id = uid('ka11y-color');
  text.id = id;
  if (options.bare === true) {
    text.setAttribute('aria-label', options.label);
    return h('span', { class: 'ka11y-color' }, picker, text);
  }
  const help = options.help ? h('p', { class: 'description ka11y-field__help', id: `${id}-help` }, options.help) : null;
  if (help) text.setAttribute('aria-describedby', help.id);

  return h(
    'div',
    { class: 'ka11y-field ka11y-field--color' },
    h('label', { class: 'ka11y-field__label', for: id }, options.label),
    h('span', { class: 'ka11y-color' }, picker, text),
    help
  );
};
