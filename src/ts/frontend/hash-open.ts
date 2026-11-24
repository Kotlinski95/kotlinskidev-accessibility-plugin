export const OPEN_HASH = '#kotlinskidev-a11y';

export interface HashOpenOptions {
  onOpen(): void;
  win?: Window;
  doc?: Document;
}

export const bindHashOpen = ({ onOpen, win = window, doc = document }: HashOpenOptions): (() => void) => {
  const onHashChange = (): void => {
    if (win.location.hash === OPEN_HASH) onOpen();
  };

  const onClick = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest(`a[href="${OPEN_HASH}"]`)) return;
    event.preventDefault();
    onOpen();
  };

  win.addEventListener('hashchange', onHashChange);
  doc.addEventListener('click', onClick);
  onHashChange();

  return () => {
    win.removeEventListener('hashchange', onHashChange);
    doc.removeEventListener('click', onClick);
  };
};
