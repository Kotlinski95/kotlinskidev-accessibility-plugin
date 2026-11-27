import { __, sprintf } from '@wordpress/i18n';
import type { FieldContext, FormContext } from '../context';
import { button, fieldset, h } from '../dom';
import type { AdminFeatureGroup } from '../feature-groups';
import { featureGroups, levelLabelKeys } from '../feature-groups';
import type { Choice } from '../fields/select';
import { createSelectField } from '../fields/select';
import { createNumberField } from '../fields/number';
import { createToggleField } from '../fields/toggle';
import { createVoiceField } from '../fields/voice';

export const featureLabel = (ctx: FieldContext, feature: string): string => ctx.config.strings[`features.${feature}.label`] ?? feature;

const defaultChoices = (ctx: FieldContext, feature: string): Choice[] => {
  const keys = levelLabelKeys(feature);
  const off: Choice = {
    value: false,
    label: __('Off', 'kotlinskidev-accessibility'),
  };
  if (keys.length === 0) return [off, { value: true, label: __('On', 'kotlinskidev-accessibility') }];
  return [
    off,
    ...keys.map((key, index) => ({
      value: index + 1,
      label: sprintf(__('Level %1$d: %2$s', 'kotlinskidev-accessibility'), index + 1, ctx.config.strings[key] ?? key),
    })),
  ];
};

export const orderedFeatures = (saved: unknown, defaults: readonly string[]): string[] => {
  const order = Array.isArray(saved) ? saved.filter((item): item is string => typeof item === 'string') : [];
  return [...order.filter((key, index) => defaults.includes(key) && order.indexOf(key) === index), ...defaults.filter((key) => !order.includes(key))];
};

export const moveFeature = (list: readonly string[], feature: string, delta: -1 | 1): string[] => {
  const from = list.indexOf(feature);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= list.length) return [...list];
  const next = [...list];
  next[from] = list[to] as string;
  next[to] = feature;
  return next;
};

interface RowControls {
  label: string;
  position: number;
  total: number;
  onMove: (delta: -1 | 1) => void;
}

const buildMoveButton = (controls: RowControls, delta: -1 | 1): HTMLButtonElement => {
  const isUp = delta === -1;
  const text = isUp ? __('Move up', 'kotlinskidev-accessibility') : __('Move down', 'kotlinskidev-accessibility');
  const move = button(isUp ? '\u2191' : '\u2193', 'button ka11y-order__button', () => controls.onMove(delta));
  move.setAttribute('aria-label', sprintf('%1$s: %2$s', text, controls.label));
  move.dataset.direction = isUp ? 'up' : 'down';
  const atEdge = isUp ? controls.position === 0 : controls.position === controls.total - 1;
  if (atEdge) move.disabled = true;
  return move;
};

const buildRow = (ctx: FormContext, feature: string, controls: RowControls): HTMLElement => {
  const label = featureLabel(ctx, feature);
  return h(
    'tr',
    { 'data-feature': feature },
    h('th', { scope: 'row' }, label),
    h(
      'td',
      {},
      createToggleField(ctx, {
        path: `features.${feature}.enabled`,
        label: sprintf(__('Enable %s', 'kotlinskidev-accessibility'), label),
        bare: true,
      })
    ),
    h(
      'td',
      {},
      createSelectField(ctx, {
        path: `features.${feature}.default`,
        label: sprintf(__('Default state of %s', 'kotlinskidev-accessibility'), label),
        choices: defaultChoices(ctx, feature),
        bare: true,
      })
    ),
    h('td', { class: 'ka11y-order' }, buildMoveButton(controls, -1), buildMoveButton(controls, 1))
  );
};

const buildGroup = (ctx: FormContext, groups: readonly AdminFeatureGroup[], group: AdminFeatureGroup, announcer: HTMLElement): HTMLElement => {
  const body = h('tbody', {});

  const currentOrder = (): string[] => orderedFeatures(ctx.state.get('panel.order'), group.features);

  const commit = (feature: string, delta: -1 | 1): void => {
    const list = currentOrder();
    const next = moveFeature(list, feature, delta);
    if (next.join() === list.join()) return;
    const saved = ctx.state.get('panel.order');
    ctx.state.set(
      'panel.order',
      groups.flatMap((other) => (other.id === group.id ? next : orderedFeatures(saved, other.features)))
    );
    render();
    const position = next.indexOf(feature);
    announcer.textContent = sprintf(__('%1$s moved to position %2$d of %3$d.', 'kotlinskidev-accessibility'), featureLabel(ctx, feature), position + 1, next.length);
    const row = body.querySelector(`tr[data-feature="${feature}"]`);
    const preferred = row?.querySelector<HTMLButtonElement>(`button[data-direction="${delta === -1 ? 'up' : 'down'}"]`);
    const fallback = row?.querySelector<HTMLButtonElement>(`button[data-direction="${delta === -1 ? 'down' : 'up'}"]`);
    (preferred && !preferred.disabled ? preferred : fallback)?.focus();
  };

  const render = (): void => {
    const list = currentOrder();
    body.replaceChildren(
      ...list.map((feature, position) =>
        buildRow(ctx, feature, {
          label: featureLabel(ctx, feature),
          position,
          total: list.length,
          onMove: (delta) => commit(feature, delta),
        })
      )
    );
  };
  render();

  return h(
    'section',
    { class: 'ka11y-feature-group' },
    h('h3', { class: 'ka11y-subheading' }, group.label),
    h(
      'div',
      { class: 'ka11y-table-wrap' },
      h(
        'table',
        { class: 'widefat striped ka11y-matrix__table' },
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            h('th', { scope: 'col' }, __('Feature', 'kotlinskidev-accessibility')),
            h('th', { scope: 'col' }, __('Enabled', 'kotlinskidev-accessibility')),
            h('th', { scope: 'col' }, __('Default', 'kotlinskidev-accessibility')),
            h('th', { scope: 'col' }, __('Order', 'kotlinskidev-accessibility'))
          )
        ),
        body
      )
    )
  );
};

const buildReadPageSettings = (ctx: FormContext): HTMLElement =>
  fieldset(
    sprintf(__('%s settings', 'kotlinskidev-accessibility'), featureLabel(ctx, 'readPage')),
    'ka11y-read-page',
    createVoiceField(ctx, {
      path: 'readPage.voice',
      label: __('Voice', 'kotlinskidev-accessibility'),
      help: __('Automatic picks the best voice for the page language. The list shows the voices installed on this device; visitors have their own voices, so a name that is missing for them falls back to automatic.', 'kotlinskidev-accessibility'),
    }),
    createNumberField(ctx, {
      path: 'readPage.rate',
      label: __('Speaking speed', 'kotlinskidev-accessibility'),
      help: __('From 0.5 (slow) to 2 (fast). 1 is the normal speed.', 'kotlinskidev-accessibility'),
      decimal: true,
      step: 0.1,
    })
  );

export const buildFeaturesPanel = (ctx: FormContext): HTMLElement => {
  const groups = featureGroups(ctx.schema.features);
  const announcer = h('p', {
    class: 'screen-reader-text',
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': 'true',
  });
  return h(
    'div',
    { class: 'ka11y-panel ka11y-panel--features' },
    h(
      'p',
      { class: 'description' },
      __('Choose which adjustments visitors can use, which ones start active, and the order they appear in within each section.', 'kotlinskidev-accessibility')
    ),
    announcer,
    ...groups.map((group) => buildGroup(ctx, groups, group, announcer)),
    buildReadPageSettings(ctx)
  );
};
