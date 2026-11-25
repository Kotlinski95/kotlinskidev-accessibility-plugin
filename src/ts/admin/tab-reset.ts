import { __, sprintf } from '@wordpress/i18n';
import { previewChanges } from './change-preview';
import type { FormContext } from './context';
import { button, h } from './dom';
import { failureMessage } from './locks';
import { unsavedCount, withUnsavedWarning } from './guard';

export interface ResetRequest {
  paths: readonly string[];
  title: string;
  message: string;
  confirmLabel: string;
  empty: string;
  done: string;
}

export const resetWithPreview = async (ctx: FormContext, host: HTMLElement, request: ResetRequest): Promise<void> => {
  try {
    const preview = await ctx.api.previewReset(request.paths);
    if (preview.changes.length === 0) {
      ctx.notices.success(request.empty);
      return;
    }
    const count = unsavedCount(ctx.state, Object.keys(ctx.schema.definitions));
    const confirmed = await previewChanges(host, {
      title: request.title,
      message: withUnsavedWarning(request.message, count),
      confirmLabel: request.confirmLabel,
      changes: preview.changes,
      notes: { locked: preview.locked },
    });
    if (!confirmed) return;
    ctx.state.load(await ctx.api.resetSettings(request.paths));
    ctx.reload();
    ctx.notices.success(request.done);
  } catch (error) {
    ctx.notices.error(failureMessage(error, __('Reset failed.', 'kotlinskidev-accessibility')));
  }
};

export const buildTabReset = (ctx: FormContext, tabLabel: string, paths: readonly string[]): HTMLElement => {
  const host = h('div', { class: 'ka11y-tab-reset' });
  host.append(
    button(sprintf(__('Reset the %s tab', 'kotlinskidev-accessibility'), tabLabel), 'button button-link-delete', () => {
      void resetWithPreview(ctx, host, {
        paths,
        title: sprintf(__('Reset the %s tab?', 'kotlinskidev-accessibility'), tabLabel),
        message: __('This restores the settings on this tab to their default values.', 'kotlinskidev-accessibility'),
        confirmLabel: __('Reset tab', 'kotlinskidev-accessibility'),
        empty: sprintf(__('The %s tab already uses its default values.', 'kotlinskidev-accessibility'), tabLabel),
        done: sprintf(__('The %s tab was reset to its defaults.', 'kotlinskidev-accessibility'), tabLabel),
      });
    })
  );
  return host;
};
