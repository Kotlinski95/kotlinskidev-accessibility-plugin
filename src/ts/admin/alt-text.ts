import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import type { Fetcher } from './api';
import { errorMessage } from './dom';

export interface AltTextConfig {
  restRoot: string;
  nonce: string;
}

declare global {
  interface Window {
    kotlinskidevA11yAltText?: AltTextConfig;
  }
}

interface SaveResponse {
  id: number;
  alt: string;
  remaining: number;
}

const ROW_SELECTOR = '.ka11y-alt-row';
const INPUT_SELECTOR = '.ka11y-alt-row__input';
const SAVE_SELECTOR = '.ka11y-alt-row__save';
const REMAINING_SELECTOR = '[data-ka11y-remaining]';

const createStatus = (root: HTMLElement): HTMLElement => {
  const existing = root.querySelector<HTMLElement>('.ka11y-alt-status');
  if (existing !== null) return existing;
  const status = document.createElement('p');
  status.className = 'ka11y-alt-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  root.appendChild(status);
  return status;
};

const setBusy = (row: HTMLElement, input: HTMLInputElement, save: HTMLButtonElement, busy: boolean): void => {
  input.disabled = busy;
  save.disabled = busy;
  row.setAttribute('aria-busy', busy ? 'true' : 'false');
};

export const mountAltText = (root: HTMLElement, config: AltTextConfig, fetcher: Fetcher = apiFetch): void => {
  const status = createStatus(root);

  const announce = (message: string, failed: boolean): void => {
    status.classList.toggle('is-error', failed);
    status.textContent = message;
  };

  const updateRemaining = (remaining: number): void => {
    const target = root.querySelector<HTMLElement>(REMAINING_SELECTOR);
    if (target !== null) target.textContent = String(remaining);
  };

  const saveRow = async (row: HTMLElement): Promise<void> => {
    const input = row.querySelector<HTMLInputElement>(INPUT_SELECTOR);
    const save = row.querySelector<HTMLButtonElement>(SAVE_SELECTOR);
    const id = Number(row.dataset.attachmentId);
    if (input === null || save === null || !Number.isInteger(id)) return;
    const file = row.dataset.file ?? '';
    const alt = input.value.trim();
    if (alt === '') {
      announce(sprintf(__('Enter alt text for %s before saving.', 'kotlinskidev-accessibility'), file), true);
      input.focus();
      return;
    }
    setBusy(row, input, save, true);
    try {
      const response = await fetcher<SaveResponse>({
        url: `${config.restRoot}alt-text/${id}`,
        method: 'POST',
        headers: { 'X-WP-Nonce': config.nonce },
        data: { alt },
      });
      row.classList.add('is-saved');
      updateRemaining(response.remaining);
      announce(sprintf(__('Alt text saved for %s.', 'kotlinskidev-accessibility'), file), false);
    } catch (error) {
      announce(errorMessage(error, __('Alt text could not be saved.', 'kotlinskidev-accessibility')), true);
    } finally {
      setBusy(row, input, save, false);
    }
  };

  const onClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const save = target.closest(SAVE_SELECTOR);
    const row = save?.closest<HTMLElement>(ROW_SELECTOR) ?? null;
    if (row !== null) void saveRow(row);
  };

  const onKeydown = (event: KeyboardEvent): void => {
    const target = event.target;
    if (event.key !== 'Enter' || !(target instanceof HTMLInputElement) || !target.matches(INPUT_SELECTOR)) return;
    event.preventDefault();
    const row = target.closest<HTMLElement>(ROW_SELECTOR);
    if (row !== null) void saveRow(row);
  };

  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKeydown);
};
