import type { FieldContext } from '../context';
import { h, wrapField, markPath } from '../dom';
import type { FieldOptions } from '../dom';

const buildNumberField = (ctx: FieldContext, options: FieldOptions): HTMLElement => {
  const definition = ctx.schema.definitions[options.path];
  const current = ctx.state.get(options.path);
  const input = h('input', {
    type: 'number',
    class: 'small-text ka11y-number',
    inputmode: 'numeric',
    min: definition?.min,
    max: definition?.max,
    step: 1,
  });
  input.value = typeof current === 'number' ? String(current) : '';

  const onInput = (): void => {
    if (input.value.trim() === '') return;
    const value = Number(input.value);
    if (Number.isFinite(value)) ctx.state.set(options.path, Math.trunc(value));
  };
  input.addEventListener('input', onInput);

  return wrapField(input, options);
};

export const createNumberField = (ctx: FieldContext, options: FieldOptions): HTMLElement => markPath(buildNumberField(ctx, options), options.path);
