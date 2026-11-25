import type { FieldContext } from '../context';
import { h, wrapField, markPath } from '../dom';
import type { FieldOptions } from '../dom';

export interface TextareaOptions extends FieldOptions {
  rows?: number;
  code?: boolean;
}

const buildTextareaField = (ctx: FieldContext, options: TextareaOptions): HTMLElement => {
  const current = ctx.state.get(options.path);
  const textarea = h('textarea', {
    class: options.code === true ? 'large-text code ka11y-textarea' : 'large-text ka11y-textarea',
    rows: options.rows ?? 6,
    spellcheck: options.code === true ? 'false' : undefined,
  });
  textarea.value = typeof current === 'string' ? current : '';

  const onInput = (): void => ctx.state.set(options.path, textarea.value);
  textarea.addEventListener('input', onInput);

  return wrapField(textarea, options);
};

export const createTextareaField = (ctx: FieldContext, options: TextareaOptions): HTMLElement => markPath(buildTextareaField(ctx, options), options.path);
