import { __ } from '@wordpress/i18n';
import type { FormContext } from './context';
import { isCustomerMode, pruneToEditable } from './access';
import { applyLockedState } from './locks';
import { buildTabReset } from './tab-reset';
import { createTabs } from './tabs';
import type { TabSpec, TabsApi } from './tabs';
import { buildAppearancePanel } from './panels/appearance';
import { buildBehaviorPanel } from './panels/behavior';
import { buildFeaturesPanel } from './panels/features';
import { buildGeneralPanel } from './panels/general';
import { buildImportExportPanel } from './panels/import-export';
import { buildMaintenancePanel } from './panels/maintenance';
import { buildLanguagesPanel } from './panels/languages';
import { buildPerformancePanel } from './panels/performance';
import { buildProfilesPanel } from './panels/profiles';
import { buildTriggersPanel } from './panels/triggers';
import { buildVisibilityPanel } from './panels/visibility';

export interface PanelSpec {
  id: string;
  label: string;
  build: (ctx: FormContext) => HTMLElement;
  resetPaths?: string[];
  customer?: boolean;
}

export const panelSpecs = (): PanelSpec[] => [
  {
    id: 'general',
    label: __('General', 'kotlinskidev-accessibility'),
    build: buildGeneralPanel,
    resetPaths: [
      'widget.position',
      'widget.offsetX',
      'widget.offsetY',
      'widget.size',
      'widget.sizes',
      'widget.shape',
      'widget.bg',
      'widget.fg',
      'widget.bgDark',
      'widget.fgDark',
      'widget.icon',
      'widget.iconBorder',
    ],
  },
  {
    id: 'features',
    label: __('Features', 'kotlinskidev-accessibility'),
    build: buildFeaturesPanel,
    resetPaths: ['features', 'panel.order'],
  },
  {
    id: 'profiles',
    label: __('Profiles', 'kotlinskidev-accessibility'),
    build: buildProfilesPanel,
    resetPaths: ['profiles'],
  },
  {
    id: 'visibility',
    label: __('Visibility', 'kotlinskidev-accessibility'),
    build: buildVisibilityPanel,
    resetPaths: ['visibility'],
  },
  {
    id: 'appearance',
    label: __('Appearance', 'kotlinskidev-accessibility'),
    build: buildAppearancePanel,
    resetPaths: ['theme', 'tokens', 'panel', 'customCss'],
    customer: true,
  },
  {
    id: 'languages',
    label: __('Languages', 'kotlinskidev-accessibility'),
    build: buildLanguagesPanel,
    resetPaths: ['labels', 'statement'],
    customer: true,
  },
  {
    id: 'behavior',
    label: __('Behavior', 'kotlinskidev-accessibility'),
    build: buildBehaviorPanel,
    resetPaths: ['storage', 'shortcut', 'hideToolbar', 'advanced'],
  },
  {
    id: 'triggers',
    label: __('Triggers', 'kotlinskidev-accessibility'),
    build: buildTriggersPanel,
    resetPaths: ['triggers', 'widget.launcher', 'widget.mount'],
  },
  {
    id: 'performance',
    label: __('Performance', 'kotlinskidev-accessibility'),
    build: buildPerformancePanel,
    resetPaths: ['performance'],
  },
  {
    id: 'maintenance',
    label: __('Maintenance', 'kotlinskidev-accessibility'),
    build: buildMaintenancePanel,
    resetPaths: ['maintenance'],
  },
  {
    id: 'import-export',
    label: __('Import / Export', 'kotlinskidev-accessibility'),
    build: buildImportExportPanel,
  },
];

export interface RenderOptions {
  initial?: string;
  onSelect?: (id: string) => void;
}

const buildPanel = (ctx: FormContext, spec: PanelSpec): HTMLElement | null => {
  const panel = spec.build(ctx);
  panel.dataset.ka11yTab = spec.id;
  if (isCustomerMode(ctx.schema)) return pruneToEditable(panel, ctx.schema) ? panel : null;
  if (spec.resetPaths !== undefined) panel.append(buildTabReset(ctx, spec.label, spec.resetPaths));
  return panel;
};

const visibleTabs = (ctx: FormContext): TabSpec[] =>
  panelSpecs()
    .filter((spec) => !isCustomerMode(ctx.schema) || spec.customer === true)
    .flatMap((spec) => {
      const panel = buildPanel(ctx, spec);
      return panel === null ? [] : [{ id: spec.id, label: spec.label, panel }];
    });

export const renderForm = (ctx: FormContext, options: RenderOptions = {}): TabsApi => {
  const tabs = createTabs(visibleTabs(ctx), {
    label: __('Accessibility settings sections', 'kotlinskidev-accessibility'),
    initial: options.initial,
    onSelect: options.onSelect,
  });
  applyLockedState(tabs.element, ctx.locked);
  return tabs;
};
