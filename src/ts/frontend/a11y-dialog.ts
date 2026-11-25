export interface DialogOptions {
  panel: HTMLElement;
  launcher: HTMLElement;
  shadow: ShadowRoot;
  doc?: Document;
  onChange?(open: boolean): void;
}

export interface Dialog {
  open(opener?: HTMLElement | null): void;
  close(): void;
  toggle(opener?: HTMLElement | null): void;
  isOpen(): boolean;
  destroy(): void;
}

const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const isFocusable = (element: HTMLElement): boolean =>
  !element.hasAttribute('disabled') && element.closest('[hidden]') === null;

const usable = (element: HTMLElement): boolean =>
  element.isConnected && element.closest('[hidden]') === null && (element.checkVisibility?.() ?? true);

export const createDialog = ({ panel, launcher, shadow, doc = document, onChange }: DialogOptions): Dialog => {
  let opened = false;
  let returnTarget: HTMLElement = launcher;
  let previous: HTMLElement | null = null;
  let lastFocused: HTMLElement | null = null;

  const focusables = (): HTMLElement[] => [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(isFocusable);

  const focusInside = (): boolean => {
    const active = shadow.activeElement;
    return active instanceof HTMLElement && (panel.contains(active) || active === launcher);
  };

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !focusInside()) return;
    event.preventDefault();
    close();
  };

  const focusTitle = (): void => {
    const titleId = panel.getAttribute('aria-labelledby');
    const title = titleId ? panel.querySelector<HTMLElement>(`[id="${titleId}"]`) : null;
    if (!title) {
      focusables()[0]?.focus();
      return;
    }
    if (!title.hasAttribute('tabindex')) title.setAttribute('tabindex', '-1');
    title.focus();
  };

  const launcherUsable = (): boolean => {
    const host = shadow.host;
    return usable(launcher) && !launcher.hidden && host.getAttribute('data-ka11y-launcher') !== 'hidden' && host.closest('[hidden]') === null;
  };

  const lightActive = (): HTMLElement | null => {
    const active = doc.activeElement;
    return active instanceof HTMLElement && active !== doc.body && active !== shadow.host ? active : null;
  };

  const focusBody = (): void => {
    doc.body.setAttribute('tabindex', '-1');
    doc.body.focus();
    doc.body.removeAttribute('tabindex');
  };

  const rememberFocus = (event: FocusEvent): void => {
    const target = event.target;
    if (!opened && target instanceof HTMLElement && target !== doc.body && target !== shadow.host) lastFocused = target;
  };

  const restoreFocus = (): void => {
    if (returnTarget === launcher ? launcherUsable() : usable(returnTarget)) returnTarget.focus();
    else if (launcherUsable()) launcher.focus();
    else if (previous && usable(previous)) previous.focus();
    else focusBody();
  };

  const onLauncherClick = (): void => toggle();

  const render = (): void => {
    panel.toggleAttribute('inert', !opened);
    launcher.setAttribute('aria-expanded', String(opened));
  };

  function open(opener?: HTMLElement | null): void {
    if (opened) return;
    opened = true;
    previous = lightActive() ?? (lastFocused && usable(lastFocused) ? lastFocused : null);
    returnTarget = opener ?? lightActive() ?? launcher;
    render();
    doc.addEventListener('keydown', onKeydown);
    onChange?.(true);
    focusTitle();
  }

  function close(): void {
    if (!opened) return;
    opened = false;
    render();
    doc.removeEventListener('keydown', onKeydown);
    onChange?.(false);
    restoreFocus();
  }

  function toggle(opener?: HTMLElement | null): void {
    if (opened) close();
    else open(opener);
  }

  const destroy = (): void => {
    doc.removeEventListener('keydown', onKeydown);
    doc.removeEventListener('focusin', rememberFocus);
    launcher.removeEventListener('click', onLauncherClick);
  };

  launcher.setAttribute('aria-controls', panel.id);
  launcher.addEventListener('click', onLauncherClick);
  doc.addEventListener('focusin', rememberFocus);
  render();

  return { open, close, toggle, isOpen: () => opened, destroy };
};
