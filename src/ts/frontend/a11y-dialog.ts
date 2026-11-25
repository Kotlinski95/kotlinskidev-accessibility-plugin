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

  const focusables = (): HTMLElement[] => [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(isFocusable);

  const trapTab = (event: KeyboardEvent): void => {
    const items = focusables();
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    event.preventDefault();
    const active = shadow.activeElement;
    const index = active instanceof HTMLElement ? items.indexOf(active) : -1;
    if (index === -1) {
      (event.shiftKey ? last : first).focus();
      return;
    }
    const step = event.shiftKey ? -1 : 1;
    (items[(index + step + items.length) % items.length] ?? first).focus();
  };

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'Tab') trapTab(event);
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

  const restoreFocus = (): void => {
    if (returnTarget === launcher ? launcherUsable() : usable(returnTarget)) returnTarget.focus();
    else if (launcherUsable()) launcher.focus();
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
    returnTarget = opener ?? lightActive() ?? launcher;
    render();
    doc.addEventListener('keydown', onKeydown);
    onChange?.(true);
    focusables()[0]?.focus();
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
    launcher.removeEventListener('click', onLauncherClick);
  };

  launcher.setAttribute('aria-controls', panel.id);
  launcher.addEventListener('click', onLauncherClick);
  render();

  return { open, close, toggle, isOpen: () => opened, destroy };
};
