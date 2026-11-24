import type { FieldContext } from '../context';
import { fieldset, h } from '../dom';

export interface ChecklistOptions {
  path: string;
  label: string;
  choices: ReadonlyArray<{ value: string; label: string }>;
}

export const createChecklistField = (ctx: FieldContext, options: ChecklistOptions): HTMLElement => {
  const selected = (): string[] => {
    const value = ctx.state.get(options.path);
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  };

  const rows = options.choices.map((choice) => {
    const input = h('input', { type: 'checkbox', value: choice.value });
    input.checked = selected().includes(choice.value);
    const onChange = (): void => {
      const chosen = new Set(selected());
      if (input.checked) chosen.add(choice.value);
      else chosen.delete(choice.value);
      ctx.state.set(
        options.path,
        options.choices.map((item) => item.value).filter((value) => chosen.has(value))
      );
    };
    input.addEventListener('change', onChange);
    return h('label', { class: 'ka11y-checklist__item' }, input, h('span', {}, choice.label));
  });

  return fieldset(options.label, 'ka11y-checklist', h('div', { class: 'ka11y-checklist__grid' }, ...rows));
};
