import { __, sprintf } from '@wordpress/i18n';
import type { FieldContext } from '../context';
import { h, markPath, wrapField } from '../dom';
import type { FieldOptions } from '../dom';

const AUTOMATIC = '';

const synth = (): SpeechSynthesis | null => (typeof window.speechSynthesis !== 'undefined' && typeof window.speechSynthesis.getVoices === 'function' ? window.speechSynthesis : null);

const availableVoices = (): readonly SpeechSynthesisVoice[] => synth()?.getVoices() ?? [];

const valueAt = (ctx: FieldContext, path: string): string => {
  const stored = ctx.state.get(path);
  return typeof stored === 'string' ? stored : AUTOMATIC;
};

const choicesFor = (voices: readonly SpeechSynthesisVoice[], current: string): Array<{ value: string; label: string }> => {
  const listed = voices.map((voice) => ({ value: voice.name, label: `${voice.name} (${voice.lang})` }));
  const missing =
    current === AUTOMATIC || listed.some((item) => item.value === current)
      ? []
      : [{ value: current, label: sprintf(__('%s (not installed on this device)', 'kotlinskidev-accessibility'), current) }];
  return [{ value: AUTOMATIC, label: __('Automatic', 'kotlinskidev-accessibility') }, ...listed, ...missing];
};

const buildText = (ctx: FieldContext, path: string): HTMLInputElement => {
  const input = h('input', { type: 'text', class: 'regular-text ka11y-text', placeholder: __('Automatic', 'kotlinskidev-accessibility') });
  input.value = valueAt(ctx, path);
  input.addEventListener('input', () => ctx.state.set(path, input.value));
  return input;
};

const buildSelect = (ctx: FieldContext, path: string): HTMLSelectElement => {
  const select = h('select', { class: 'ka11y-select' });
  const current = valueAt(ctx, path);
  choicesFor(availableVoices(), current).forEach((item) => {
    const option = h('option', { value: item.value }, item.label);
    option.selected = item.value === current;
    select.append(option);
  });
  select.addEventListener('change', () => ctx.state.set(path, select.value));
  return select;
};

const buildControl = (ctx: FieldContext, path: string): HTMLElement => (availableVoices().length > 0 ? buildSelect(ctx, path) : buildText(ctx, path));

const buildVoiceField = (ctx: FieldContext, options: FieldOptions): HTMLElement => {
  let control = buildControl(ctx, options.path);
  const field = wrapField(control, options);
  const onVoicesChanged = (): void => {
    if (control instanceof HTMLSelectElement || availableVoices().length === 0) return;
    const next = buildSelect(ctx, options.path);
    next.id = control.id;
    const described = control.getAttribute('aria-describedby');
    if (described !== null) next.setAttribute('aria-describedby', described);
    control.replaceWith(next);
    control = next;
  };
  synth()?.addEventListener?.('voiceschanged', onVoicesChanged);
  return field;
};

export const createVoiceField = (ctx: FieldContext, options: FieldOptions): HTMLElement => markPath(buildVoiceField(ctx, options), options.path);
