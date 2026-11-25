import type { FieldContext } from '../context';
import { h, wrapField, markPath } from '../dom';
import type { FieldOptions } from '../dom';

export interface TextOptions extends FieldOptions {
  placeholder?: string;
}

const buildTextField = (ctx: FieldContext, options: TextOptions): HTMLElement => {
  const current = ctx.state.get(options.path);
  const input = h('input', { type: 'text', class: 'regular-text ka11y-text', placeholder: options.placeholder });
  input.value = typeof current === 'string' ? current : '';

  const onInput = (): void => ctx.state.set(options.path, input.value);
  input.addEventListener('input', onInput);

  return wrapField(input, options);
};

export const createTextField = (ctx: FieldContext, options: TextOptions): HTMLElement => markPath(buildTextField(ctx, options), options.path);
