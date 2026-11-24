import { __, sprintf } from '@wordpress/i18n';
import type { FormContext } from '../context';
import { h } from '../dom';
import { createChecklistField } from '../fields/checklist';
import { createToggleField } from '../fields/toggle';
import { featureLabel } from './features';

export const buildProfilesPanel = (ctx: FormContext): HTMLElement => {
  const choices = ctx.schema.features.map((feature) => ({ value: feature, label: featureLabel(ctx, feature) }));

  return h(
    'div',
    { class: 'ka11y-panel ka11y-panel--profiles' },
    h('p', { class: 'description' }, __('Profiles switch on a ready-made set of adjustments with one click.', 'kotlinskidev-accessibility')),
    ...ctx.schema.profiles.map((profile) => {
      const name = ctx.config.strings[`profiles.${profile}`] ?? profile;
      return h(
        'section',
        { class: 'ka11y-profile' },
        h('h3', { class: 'ka11y-subheading' }, name),
        createToggleField(ctx, { path: `profiles.${profile}.enabled`, label: sprintf(__('Offer the %s profile', 'kotlinskidev-accessibility'), name) }),
        createChecklistField(ctx, {
          path: `profiles.${profile}.features`,
          label: sprintf(__('Adjustments in the %s profile', 'kotlinskidev-accessibility'), name),
          choices,
        })
      );
    })
  );
};
