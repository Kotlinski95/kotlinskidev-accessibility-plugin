import { __ } from '@wordpress/i18n';
import type { FormContext } from '../context';
import { confirmDialog } from '../confirm-dialog';
import { button, errorMessage, h, uid } from '../dom';
import { downloadSettings, importSettingsFile } from '../import-export';

export const buildImportExportPanel = (ctx: FormContext): HTMLElement => {
  const host = h('div', { class: 'ka11y-panel ka11y-panel--import-export' });
  const fileId = uid('ka11y-import');
  const file = h('input', { type: 'file', accept: 'application/json,.json', id: fileId, class: 'ka11y-import__file' });

  const onExport = (): void => {
    downloadSettings(ctx.api).then(
      () => ctx.notices.success(__('Settings exported.', 'kotlinskidev-accessibility')),
      (error: unknown) => ctx.notices.error(errorMessage(error, __('Export failed.', 'kotlinskidev-accessibility')))
    );
  };

  const onImport = (): void => {
    const chosen = file.files?.[0];
    if (chosen === undefined) {
      ctx.notices.error(__('Choose a JSON file to import first.', 'kotlinskidev-accessibility'));
      return;
    }
    importSettingsFile(ctx.api, chosen).then(
      (settings) => {
        ctx.state.load(settings);
        ctx.reload();
        ctx.notices.success(__('Settings imported and saved.', 'kotlinskidev-accessibility'));
      },
      (error: unknown) => ctx.notices.error(errorMessage(error, __('Import failed.', 'kotlinskidev-accessibility')))
    );
  };

  const onReset = (): void => {
    confirmDialog(host, {
      title: __('Reset all settings?', 'kotlinskidev-accessibility'),
      message: __('This restores every setting to its default value and cannot be undone.', 'kotlinskidev-accessibility'),
      confirmLabel: __('Reset settings', 'kotlinskidev-accessibility'),
    })
      .then((confirmed) => (confirmed ? ctx.api.resetSettings() : null))
      .then(
        (settings) => {
          if (settings === null) return;
          ctx.state.load(settings);
          ctx.reload();
          ctx.notices.success(__('Settings reset to defaults.', 'kotlinskidev-accessibility'));
        },
        (error: unknown) => ctx.notices.error(errorMessage(error, __('Reset failed.', 'kotlinskidev-accessibility')))
      );
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
      h('p', { class: 'description' }, __('Upload a settings file. It replaces the saved settings immediately.', 'kotlinskidev-accessibility')),
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
