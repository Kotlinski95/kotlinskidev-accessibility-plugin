import { __, sprintf } from '@wordpress/i18n';
import type { FieldContext, FormContext } from '../context';
import { h } from '../dom';
import { featureGroups, levelLabelKeys } from '../feature-groups';
import type { Choice } from '../fields/select';
import { createSelectField } from '../fields/select';
import { createToggleField } from '../fields/toggle';

export const featureLabel = (ctx: FieldContext, feature: string): string => ctx.config.strings[`features.${feature}.label`] ?? feature;

const defaultChoices = (ctx: FieldContext, feature: string): Choice[] => {
  const keys = levelLabelKeys(feature);
  const off: Choice = { value: false, label: __('Off', 'kotlinskidev-accessibility') };
  if (keys.length === 0) return [off, { value: true, label: __('On', 'kotlinskidev-accessibility') }];
  return [
    off,
    ...keys.map((key, index) => ({
      value: index + 1,
      label: sprintf(__('Level %1$d: %2$s', 'kotlinskidev-accessibility'), index + 1, ctx.config.strings[key] ?? key),
    })),
  ];
};

const buildRow = (ctx: FormContext, feature: string): HTMLElement => {
  const label = featureLabel(ctx, feature);
  return h(
    'tr',
    {},
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
    )
  );
};

export const buildFeaturesPanel = (ctx: FormContext): HTMLElement =>
  h(
    'div',
    { class: 'ka11y-panel ka11y-panel--features' },
    h('p', { class: 'description' }, __('Choose which adjustments visitors can use and which ones start active.', 'kotlinskidev-accessibility')),
    ...featureGroups(ctx.schema.features).map((group) =>
      h(
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
                h('th', { scope: 'col' }, __('Default', 'kotlinskidev-accessibility'))
              )
            ),
            h('tbody', {}, ...group.features.map((feature) => buildRow(ctx, feature)))
          )
        )
      )
    )
  );
