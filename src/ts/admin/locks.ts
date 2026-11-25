import { __, sprintf } from '@wordpress/i18n';
import { PATH_ATTRIBUTE, errorMessage, h, isRecord, uid } from './dom';

export const lockedPathsOf = (error: unknown): string[] =>
  isRecord(error) && isRecord(error.data) && Array.isArray(error.data.paths) ? error.data.paths.filter((path): path is string => typeof path === 'string') : [];

export const failureMessage = (error: unknown, fallback: string): string => {
  const message = errorMessage(error, fallback);
  const paths = lockedPathsOf(error);
  return paths.length === 0 ? message : `${message} ${sprintf(__('Locked settings: %s.', 'kotlinskidev-accessibility'), paths.join(', '))}`;
};

const CONTROLS = 'input, select, textarea, button';

export const applyLockedState = (root: HTMLElement, locked: ReadonlySet<string>): void => {
  if (locked.size === 0) return;
  root.querySelectorAll<HTMLElement>(`[${PATH_ATTRIBUTE}]`).forEach((element) => {
    if (!locked.has(element.getAttribute(PATH_ATTRIBUTE) ?? '')) return;
    const ownControl = element.matches(CONTROLS);
    const controls = ownControl ? [element] : [...element.querySelectorAll<HTMLElement>(CONTROLS)];
    const note = h(
      'span',
      { class: ownControl || element.closest('td') !== null ? 'ka11y-locked screen-reader-text' : 'ka11y-locked description', id: uid('ka11y-locked') },
      __('Locked by site configuration', 'kotlinskidev-accessibility')
    );
    element.classList.add('is-locked');
    controls.forEach((control) => {
      control.toggleAttribute('disabled', true);
      control.setAttribute('aria-describedby', [control.getAttribute('aria-describedby'), note.id].filter(Boolean).join(' '));
    });
    if (ownControl) element.after(note);
    else element.append(note);
  });
};
