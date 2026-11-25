import { __ } from '@wordpress/i18n';
import { h } from './dom';
import { unsavedCount, unsavedSummary } from './guard';
import type { FormState } from './state';

export interface SaveBar {
  element: HTMLElement;
  setBusy: (busy: boolean) => void;
  refresh: () => void;
}

export const createSaveBar = (state: FormState, onSave: () => void, paths: readonly string[] = []): SaveBar => {
  const submit = h('button', { type: 'button', class: 'button button-primary ka11y-savebar__save' }, __('Save changes', 'kotlinskidev-accessibility'));
  const status = h('span', { class: 'ka11y-savebar__status', role: 'status', 'aria-live': 'polite' });
  const element = h('div', { class: 'ka11y-savebar' }, submit, status);
  let busy = false;

  const refresh = (): void => {
    const dirty = state.isDirty();
    submit.disabled = busy || !dirty;
    submit.setAttribute('aria-disabled', String(submit.disabled));
    status.textContent = dirty ? unsavedSummary(unsavedCount(state, paths)) : '';
    element.classList.toggle('is-dirty', dirty);
  };

  const onClick = (): void => {
    if (!submit.disabled) onSave();
  };
  submit.addEventListener('click', onClick);
  state.subscribe(refresh);
  refresh();

  return {
    element,
    refresh,
    setBusy: (value) => {
      busy = value;
      submit.classList.toggle('is-busy', value);
      refresh();
    },
  };
};
