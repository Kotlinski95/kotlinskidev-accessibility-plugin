import { createElement } from '../dom';
import { FEATURE_LEVEL_LABELS, levelCountOf } from '../feature-groups';
import type { Control, PanelContext } from './context';
import { iconChildren } from './icons';
import { numericLevel } from './tile';

export const STEPPER_FEATURES: ReadonlySet<string> = new Set(['biggerText', 'lineHeight']);

export const buildStepper = (ctx: PanelContext, key: string): Control => {
  const { doc, t, store } = ctx;
  const label = t(`features.${key}.label`);
  const labelId = `ka11y-step-${key}`;
  const max = levelCountOf(key);
  const value = createElement(doc, 'output', { class: 'ka11y-stepper__value', 'aria-live': 'polite' });
  const stepButton = (delta: -1 | 1, iconName: string, textKey: string): HTMLButtonElement =>
    createElement(
      doc,
      'button',
      { type: 'button', class: 'ka11y-step', 'data-step': String(delta), 'aria-label': t.format(textKey, label), 'aria-disabled': 'false' },
      iconChildren(ctx.icon(iconName))
    );
  const minus = stepButton(-1, 'minus', 'stepDecrease');
  const plus = stepButton(1, 'plus', 'stepIncrease');
  const group = createElement(doc, 'div', { class: 'ka11y-stepper', role: 'group', 'aria-labelledby': labelId, 'data-feature': key }, [
    createElement(doc, 'span', { id: labelId, class: 'ka11y-stepper__label' }, [label]),
    createElement(doc, 'div', { class: 'ka11y-stepper__row' }, [minus, value, plus]),
  ]);
  const bind = (button: HTMLButtonElement, delta: number): void => {
    const onStep = (): void => {
      if (button.getAttribute('aria-disabled') === 'true') return;
      store.setLevel(key, numericLevel(store.getState().levels[key]) + delta);
    };
    ctx.listen(button, 'click', onStep);
  };
  bind(minus, -1);
  bind(plus, 1);
  return {
    nodes: [group],
    update: (state) => {
      const level = Math.min(Math.max(numericLevel(state.levels[key]), 0), max);
      value.textContent = level === 0 ? t('levelDefault') : t(FEATURE_LEVEL_LABELS[key]?.[level - 1] ?? 'levelOn');
      group.dataset.level = String(level);
      minus.setAttribute('aria-disabled', String(level <= 0));
      plus.setAttribute('aria-disabled', String(level >= max));
    },
  };
};
