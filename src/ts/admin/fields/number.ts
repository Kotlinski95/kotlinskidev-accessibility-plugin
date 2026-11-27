import type { FieldContext } from '../context';
import { h, wrapField, markPath } from '../dom';
import type { FieldOptions } from '../dom';

export interface NumberOptions extends FieldOptions {
  decimal?: boolean;
  step?: number;
  placeholder?: string;
}

const buildNumberField = (ctx: FieldContext, options: NumberOptions): HTMLElement => {
  const definition = ctx.schema.definitions[options.path];
  const current = ctx.state.get(options.path);
  const decimal = options.decimal === true;
  const input = h('input', {
    type: 'number',
    class: 'small-text ka11y-number',
    inputmode: decimal ? 'decimal' : 'numeric',
    min: definition?.min,
    max: definition?.max,
    step: options.step ?? 1,
    placeholder: options.placeholder,
  });
  input.value = typeof current === 'number' ? String(current) : '';

  const onInput = (): void => {
    if (input.value.trim() === '') {
      if (definition?.nullable === true) ctx.state.set(options.path, '');
      return;
    }
    const value = Number(input.value);
    if (Number.isFinite(value)) ctx.state.set(options.path, decimal ? value : Math.trunc(value));
  };
  input.addEventListener('input', onInput);

  return wrapField(input, options);
};

export const createNumberField = (ctx: FieldContext, options: NumberOptions): HTMLElement => markPath(buildNumberField(ctx, options), options.path);
