import { __, sprintf } from '@wordpress/i18n';
import type { FieldContext } from '../context';
import { pairsFor, formatRatio } from '../contrast';
import type { ContrastReading } from '../contrast';
import { h, isRecord, uid, markPath } from '../dom';
import type { FieldOptions } from '../dom';
import { tokenLabel } from '../labels';
import { formatThemeReference, parseThemeReference, themePaletteOf } from '../theme-color';

const COLOR_PATTERN = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const PICKER_PATTERN = /^#[0-9a-f]{6}$/i;

export const isColor = (value: string): boolean => COLOR_PATTERN.test(value);

export interface ColorFieldOptions extends FieldOptions {
  token?: string;
  allowEmpty?: boolean;
}

const isLinked = (tokens: Readonly<Record<string, unknown>>, key: string): boolean => parseThemeReference(tokens[key]) !== null;

const describeReading = (token: string, reading: ContrastReading, approximate: boolean): string => {
  const other = reading.foreground === token ? reading.background : reading.foreground;
  const verdict = reading.pass ? __('passes', 'kotlinskidev-accessibility') : __('fails', 'kotlinskidev-accessibility');
  if (reading.ratio === null) return sprintf(__('%s: enter a valid color to check contrast.', 'kotlinskidev-accessibility'), tokenLabel(other));
  const text = sprintf(
    __('%1$s:1 against %2$s, %3$s the %4$s:1 minimum', 'kotlinskidev-accessibility'),
    formatRatio(reading.ratio),
    tokenLabel(other),
    verdict,
    String(reading.minimum)
  );
  return approximate ? `${text} ${__('(approximate: uses the fallback color of a theme color)', 'kotlinskidev-accessibility')}` : text;
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
    const map = isRecord(tokens) ? tokens : {};
    const readings = pairsFor(token, map);
    badge.replaceChildren(
      ...readings.map((reading) =>
        h(
          'span',
          {
            class: 'ka11y-contrast__item',
            'data-state': reading.ratio === null ? 'unknown' : reading.pass ? 'pass' : 'fail',
          },
          describeReading(token, reading, isLinked(map, reading.foreground) || isLinked(map, reading.background))
        )
      )
    );
  };
  const unsubscribe = ctx.state.subscribe(render);
  render();
  return badge;
};

const buildColorField = (ctx: FieldContext, options: ColorFieldOptions): HTMLElement => {
  const current = ctx.state.get(options.path);
  const initial = typeof current === 'string' ? current : '';
  const picker = h('input', {
    type: 'color',
    class: 'ka11y-color__picker',
    tabindex: -1,
    'aria-hidden': 'true',
  });
  const text = h('input', {
    type: 'text',
    class: 'ka11y-color__text',
    maxlength: 9,
    spellcheck: 'false',
  });
  const palette = options.bare === true ? [] : themePaletteOf(ctx.config);
  const linked = parseThemeReference(initial);
  const themeSelect = palette.length > 0 ? h('select', { class: 'ka11y-color__theme' }) : null;
  const themeBadge = h('span', { class: 'ka11y-color__linked' });
  const fallbackOf = (slug: string, fallback: string): string => (fallback !== '' ? fallback : (palette.find((item) => item.slug === slug)?.color ?? ''));
  const display = linked === null ? initial : fallbackOf(linked.slug, linked.fallback);
  text.value = display;
  if (PICKER_PATTERN.test(display)) picker.value = display.toLowerCase();

  const syncTheme = (value: string): void => {
    const reference = parseThemeReference(value);
    if (themeSelect !== null) themeSelect.value = reference === null ? '' : reference.slug;
    const name = reference === null ? '' : (palette.find((item) => item.slug === reference.slug)?.name ?? reference.slug);
    themeBadge.textContent = reference === null ? '' : sprintf(__('Linked to theme color: %s', 'kotlinskidev-accessibility'), name);
    themeBadge.hidden = reference === null;
  };

  if (themeSelect !== null) {
    themeSelect.append(h('option', { value: '' }, __('Custom color', 'kotlinskidev-accessibility')));
    if (linked !== null && !palette.some((item) => item.slug === linked.slug)) themeSelect.append(h('option', { value: linked.slug }, linked.slug));
    palette.forEach((item) => themeSelect.append(h('option', { value: item.slug }, `${item.name} (${item.color})`)));
    themeSelect.addEventListener('change', () => {
      const chosen = palette.find((item) => item.slug === themeSelect.value);
      if (chosen === undefined) {
        const custom = text.value.trim();
        if (isColor(custom)) ctx.state.set(options.path, custom);
        syncTheme(isColor(custom) ? custom : '');
        return;
      }
      text.value = chosen.color;
      text.removeAttribute('aria-invalid');
      if (PICKER_PATTERN.test(chosen.color)) picker.value = chosen.color.toLowerCase();
      const reference = formatThemeReference(chosen.slug, chosen.color);
      ctx.state.set(options.path, reference);
      syncTheme(reference);
    });
  }

  const onPickerInput = (): void => {
    text.value = picker.value;
    text.removeAttribute('aria-invalid');
    ctx.state.set(options.path, picker.value);
    syncTheme(picker.value);
  };
  const onTextInput = (): void => {
    const value = text.value.trim();
    if (value === '' && options.allowEmpty === true) {
      text.removeAttribute('aria-invalid');
      ctx.state.set(options.path, '');
      syncTheme('');
      return;
    }
    if (!isColor(value)) {
      text.setAttribute('aria-invalid', 'true');
      return;
    }
    text.removeAttribute('aria-invalid');
    if (PICKER_PATTERN.test(value)) picker.value = value.toLowerCase();
    ctx.state.set(options.path, value);
    syncTheme(value);
  };
  picker.addEventListener('input', onPickerInput);
  text.addEventListener('input', onTextInput);

  syncTheme(initial);

  const id = uid('ka11y-color');
  text.id = id;
  if (themeSelect !== null) {
    themeSelect.id = `${id}-theme`;
    themeSelect.setAttribute('aria-label', sprintf(__('%s: from theme', 'kotlinskidev-accessibility'), options.label));
  }
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
    h('span', { class: 'ka11y-color' }, picker, text, themeSelect, themeBadge),
    badge,
    help
  );
};

export const createColorField = (ctx: FieldContext, options: ColorFieldOptions): HTMLElement => markPath(buildColorField(ctx, options), options.path);
