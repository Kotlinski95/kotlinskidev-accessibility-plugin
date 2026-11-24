export interface HideToolbarOptions {
  host: HTMLElement;
  key: string;
  onChange?(hidden: boolean): void;
}

export interface HideToolbar {
  isHidden(): boolean;
  hideForSession(): void;
  hideForDays(days: number): void;
  show(): void;
}

const DAY_MS = 86_400_000;

export const createHideToolbar = ({ host, key, onChange }: HideToolbarOptions): HideToolbar => {
  const storageKey = `${key}-hidden`;

  const readHidden = (): boolean => {
    try {
      if (sessionStorage.getItem(storageKey) === '1') return true;
      const expiry = Number(localStorage.getItem(storageKey));
      if (expiry > Date.now()) return true;
      if (expiry > 0) localStorage.removeItem(storageKey);
    } catch {
      return false;
    }
    return false;
  };

  const render = (hidden: boolean): void => {
    host.hidden = hidden;
    onChange?.(hidden);
  };

  const isHidden = (): boolean => host.hidden;

  const attempt = (action: () => void): void => {
    try {
      action();
    } catch {
      return;
    }
  };

  const hideForSession = (): void => {
    attempt(() => sessionStorage.setItem(storageKey, '1'));
    render(true);
  };

  const hideForDays = (days: number): void => {
    attempt(() => localStorage.setItem(storageKey, String(Date.now() + days * DAY_MS)));
    render(true);
  };

  const show = (): void => {
    attempt(() => {
      sessionStorage.removeItem(storageKey);
      localStorage.removeItem(storageKey);
    });
    render(false);
  };

  if (readHidden()) render(true);

  return { isHidden, hideForSession, hideForDays, show };
};
