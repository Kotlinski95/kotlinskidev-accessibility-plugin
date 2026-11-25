import { __, sprintf } from '@wordpress/i18n';
import type { Api } from './api';
import { previewChanges } from './change-preview';
import { failingPairs } from './contrast';
import type { FormContext } from './context';
import { h, isRecord } from './dom';
import { renderForm } from './form-renderer';
import { installUnsavedGuard } from './guard';
import { failureMessage } from './locks';
import { createNotices } from './notices';
import { createPreview } from './preview';
import { createSearch } from './search';
import type { TabsApi } from './tabs';
import { createSaveBar } from './save-bar';
import { createFormState } from './state';
import { tokenLabel } from './labels';
import { createTriggerNotice } from './panels/triggers';
import type { FormState } from './state';
import type { AdminConfig, SchemaPayload, SettingsTree } from './types';

export interface AdminApp {
  state: FormState;
  save: () => Promise<void>;
  destroy: () => void;
}

export const buildApp = (root: HTMLElement, config: AdminConfig, api: Api, schema: SchemaPayload, settings: SettingsTree): AdminApp => {
  const state = createFormState(settings);
  const notices = createNotices();
  const formHost = h('div', { class: 'ka11y-form' });
  const locked: ReadonlySet<string> = new Set(schema.locked ?? []);
  const paths = Object.keys(schema.definitions);
  let activeTab: string | undefined;
  let tabs: TabsApi | undefined;

  const onSelect = (id: string): void => {
    activeTab = id;
  };

  const mountForm = (focusTab = false): void => {
    tabs = renderForm(context, { initial: activeTab, onSelect });
    formHost.replaceChildren(tabs.element);
    if (focusTab) tabs.buttons.find((tabButton) => tabButton.getAttribute('aria-selected') === 'true')?.focus();
  };

  const context: FormContext = { state, schema, config, api, notices, locked, reload: () => mountForm(true) };
  const search = createSearch(() => tabs);

  const triggerNotice = createTriggerNotice(context);

  const saveBar = createSaveBar(
    state,
    () => {
      void requestSave();
    },
    paths
  );
  const preview = createPreview(state);

  const reportSaved = (saved: SettingsTree): void => {
    const tokens = saved.tokens;
    const failing = failingPairs(isRecord(tokens) ? tokens : {});
    if (failing.length === 0) {
      notices.success(__('Settings saved.', 'kotlinskidev-accessibility'));
      return;
    }
    const pairs = failing.map((pair) => sprintf(__('%1$s on %2$s', 'kotlinskidev-accessibility'), tokenLabel(pair.foreground), tokenLabel(pair.background)));
    notices.warning(
      sprintf(__('Settings saved, but these color pairs are below the minimum contrast: %s.', 'kotlinskidev-accessibility'), pairs.join(', '))
    );
  };

  const save = async (): Promise<void> => {
    saveBar.setBusy(true);
    try {
      const saved = await api.saveSettings(state.snapshot());
      state.load(saved);
      mountForm();
      void triggerNotice.refresh();
      reportSaved(saved);
    } catch (error) {
      notices.error(failureMessage(error, __('Settings could not be saved.', 'kotlinskidev-accessibility')));
    } finally {
      saveBar.setBusy(false);
    }
  };

  const requestSave = async (): Promise<void> => {
    saveBar.setBusy(true);
    try {
      const pending = await api.previewSave(state.snapshot());
      saveBar.setBusy(false);
      const confirmed = await previewChanges(saveBar.element, {
        title: __('Save these changes?', 'kotlinskidev-accessibility'),
        message: __('These settings will change on your site.', 'kotlinskidev-accessibility'),
        confirmLabel: __('Save changes', 'kotlinskidev-accessibility'),
        changes: pending.changes,
        notes: { adjusted: pending.adjusted, locked: pending.locked },
      });
      if (confirmed) await save();
    } catch (error) {
      notices.error(failureMessage(error, __('Settings could not be saved.', 'kotlinskidev-accessibility')));
    } finally {
      saveBar.setBusy(false);
    }
  };

  mountForm();
  void triggerNotice.refresh();
  root.replaceChildren(
    notices.element,
    triggerNotice.element,
    h('div', { class: 'ka11y-layout' }, h('div', { class: 'ka11y-layout__main' }, search.element, formHost, saveBar.element), h('aside', { class: 'ka11y-layout__aside' }, preview.element))
  );
  const removeGuard = installUnsavedGuard(state);

  return { state, save, destroy: removeGuard };
};

export const mountAdmin = async (root: HTMLElement, config: AdminConfig, api: Api): Promise<AdminApp | null> => {
  root.replaceChildren(h('p', { class: 'ka11y-loading', role: 'status' }, __('Loading settings', 'kotlinskidev-accessibility')));
  try {
    const [schema, settings] = await Promise.all([api.getSchema(), api.getSettings()]);
    return buildApp(root, config, api, schema, settings);
  } catch (error) {
    const notices = createNotices();
    root.replaceChildren(notices.element);
    notices.error(failureMessage(error, __('Settings could not be loaded.', 'kotlinskidev-accessibility')));
    return null;
  }
};
