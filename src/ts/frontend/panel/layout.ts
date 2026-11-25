export type PanelLayoutMode = 'sheet' | 'side';
export type PanelSide = 'left' | 'right';

export interface PanelLayoutOptions {
  panel: HTMLElement;
  host: HTMLElement;
  sheetQuery: string;
  win?: Window;
}

export interface PanelLayoutController {
  place(): PanelSide;
  mode(): PanelLayoutMode;
  destroy(): void;
}

export const createPanelLayout = ({ panel, host, sheetQuery, win = window }: PanelLayoutOptions): PanelLayoutController => {
  const query = sheetQuery !== '' && typeof win.matchMedia === 'function' ? win.matchMedia(sheetQuery) : null;

  const modeOf = (matches: boolean): PanelLayoutMode => (matches ? 'sheet' : 'side');

  const apply = (matches: boolean): void => {
    panel.dataset.layout = modeOf(matches);
  };

  const onChange = (event: MediaQueryListEvent): void => apply(event.matches);

  const place = (): PanelSide => {
    const rect = host.getBoundingClientRect();
    const side: PanelSide = rect.left + rect.width / 2 < win.innerWidth / 2 ? 'left' : 'right';
    panel.dataset.side = side;
    return side;
  };

  apply(query?.matches ?? false);
  query?.addEventListener('change', onChange);

  return {
    place,
    mode: () => (panel.dataset.layout === 'sheet' ? 'sheet' : 'side'),
    destroy: () => query?.removeEventListener('change', onChange),
  };
};
