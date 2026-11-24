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

  const onLauncherClick = (): void => toggle();

  const render = (): void => {
    panel.toggleAttribute('inert', !opened);
    launcher.setAttribute('aria-expanded', String(opened));
  };

  function open(opener?: HTMLElement | null): void {
    if (opened) return;
    opened = true;
    returnTarget = opener ?? launcher;
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
    (returnTarget.isConnected ? returnTarget : launcher).focus();
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
