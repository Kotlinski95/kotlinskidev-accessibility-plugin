import { __, sprintf } from '@wordpress/i18n';
import type { FieldContext } from '../context';
import { pairsFor, formatRatio } from '../contrast';
import type { ContrastReading } from '../contrast';
import { h, isRecord, uid } from '../dom';
import type { FieldOptions } from '../dom';
import { tokenLabel } from '../labels';

const COLOR_PATTERN = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const PICKER_PATTERN = /^#[0-9a-f]{6}$/i;

export const isColor = (value: string): boolean => COLOR_PATTERN.test(value);

export interface ColorFieldOptions extends FieldOptions {
  token?: string;
}

const describeReading = (token: string, reading: ContrastReading): string => {
  const other = reading.foreground === token ? reading.background : reading.foreground;
  const verdict = reading.pass ? __('passes', 'kotlinskidev-accessibility') : __('fails', 'kotlinskidev-accessibility');
  if (reading.ratio === null) return sprintf(__('%s: enter a valid color to check contrast.', 'kotlinskidev-accessibility'), tokenLabel(other));
  return sprintf(
    __('%1$s:1 against %2$s, %3$s the %4$s:1 minimum', 'kotlinskidev-accessibility'),
    formatRatio(reading.ratio),
    tokenLabel(other),
    verdict,
    String(reading.minimum)
  );
};

const createContrastBadge = (ctx: FieldContext, token: string): HTMLElement => {
  const badge = h('span', { class: 'ka11y-contrast' });
  let attached = false;
  const render = (): void => {
    if (badge.isConnected) attached = true;
    else if (attached) {
      unsubscribe();
      return;
    }
    const tokens = ctx.state.get('tokens');
    const readings = pairsFor(token, isRecord(tokens) ? tokens : {});
    badge.replaceChildren(
      ...readings.map((reading) =>
        h('span', { class: 'ka11y-contrast__item', 'data-state': reading.ratio === null ? 'unknown' : reading.pass ? 'pass' : 'fail' }, describeReading(token, reading))
      )
    );
  };
  const unsubscribe = ctx.state.subscribe(render);
  render();
  return badge;
};

export const createColorField = (ctx: FieldContext, options: ColorFieldOptions): HTMLElement => {
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
  const badge = options.token ? createContrastBadge(ctx, options.token) : null;
  if (badge) badge.id = `${id}-contrast`;
  const described = [help?.id, badge?.id].filter((value): value is string => value !== undefined);
  if (described.length > 0) text.setAttribute('aria-describedby', described.join(' '));

  return h(
    'div',
    { class: 'ka11y-field ka11y-field--color' },
    h('label', { class: 'ka11y-field__label', for: id }, options.label),
    h('span', { class: 'ka11y-color' }, picker, text),
    badge,
    help
  );
};
