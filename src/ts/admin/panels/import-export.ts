import { __ } from '@wordpress/i18n';
import type { FormContext } from '../context';
import { previewChanges } from '../change-preview';
import { button, h, uid } from '../dom';
import { unsavedCount, withUnsavedWarning } from '../guard';
import { downloadSettings, importIntro, parseSettingsFile } from '../import-export';
import { failureMessage } from '../locks';
import { resetWithPreview } from '../tab-reset';

export const buildImportExportPanel = (ctx: FormContext): HTMLElement => {
  const host = h('div', { class: 'ka11y-panel ka11y-panel--import-export' });
  const fileId = uid('ka11y-import');
  const file = h('input', { type: 'file', accept: 'application/json,.json', id: fileId, class: 'ka11y-import__file' });

  const onExport = (): void => {
    downloadSettings(ctx.api).then(
      () => ctx.notices.success(__('Settings exported.', 'kotlinskidev-accessibility')),
      (error: unknown) => ctx.notices.error(failureMessage(error, __('Export failed.', 'kotlinskidev-accessibility')))
    );
  };

  const runImport = async (chosen: Blob): Promise<void> => {
    const body = await parseSettingsFile(chosen);
    const preview = await ctx.api.importSettings(body, true);
    if (preview.changes.length === 0) {
      ctx.notices.success(__('This file matches the current settings. Nothing to import.', 'kotlinskidev-accessibility'));
      return;
    }
    const count = unsavedCount(ctx.state, Object.keys(ctx.schema.definitions));
    const confirmed = await previewChanges(host, {
      title: __('Import these settings?', 'kotlinskidev-accessibility'),
      message: withUnsavedWarning(importIntro(preview), count),
      confirmLabel: __('Import settings', 'kotlinskidev-accessibility'),
      changes: preview.changes,
      notes: { adjusted: preview.adjusted, locked: preview.locked, dropped: preview.dropped },
    });
    if (!confirmed) return;
    const result = await ctx.api.importSettings(body, false);
    ctx.state.load(result.settings);
    ctx.reload();
    ctx.notices.success(__('Settings imported and saved.', 'kotlinskidev-accessibility'));
  };

  const onImport = (): void => {
    const chosen = file.files?.[0];
    if (chosen === undefined) {
      ctx.notices.error(__('Choose a JSON file to import first.', 'kotlinskidev-accessibility'));
      return;
    }
    runImport(chosen).catch((error: unknown) => ctx.notices.error(failureMessage(error, __('Import failed.', 'kotlinskidev-accessibility'))));
  };

  const onReset = (): void => {
    void resetWithPreview(ctx, host, {
      paths: [],
      title: __('Reset all settings?', 'kotlinskidev-accessibility'),
      message: __('This restores every setting to its default value and cannot be undone.', 'kotlinskidev-accessibility'),
      confirmLabel: __('Reset settings', 'kotlinskidev-accessibility'),
      empty: __('Every setting already uses its default value.', 'kotlinskidev-accessibility'),
      done: __('Settings reset to defaults.', 'kotlinskidev-accessibility'),
    });
  };

  host.append(
    h(
      'section',
      { class: 'ka11y-card' },
      h('h3', { class: 'ka11y-subheading' }, __('Export', 'kotlinskidev-accessibility')),
      h('p', { class: 'description' }, __('Download the saved settings as a JSON file.', 'kotlinskidev-accessibility')),
      button(__('Download settings', 'kotlinskidev-accessibility'), 'button', onExport)
    ),
    h(
      'section',
      { class: 'ka11y-card' },
      h('h3', { class: 'ka11y-subheading' }, __('Import', 'kotlinskidev-accessibility')),
      h('p', { class: 'description' }, __('Upload a settings file. You review the changes before anything is saved.', 'kotlinskidev-accessibility')),
      h('label', { class: 'ka11y-field__label', for: fileId }, __('Settings file', 'kotlinskidev-accessibility')),
      file,
      button(__('Import settings', 'kotlinskidev-accessibility'), 'button', onImport)
    ),
    h(
      'section',
      { class: 'ka11y-card' },
      h('h3', { class: 'ka11y-subheading' }, __('Reset', 'kotlinskidev-accessibility')),
      h('p', { class: 'description' }, __('Restore every setting to its default value.', 'kotlinskidev-accessibility')),
      button(__('Reset to defaults', 'kotlinskidev-accessibility'), 'button button-link-delete', onReset)
    )
  );

  return host;
};
