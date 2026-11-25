import { __ } from '@wordpress/i18n';
import type { FormContext } from '../context';
import { estimateCost, formatBytes } from '../cost';
import { fieldset, h } from '../dom';
import { createChecklistField } from '../fields/checklist';
import { createSelectField, enumChoices } from '../fields/select';
import { createToggleField } from '../fields/toggle';
import { fetchPriorityLabel, optOutLabel, pageCssLabel, prefetchLabel, presetLabel, scriptPositionLabel, strategyLabel } from '../labels';

const PRESET_PATH = 'performance.preset';
const PRESET_KEYS: readonly string[] = ['strategy', 'position', 'fetchPriority', 'prefetch', 'pageCss', 'deviceSkip', 'optOut'];
const MANAGED_PRESETS: readonly string[] = ['recommended', 'compatibility'];

const keyPath = (key: string): string => `performance.${key}`;

const sameValue = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);

const matchesPreset = (ctx: FormContext, preset: string): boolean => {
  const row = ctx.schema.presets[preset] ?? {};
  return PRESET_KEYS.every((key) => sameValue(ctx.state.get(keyPath(key)), row[key]));
};

const watched = new WeakSet<FormContext['state']>();

const applyPreset = (ctx: FormContext, preset: string): void => {
  const row = ctx.schema.presets[preset] ?? {};
  for (const key of PRESET_KEYS) ctx.state.set(keyPath(key), row[key]);
};

const watchPreset = (ctx: FormContext): void => {
  if (watched.has(ctx.state)) return;
  watched.add(ctx.state);
  let lastPreset = ctx.state.get(PRESET_PATH);
  let busy = false;

  ctx.state.subscribe(() => {
    if (busy) return;
    const preset = ctx.state.get(PRESET_PATH);
    if (typeof preset !== 'string') return;
    const managed = MANAGED_PRESETS.includes(preset);
    busy = true;
    try {
      if (preset !== lastPreset) {
        lastPreset = preset;
        if (managed) {
          applyPreset(ctx, preset);
          ctx.reload();
        }
      } else if (managed && !matchesPreset(ctx, preset)) {
        lastPreset = 'custom';
        ctx.state.set(PRESET_PATH, 'custom');
        ctx.reload();
      }
    } finally {
      busy = false;
    }
  });
};

const buildCostReadout = (ctx: FormContext): HTMLElement => {
  const onLoad = h('strong', {});
  const onUse = h('strong', {});
  let attached = false;
  let readout: HTMLElement | null = null;
  const render = (): void => {
    if (readout?.isConnected) attached = true;
    else if (attached) {
      unsubscribe();
      return;
    }
    const estimate = estimateCost(ctx.config.cost, ctx.state.snapshot());
    onLoad.textContent = formatBytes(estimate.onLoad);
    onUse.textContent = formatBytes(estimate.onUse);
  };
  const unsubscribe = ctx.state.subscribe(render);
  readout = fieldset(
    __('Cost per page', 'kotlinskidev-accessibility'),
    'ka11y-cost',
    h('p', { class: 'ka11y-cost__line', role: 'status' }, __('Downloaded on every page: ', 'kotlinskidev-accessibility'), onLoad),
    h('p', { class: 'ka11y-cost__line' }, __('Downloaded when a visitor opens the widget: ', 'kotlinskidev-accessibility'), onUse),
    h('p', { class: 'description' }, __('Compressed sizes, estimated from the current settings.', 'kotlinskidev-accessibility'))
  );
  render();
  return readout;
};

export const buildPerformancePanel = (ctx: FormContext): HTMLElement => {
  watchPreset(ctx);

  return h(
    'div',
    { class: 'ka11y-panel ka11y-panel--performance' },
    fieldset(
      __('Preset', 'kotlinskidev-accessibility'),
      'ka11y-preset',
      createSelectField(ctx, {
        path: PRESET_PATH,
        label: __('Performance preset', 'kotlinskidev-accessibility'),
        help: __(
          'Recommended loads the least JavaScript. Compatibility loads everything at once for sites whose optimizers break on-demand loading. Custom lets you set each option.',
          'kotlinskidev-accessibility'
        ),
        choices: enumChoices(ctx, PRESET_PATH, presetLabel),
      })
    ),
    fieldset(
      __('Loading', 'kotlinskidev-accessibility'),
      'ka11y-loading-options',
      createSelectField(ctx, {
        path: keyPath('strategy'),
        label: __('Script loading', 'kotlinskidev-accessibility'),
        choices: enumChoices(ctx, keyPath('strategy'), strategyLabel),
      }),
      createSelectField(ctx, {
        path: keyPath('position'),
        label: __('Script position', 'kotlinskidev-accessibility'),
        choices: enumChoices(ctx, keyPath('position'), scriptPositionLabel),
      }),
      createSelectField(ctx, {
        path: keyPath('fetchPriority'),
        label: __('Fetch priority', 'kotlinskidev-accessibility'),
        choices: enumChoices(ctx, keyPath('fetchPriority'), fetchPriorityLabel),
      }),
      createSelectField(ctx, {
        path: keyPath('prefetch'),
        label: __('Prefetch the panel', 'kotlinskidev-accessibility'),
        choices: enumChoices(ctx, keyPath('prefetch'), prefetchLabel),
      })
    ),
    fieldset(
      __('Styles', 'kotlinskidev-accessibility'),
      'ka11y-styles',
      createSelectField(ctx, {
        path: keyPath('pageCss'),
        label: __('Page adjustment styles', 'kotlinskidev-accessibility'),
        choices: enumChoices(ctx, keyPath('pageCss'), pageCssLabel),
      })
    ),
    fieldset(
      __('Devices', 'kotlinskidev-accessibility'),
      'ka11y-devices',
      createToggleField(ctx, { path: keyPath('deviceSkip'), label: __('Skip downloads on devices where the widget is hidden', 'kotlinskidev-accessibility') })
    ),
    fieldset(
      __('Optimizers', 'kotlinskidev-accessibility'),
      'ka11y-optimizers',
      createChecklistField(ctx, {
        path: keyPath('optOut'),
        label: __('Exclude the widget scripts from', 'kotlinskidev-accessibility'),
        choices: (ctx.schema.definitions[keyPath('optOut')]?.enum ?? []).map((value) => ({ value, label: optOutLabel(value) })),
      })
    ),
    buildCostReadout(ctx)
  );
};
