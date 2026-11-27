import type { FieldContext } from '../context';
import { h, markPath, uid } from '../dom';
import type { FieldOptions } from '../dom';

export interface LauncherVisibilityOptions extends FieldOptions {
  inlineHelp: string;
}

const buildLauncherVisibility = (ctx: FieldContext, options: LauncherVisibilityOptions): HTMLElement => {
  const id = uid('ka11y-toggle');
  const input = h('input', { type: 'checkbox', class: 'ka11y-toggle__input', id });
  const note = h('p', { class: 'description ka11y-field__help', id: `${id}-help` }, options.help);
  input.setAttribute('aria-describedby', note.id);

  const render = (): void => {
    const mode = ctx.state.get(options.path);
    input.checked = mode === 'floating';
    note.textContent = mode === 'inline' ? options.inlineHelp : (options.help ?? '');
  };

  input.addEventListener('change', () => ctx.state.set(options.path, input.checked ? 'floating' : 'hidden'));
  ctx.state.subscribe(render);
  render();

  return h('div', { class: 'ka11y-field ka11y-field--toggle' }, h('label', { class: 'ka11y-toggle', for: id }, input, h('span', { class: 'ka11y-toggle__label' }, options.label)), note);
};

export const createLauncherVisibilityField = (ctx: FieldContext, options: LauncherVisibilityOptions): HTMLElement => markPath(buildLauncherVisibility(ctx, options), options.path);
