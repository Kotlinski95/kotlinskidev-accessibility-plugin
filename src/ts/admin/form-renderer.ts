import { __ } from '@wordpress/i18n';
import type { FormContext } from './context';
import { createTabs } from './tabs';
import type { TabsApi } from './tabs';
import { buildAppearancePanel } from './panels/appearance';
import { buildBehaviorPanel } from './panels/behavior';
import { buildFeaturesPanel } from './panels/features';
import { buildGeneralPanel } from './panels/general';
import { buildImportExportPanel } from './panels/import-export';
import { buildLanguagesPanel } from './panels/languages';
import { buildProfilesPanel } from './panels/profiles';
import { buildVisibilityPanel } from './panels/visibility';

export interface PanelSpec {
  id: string;
  label: string;
  build: (ctx: FormContext) => HTMLElement;
}

export const panelSpecs = (): PanelSpec[] => [
  { id: 'general', label: __('General', 'kotlinskidev-accessibility'), build: buildGeneralPanel },
  { id: 'features', label: __('Features', 'kotlinskidev-accessibility'), build: buildFeaturesPanel },
  { id: 'profiles', label: __('Profiles', 'kotlinskidev-accessibility'), build: buildProfilesPanel },
  { id: 'visibility', label: __('Visibility', 'kotlinskidev-accessibility'), build: buildVisibilityPanel },
  { id: 'appearance', label: __('Appearance', 'kotlinskidev-accessibility'), build: buildAppearancePanel },
  { id: 'languages', label: __('Languages', 'kotlinskidev-accessibility'), build: buildLanguagesPanel },
  { id: 'behavior', label: __('Behavior', 'kotlinskidev-accessibility'), build: buildBehaviorPanel },
  { id: 'import-export', label: __('Import / Export', 'kotlinskidev-accessibility'), build: buildImportExportPanel },
];

export interface RenderOptions {
  initial?: string;
  onSelect?: (id: string) => void;
}

export const renderForm = (ctx: FormContext, options: RenderOptions = {}): TabsApi =>
  createTabs(
    panelSpecs().map((spec) => ({ id: spec.id, label: spec.label, panel: spec.build(ctx) })),
    { label: __('Accessibility settings sections', 'kotlinskidev-accessibility'), initial: options.initial, onSelect: options.onSelect }
  );
