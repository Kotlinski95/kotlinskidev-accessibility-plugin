import { __ } from '@wordpress/i18n';
import { h, uid } from './dom';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  content?: HTMLElement;
}

const FOCUSABLE = 'button:not([disabled]), [tabindex="0"]';

export const confirmDialog = (host: HTMLElement, options: ConfirmOptions): Promise<boolean> =>
  new Promise((resolve) => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const id = uid('ka11y-dialog');
    const cancel = h('button', { type: 'button', class: 'button' }, __('Cancel', 'kotlinskidev-accessibility'));
    const confirm = h('button', { type: 'button', class: 'button button-primary' }, options.confirmLabel);
    const dialog = h(
      'div',
      { class: options.content === undefined ? 'ka11y-dialog' : 'ka11y-dialog ka11y-dialog--wide', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': `${id}-title`, 'aria-describedby': `${id}-message` },
      h('h2', { class: 'ka11y-dialog__title', id: `${id}-title` }, options.title),
      h('p', { class: 'ka11y-dialog__message', id: `${id}-message` }, options.message),
      options.content,
      h('div', { class: 'ka11y-dialog__actions' }, cancel, confirm)
    );
    const backdrop = h('div', { class: 'ka11y-dialog__backdrop' }, dialog);

    const finish = (answer: boolean): void => {
      document.removeEventListener('keydown', onKeydown, true);
      backdrop.remove();
      previous?.focus();
      resolve(answer);
    };

    function onKeydown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (first === undefined || last === undefined) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    const onCancel = (): void => finish(false);
    const onConfirm = (): void => finish(true);
    cancel.addEventListener('click', onCancel);
    confirm.addEventListener('click', onConfirm);
    document.addEventListener('keydown', onKeydown, true);

    host.append(backdrop);
    cancel.focus();
  });
