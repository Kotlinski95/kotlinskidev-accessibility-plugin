import { __, sprintf } from '@wordpress/i18n';
import type { FieldContext } from '../context';
import { button, h, uid } from '../dom';
import type { FieldOptions } from '../dom';

export interface TextListOptions extends FieldOptions {
  numeric?: boolean;
  placeholder?: string;
}

const readItems = (ctx: FieldContext, path: string): Array<string | number> => {
  const value = ctx.state.get(path);
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string | number => typeof item === 'string' || typeof item === 'number');
};

const parseItem = (raw: string, numeric: boolean): string | number | null => {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (!numeric) return trimmed;
  const value = Number(trimmed);
  return Number.isInteger(value) && value > 0 ? value : null;
};

export const createTextListField = (ctx: FieldContext, options: TextListOptions): HTMLElement => {
  const numeric = options.numeric === true;
  const id = uid('ka11y-list');
  const list = h('ul', { class: 'ka11y-list__items' });
  const input = h('input', {
    type: 'text',
    class: 'regular-text ka11y-list__input',
    id,
    inputmode: numeric ? 'numeric' : undefined,
    placeholder: options.placeholder,
  });
  const help = options.help ? h('p', { class: 'description ka11y-field__help', id: `${id}-help` }, options.help) : null;
  if (help) input.setAttribute('aria-describedby', help.id);

  const renderItems = (): void => {
    list.replaceChildren(
      ...readItems(ctx, options.path).map((item, index) => {
        const label = String(item);
        const onRemove = (): void => {
          ctx.state.set(
            options.path,
            readItems(ctx, options.path).filter((_, position) => position !== index)
          );
          renderItems();
          input.focus();
        };
        const remove = button(__('Remove', 'kotlinskidev-accessibility'), 'button-link ka11y-list__remove', onRemove);
        remove.setAttribute('aria-label', sprintf(__('Remove %s', 'kotlinskidev-accessibility'), label));
        return h('li', { class: 'ka11y-list__item' }, h('span', { class: 'ka11y-list__value' }, label), remove);
      })
    );
  };

  const onAdd = (): void => {
    const item = parseItem(input.value, numeric);
    if (item === null) {
      input.setAttribute('aria-invalid', input.value.trim() === '' ? 'false' : 'true');
      return;
    }
    input.removeAttribute('aria-invalid');
    const items = readItems(ctx, options.path);
    if (!items.includes(item)) ctx.state.set(options.path, [...items, item]);
    input.value = '';
    renderItems();
    input.focus();
  };

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    onAdd();
  };
  input.addEventListener('keydown', onKeydown);

  renderItems();

  return h(
    'div',
    { class: 'ka11y-field ka11y-field--list' },
    h('label', { class: 'ka11y-field__label', for: id }, options.label),
    h('div', { class: 'ka11y-list__add' }, input, button(__('Add', 'kotlinskidev-accessibility'), 'button', onAdd)),
    list,
    help
  );
};
