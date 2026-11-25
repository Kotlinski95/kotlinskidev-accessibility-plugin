import { _n, __, sprintf } from '@wordpress/i18n';
import type { FormState } from './state';

export const unsavedSummary = (count: number): string =>
  count > 0 ? sprintf(_n('You have %d unsaved change.', 'You have %d unsaved changes.', count, 'kotlinskidev-accessibility'), count) : '';

export const withUnsavedWarning = (message: string, count: number): string =>
  count > 0
    ? `${message} ${sprintf(_n('Your %d unsaved change will be lost.', 'Your %d unsaved changes will be lost.', count, 'kotlinskidev-accessibility'), count)}`
    : message;

export const unsavedCount = (state: FormState, paths: readonly string[]): number => {
  const changed = state.changedPaths(paths).length;
  return changed === 0 && state.isDirty() ? 1 : changed;
};

export const installUnsavedGuard = (state: FormState, target: Window = window): (() => void) => {
  const onBeforeUnload = (event: BeforeUnloadEvent): void => {
    if (!state.isDirty()) return;
    event.preventDefault();
    event.returnValue = __('You have unsaved changes.', 'kotlinskidev-accessibility');
  };
  target.addEventListener('beforeunload', onBeforeUnload);
  return () => target.removeEventListener('beforeunload', onBeforeUnload);
};
