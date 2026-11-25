import { createPanelLayout } from '../../src/ts/frontend/panel/layout';

type Listener = (event: MediaQueryListEvent) => void;

const mockMedia = (initial: boolean) => {
  const listeners = new Set<Listener>();
  const list = {
    matches: initial,
    addEventListener: jest.fn((_: string, fn: Listener) => listeners.add(fn)),
    removeEventListener: jest.fn((_: string, fn: Listener) => listeners.delete(fn)),
  };
  const matchMedia = jest.fn(() => list as unknown as MediaQueryList);
  const fire = (matches: boolean): void => listeners.forEach((fn) => fn({ matches } as MediaQueryListEvent));
  return { matchMedia, fire, list };
};

const setup = (initial: boolean, rect: Partial<DOMRect>, width = 1000) => {
  const media = mockMedia(initial);
  const host = document.createElement('div');
  host.getBoundingClientRect = () => ({ left: 0, width: 0, ...rect }) as DOMRect;
  const panel = document.createElement('div');
  const win = { matchMedia: media.matchMedia, innerWidth: width } as unknown as Window;
  const layout = createPanelLayout({ panel, host, sheetQuery: '(max-width:768px)', win });
  return { media, panel, layout };
};

describe('panel layout', () => {
  it('uses the sheet query from panel data', () => {
    const { media } = setup(false, {});
    expect(media.matchMedia).toHaveBeenCalledWith('(max-width:768px)');
  });

  it('sets sheet when the query matches and side otherwise', () => {
    expect(setup(true, {}).panel.dataset.layout).toBe('sheet');
    expect(setup(false, {}).panel.dataset.layout).toBe('side');
  });

  it('switches on the change event', () => {
    const { media, panel, layout } = setup(false, {});
    media.fire(true);
    expect(panel.dataset.layout).toBe('sheet');
    expect(layout.mode()).toBe('sheet');
    media.fire(false);
    expect(panel.dataset.layout).toBe('side');
  });

  it('derives data-side from the host centre', () => {
    const left = setup(false, { left: 10, width: 40 });
    expect(left.layout.place()).toBe('left');
    expect(left.panel.dataset.side).toBe('left');
    const right = setup(false, { left: 900, width: 40 });
    expect(right.layout.place()).toBe('right');
    expect(right.panel.dataset.side).toBe('right');
  });

  it('stops listening after destroy', () => {
    const { media, layout } = setup(false, {});
    layout.destroy();
    expect(media.list.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('defaults to side without matchMedia', () => {
    const panel = document.createElement('div');
    createPanelLayout({ panel, host: document.createElement('div'), sheetQuery: '(max-width:768px)', win: {} as Window });
    expect(panel.dataset.layout).toBe('side');
  });
});
