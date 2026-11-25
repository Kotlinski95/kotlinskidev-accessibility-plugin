import type { FieldContext } from '../context';
import { h, uid, markPath } from '../dom';
import type { FieldOptions } from '../dom';

const buildToggleField = (ctx: FieldContext, options: FieldOptions): HTMLElement => {
  const input = h('input', { type: 'checkbox', class: 'ka11y-toggle__input' });
  input.checked = ctx.state.get(options.path) === true;

  const onChange = (): void => ctx.state.set(options.path, input.checked);
  input.addEventListener('change', onChange);

  if (options.bare === true) {
    input.setAttribute('aria-label', options.label);
    return input;
  }

  const id = uid('ka11y-toggle');
  input.id = id;
  const help = options.help ? h('p', { class: 'description ka11y-field__help', id: `${id}-help` }, options.help) : null;
  if (help) input.setAttribute('aria-describedby', help.id);

  return h(
    'div',
    { class: 'ka11y-field ka11y-field--toggle' },
    h('label', { class: 'ka11y-toggle', for: id }, input, h('span', { class: 'ka11y-toggle__label' }, options.label)),
    help
  );
};

export const createToggleField = (ctx: FieldContext, options: FieldOptions): HTMLElement => markPath(buildToggleField(ctx, options), options.path);
