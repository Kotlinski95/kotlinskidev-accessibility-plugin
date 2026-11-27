import { createHideToolbar } from '../../src/ts/frontend/hide-toolbar';
import { createPanel, type PanelDataSlice } from '../../src/ts/frontend/panel';
import { panelVariables } from '../../src/ts/frontend/panel/appearance';
import { createPanelLayout } from '../../src/ts/frontend/panel/layout';
import { createProfiles } from '../../src/ts/frontend/profiles';
import { createStore } from '../../src/ts/frontend/store';
import type { PanelConfig, PanelLocale } from '../../src/ts/shared/types';
import { createConfig } from './helpers';

const BASE: PanelConfig = {
  columns: 3,
  sections: { profiles: true, content: true, color: true, orientation: true, skip: true },
  languageSwitcher: true,
};

const LOCALES: PanelLocale[] = [
  { locale: 'en_US', label: 'English', rtl: false },
  { locale: 'pl_PL', label: 'Polski', rtl: false },
];

const setup = (overrides: Partial<PanelConfig>) => {
  document.body.innerHTML = '<div id="ka11y-root"><button type="button" class="ka11y-launcher"></button></div>';
  const host = document.getElementById('ka11y-root') as HTMLElement;
  const shadow = host.attachShadow({ mode: 'open' });
  const config = createConfig();
  const store = createStore();
  const data: PanelDataSlice = { panel: { ...BASE, ...overrides }, icons: {}, locales: LOCALES };
  const panel = createPanel({
    config,
    store,
    profiles: createProfiles(store, config.profiles, config.features),
    hideToolbar: createHideToolbar({ host, key: config.storage.key }),
    host,
    shadow,
    data,
  });
  return { host, shadow, panel };
};

describe('panel variables', () => {
  it('emits nothing for the defaults', () => {
    expect(panelVariables(BASE)).toEqual({});
    expect(panelVariables({ ...BASE, width: 448, offset: 0, animationMs: 220, backdrop: false })).toEqual({});
  });

  it('emits width, offset and proportionally shorter close duration', () => {
    expect(panelVariables({ ...BASE, width: 520, offset: 16, animationMs: 440 })).toEqual({
      '--ka11y-panel-width': '520px',
      '--ka11y-panel-offset': '16px',
      '--ka11y-open-ms': '440ms',
      '--ka11y-close-ms': '320ms',
    });
  });

  it('emits backdrop variables only when enabled and blur only when above zero', () => {
    expect(panelVariables({ ...BASE, backdrop: true, backdropColor: '#101114', backdropOpacity: 55, backdropBlur: 0 })).toEqual({
      '--ka11y-backdrop-color': '#101114',
      '--ka11y-backdrop-opacity': '0.55',
    });
    expect(panelVariables({ ...BASE, backdrop: true, backdropBlur: 6 })['--ka11y-backdrop-filter']).toBe('blur(6px)');
  });
});

describe('panel appearance', () => {
  it('applies variables to the host and the animation attribute to the panel', () => {
    const { host, shadow } = setup({ width: 500, animation: 'fade' });
    expect(host.style.getPropertyValue('--ka11y-panel-width')).toBe('500px');
    expect(shadow.querySelector('.ka11y-panel')?.getAttribute('data-animation')).toBe('fade');
  });

  it('keeps the slide animation attribute off and adds no backdrop by default', () => {
    const { shadow } = setup({});
    expect(shadow.querySelector('.ka11y-panel')?.hasAttribute('data-animation')).toBe(false);
    expect(shadow.querySelector('.ka11y-backdrop')).toBeNull();
  });
});

describe('panel backdrop', () => {
  it('shows with the panel and closes it on pointerdown', () => {
    const { shadow, panel } = setup({ backdrop: true });
    const backdrop = shadow.querySelector('.ka11y-backdrop') as HTMLElement;
    expect(backdrop.getAttribute('aria-hidden')).toBe('true');
    expect(backdrop.hasAttribute('data-open')).toBe(false);
    panel.dialog.open();
    expect(backdrop.hasAttribute('data-open')).toBe(true);
    backdrop.dispatchEvent(new Event('pointerdown', { cancelable: true }));
    expect(panel.dialog.isOpen()).toBe(false);
    expect(backdrop.hasAttribute('data-open')).toBe(false);
  });

  it('stays open on backdrop pointerdown when closing is disabled', () => {
    const { shadow, panel } = setup({ backdrop: true, closeOnBackdrop: false });
    panel.dialog.open();
    const event = new Event('pointerdown', { cancelable: true });
    (shadow.querySelector('.ka11y-backdrop') as HTMLElement).dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(panel.dialog.isOpen()).toBe(true);
  });
});

describe('panel language mode', () => {
  beforeEach(() => localStorage.clear());

  it('hides the switcher and clears the saved visitor locale when following the page', () => {
    localStorage.setItem('ka11y-locale', 'pl_PL');
    const { shadow } = setup({ languageMode: 'follow' });
    expect(shadow.querySelector('#ka11y-lang')).toBeNull();
    expect(localStorage.getItem('ka11y-locale')).toBeNull();
  });

  it('keeps the switcher and saved locale when visitors choose', () => {
    localStorage.setItem('ka11y-locale', 'en_US');
    const { shadow } = setup({ languageMode: 'choose' });
    expect(shadow.querySelector('#ka11y-lang')).not.toBeNull();
    expect(localStorage.getItem('ka11y-locale')).toBe('en_US');
  });
});

describe('panel side preference', () => {
  const place = (side: 'auto' | 'left' | 'right', left: number): string => {
    const host = document.createElement('div');
    host.getBoundingClientRect = () => ({ left, width: 40 }) as DOMRect;
    const panel = document.createElement('div');
    const win = { innerWidth: 1000 } as unknown as Window;
    createPanelLayout({ panel, host, sheetQuery: '', side, win }).place();
    return panel.dataset.side as string;
  };

  it('honours a forced side and falls back to the launcher position on auto', () => {
    expect(place('left', 900)).toBe('left');
    expect(place('right', 10)).toBe('right');
    expect(place('auto', 10)).toBe('left');
    expect(place('auto', 900)).toBe('right');
  });
});
