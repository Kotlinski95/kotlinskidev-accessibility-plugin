import type { FieldContext } from '../context';
import { h, wrapField } from '../dom';
import type { FieldOptions } from '../dom';

export type ChoiceValue = string | number | boolean;

export interface Choice {
  value: ChoiceValue;
  label: string;
}

export interface SelectOptions extends FieldOptions {
  choices: readonly Choice[];
}

export const enumChoices = (
  ctx: FieldContext,
  path: string,
  labelOf: (value: string) => string
): Choice[] => (ctx.schema.definitions[path]?.enum ?? []).map((value) => ({ value, label: labelOf(value) }));

export const createSelectField = (ctx: FieldContext, options: SelectOptions): HTMLElement => {
  const select = h('select', { class: 'ka11y-select' });
  const current = ctx.state.get(options.path);
  const selectedIndex = Math.max(
    0,
    options.choices.findIndex((choice) => choice.value === current)
  );

  options.choices.forEach((choice, index) => {
    const option = h('option', { value: String(index) }, choice.label);
    option.selected = index === selectedIndex;
    select.append(option);
  });

  const onChange = (): void => {
    const choice = options.choices[Number(select.value)];
    if (choice !== undefined) ctx.state.set(options.path, choice.value);
  };
  select.addEventListener('change', onChange);

  return wrapField(select, options);
};
