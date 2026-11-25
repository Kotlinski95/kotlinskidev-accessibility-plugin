import { createHideToolbar } from '../../src/ts/frontend/hide-toolbar';
import { createPanel, type Panel, type PanelDataSlice } from '../../src/ts/frontend/panel';
import { createProfiles } from '../../src/ts/frontend/profiles';
import { mount } from '../../src/ts/frontend/chunks/panel';
import type { KernelApi } from '../../src/ts/frontend/kernel';
import { createStore, type Store } from '../../src/ts/frontend/store';
import type { KotlinskidevA11yConfig, PanelData } from '../../src/ts/shared/types';
import { createConfig } from './helpers';

interface Setup {
  host: HTMLElement;
  shadow: ShadowRoot;
  store: Store;
  panel: Panel;
  launcher: HTMLButtonElement;
  dialogEl: HTMLElement;
}

const setup = (config: KotlinskidevA11yConfig = createConfig()): Setup => {
  document.body.innerHTML =
    '<div id="ka11y-root"><button type="button" class="ka11y-launcher" aria-label="Open" aria-haspopup="dialog" aria-expanded="false"></button></div>';
  const host = document.getElementById('ka11y-root') as HTMLElement;
  const shadow = host.attachShadow({ mode: 'open' });
  const store = createStore();
  const profiles = createProfiles(store, config.profiles, config.features);
  const hideToolbar = createHideToolbar({ host, key: config.storage.key });
  const panel = createPanel({ config, store, profiles, hideToolbar, host, shadow });
  return {
    host,
    shadow,
    store,
    panel,
    launcher: shadow.querySelector('.ka11y-launcher') as HTMLButtonElement,
    dialogEl: shadow.querySelector('[role="dialog"]') as HTMLElement,
  };
};

const panelData = (customCss: string): PanelData => {
  const config = createConfig();
  return {
    hash: 'abcdef012345',
    locale: 'en_US',
    features: config.features,
    profiles: config.profiles,
    widget: config.widget,
    theme: config.theme,
    tokens: config.tokens,
    hideToolbar: config.hideToolbar,
    statementUrl: config.statementUrl,
    customCss,
    strings: config.strings,
    panel: {
      columns: 3,
      sections: { profiles: true, content: true, color: true, orientation: true, skip: true },
      languageSwitcher: true,
    },
    layout: { sheetQuery: '(max-width:768px)' },
    locales: [],
    icons: {},
  };
};

const toggleOf = (shadow: ShadowRoot, key: string): HTMLButtonElement =>
  shadow.querySelector(`button[data-feature="${key}"]`) as HTMLButtonElement;

const stepperOf = (shadow: ShadowRoot, key: string): HTMLElement => shadow.querySelector(`.ka11y-stepper[data-feature="${key}"]`) as HTMLElement;

const stepButton = (shadow: ShadowRoot, key: string, delta: number): HTMLButtonElement =>
  stepperOf(shadow, key).querySelector(`[data-step="${delta}"]`) as HTMLButtonElement;

const iconSet = { check: 'M5 12l5 5L20 7', close: 'M6 6l12 12', plus: 'M12 5v14', minus: 'M5 12h14', highlightLinks: 'M4 4h16', access: 'M12 2v20' };

const setupWith = (config: KotlinskidevA11yConfig, data: PanelDataSlice): Setup => {
  document.body.innerHTML =
    '<div id="ka11y-root"><button type="button" class="ka11y-launcher" aria-label="Open" aria-haspopup="dialog" aria-expanded="false"></button></div>';
  const host = document.getElementById('ka11y-root') as HTMLElement;
  const shadow = host.attachShadow({ mode: 'open' });
  const store = createStore();
  const profiles = createProfiles(store, config.profiles, config.features);
  const hideToolbar = createHideToolbar({ host, key: config.storage.key });
  const panel = createPanel({ config, store, profiles, hideToolbar, host, shadow, data });
  return {
    host,
    shadow,
    store,
    panel,
    launcher: shadow.querySelector('.ka11y-launcher') as HTMLButtonElement,
    dialogEl: shadow.querySelector('[role="dialog"]') as HTMLElement,
  };
};

const dataWith = (overrides: Partial<PanelDataSlice['panel']> = {}, icons: Record<string, string> = {}): PanelDataSlice => ({
  panel: {
    columns: 3,
    sections: { profiles: true, content: true, color: true, orientation: true, skip: true },
    languageSwitcher: true,
    ...overrides,
  },
  icons,
});

describe('panel', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('moves the launcher into the shadow root and renders dialog semantics', () => {
    const { host, shadow, dialogEl, launcher } = setup();
    expect(host.querySelector('.ka11y-launcher')).toBeNull();
    expect(launcher.getAttribute('aria-haspopup')).toBe('dialog');
    expect(dialogEl.hasAttribute('aria-modal')).toBe(false);
    const titleId = dialogEl.getAttribute('aria-labelledby') ?? '';
    expect(shadow.getElementById(titleId)?.textContent).toBe('Accessibility settings');
    expect(dialogEl.dataset.columns).toBe('3');
  });

  it('renders tiles and steppers only for enabled configured features', () => {
    const { shadow } = setup();
    expect(stepperOf(shadow, 'biggerText')).not.toBeNull();
    expect(toggleOf(shadow, 'biggerText')).toBeNull();
    expect(toggleOf(shadow, 'highlightLinks')).not.toBeNull();
    expect(toggleOf(shadow, 'saturation')).not.toBeNull();
    expect(toggleOf(shadow, 'hideImages')).toBeNull();
    expect(toggleOf(shadow, 'highlightLinks').textContent).toContain('Highlight links');
  });

  it('renders cards with titles in order', () => {
    const { shadow } = setup();
    const titles = [...shadow.querySelectorAll('.ka11y-card__title')].map((node) => node.textContent);
    expect(titles).toEqual(['profilesTitle', 'groupContent', 'groupColor']);
  });

  it('removes cards whose section is off', () => {
    const config = createConfig();
    const { shadow } = setupWith(config, dataWith({ sections: { profiles: false, content: true, color: false, orientation: true, skip: true } }));
    const titles = [...shadow.querySelectorAll('.ka11y-card__title')].map((node) => node.textContent);
    expect(titles).toEqual(['groupContent']);
  });

  it('applies the configured column count', () => {
    const { dialogEl } = setupWith(createConfig(), dataWith({ columns: 2 }));
    expect(dialogEl.dataset.columns).toBe('2');
  });

  it('falls back to the key for unknown strings', () => {
    const config = createConfig({ strings: {} });
    const { shadow } = setup(config);
    expect(shadow.querySelector('.ka11y-title')?.textContent).toBe('panelTitle');
  });

  it('tiles toggle aria-pressed, show the check badge and keep a stable name', () => {
    const { shadow } = setup();
    const button = toggleOf(shadow, 'highlightLinks');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.querySelector('.ka11y-tile__check')).not.toBeNull();
    button.click();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.querySelector('.ka11y-tile__label')?.textContent).toBe('Highlight links');
    button.click();
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('single level tiles describe only the description, multi level tiles add the state text', () => {
    const { shadow } = setup();
    expect(toggleOf(shadow, 'highlightLinks').getAttribute('aria-describedby')).toBe('ka11y-desc-highlightLinks');
    expect(shadow.getElementById('ka11y-state-highlightLinks')).toBeNull();
    expect(toggleOf(shadow, 'saturation').getAttribute('aria-describedby')).toBe('ka11y-desc-saturation ka11y-state-saturation');
  });

  it('cycles multi level tiles with level dots and state text', () => {
    const { shadow, store } = setup();
    const button = toggleOf(shadow, 'saturation');
    const dots = (): number => button.querySelectorAll('.ka11y-dots i[data-on]').length;
    const state = (): string | null | undefined => shadow.getElementById('ka11y-state-saturation')?.textContent;
    expect(button.querySelectorAll('.ka11y-dots i')).toHaveLength(2);
    expect(state()).toBe('Off');
    button.click();
    expect([state(), dots()]).toEqual(['Low', 1]);
    button.click();
    expect([state(), dots()]).toEqual(['High', 2]);
    expect(store.getState().levels.saturation).toBe(2);
    button.click();
    expect([state(), dots(), button.getAttribute('aria-pressed')]).toEqual(['Off', 0, 'false']);
  });

  it('steppers clamp at the bounds and expose aria-disabled and output text', () => {
    const { shadow, store } = setup();
    const output = stepperOf(shadow, 'biggerText').querySelector('output') as HTMLOutputElement;
    const minus = stepButton(shadow, 'biggerText', -1);
    const plus = stepButton(shadow, 'biggerText', 1);
    expect(output.textContent).toBe('levelDefault');
    expect(output.getAttribute('aria-live')).toBe('polite');
    expect(minus.getAttribute('aria-disabled')).toBe('true');
    minus.click();
    expect(store.getState().levels.biggerText).toBeUndefined();
    plus.click();
    expect(output.textContent).toBe('Low');
    expect(minus.getAttribute('aria-disabled')).toBe('false');
    plus.click();
    plus.click();
    expect(output.textContent).toBe('High');
    expect(plus.getAttribute('aria-disabled')).toBe('true');
    plus.click();
    expect(store.getState().levels.biggerText).toBe(3);
    minus.click();
    expect(output.textContent).toBe('Medium');
  });

  it('stepper buttons carry formatted accessible names', () => {
    const config = createConfig({ strings: { ...createConfig().strings, stepDecrease: 'Decrease %s', stepIncrease: 'Increase %s' } });
    const { shadow } = setup(config);
    expect(stepButton(shadow, 'biggerText', -1).getAttribute('aria-label')).toBe('Decrease Bigger text');
    expect(stepButton(shadow, 'biggerText', 1).getAttribute('aria-label')).toBe('Increase Bigger text');
  });

  it('reset button clears state and announces', () => {
    const { shadow, store } = setup();
    toggleOf(shadow, 'highlightLinks').click();
    (shadow.querySelector('.ka11y-reset') as HTMLButtonElement).click();
    expect(store.getState().levels).toEqual({});
    expect(toggleOf(shadow, 'highlightLinks').getAttribute('aria-pressed')).toBe('false');
    expect(shadow.querySelector('[role="status"]')?.textContent).toBe('resetDone');
  });

  it('renders profile tiles that drive features', () => {
    const { shadow, store } = setup();
    const profile = shadow.querySelector('[data-profile="visionImpaired"]') as HTMLButtonElement;
    expect(profile.getAttribute('aria-pressed')).toBe('false');
    expect(profile.hasAttribute('aria-describedby')).toBe(false);
    profile.click();
    expect(profile.getAttribute('aria-pressed')).toBe('true');
    expect(store.getState().levels).toEqual({ biggerText: 2, highlightLinks: true });
  });

  it('second profile click and reset remove the profile without touching other features', () => {
    const { shadow, store } = setup();
    const profile = shadow.querySelector('[data-profile="visionImpaired"]') as HTMLButtonElement;
    toggleOf(shadow, 'highlightLinks').click();
    profile.click();
    profile.click();
    expect(profile.getAttribute('aria-pressed')).toBe('false');
    expect(store.getState().levels).toEqual({ highlightLinks: true });
    profile.click();
    (shadow.querySelector('.ka11y-reset') as HTMLButtonElement).click();
    expect(profile.getAttribute('aria-pressed')).toBe('false');
    expect(store.getState().levels).toEqual({});
  });

  it('renders icons from valid path data and skips invalid ones', () => {
    const icons = { ...iconSet, saturation: '<script>alert(1)</script>' };
    const { shadow } = setupWith(createConfig(), dataWith({}, icons));
    const svg = toggleOf(shadow, 'highlightLinks').querySelector('.ka11y-tile__icon svg') as SVGSVGElement;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
    expect(svg.querySelector('path')?.getAttribute('d')).toBe('M4 4h16');
    expect(toggleOf(shadow, 'saturation').querySelector('.ka11y-tile__icon svg')).toBeNull();
    expect(shadow.querySelector('.ka11y-close svg')).not.toBeNull();
  });

  it('never uses innerHTML to build the panel', () => {
    document.body.innerHTML = '<div id="ka11y-root"></div>';
    const host = document.getElementById('ka11y-root') as HTMLElement;
    const shadow = host.attachShadow({ mode: 'open' });
    const config = createConfig();
    const store = createStore();
    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML') as PropertyDescriptor;
    const setter = jest.fn();
    Object.defineProperty(Element.prototype, 'innerHTML', { configurable: true, get: descriptor.get, set: setter });
    try {
      const panel = createPanel({
        config,
        store,
        profiles: createProfiles(store, config.profiles, config.features),
        hideToolbar: createHideToolbar({ host, key: config.storage.key }),
        host,
        shadow,
        data: dataWith({}, iconSet),
      });
      panel.dialog.open();
      panel.dialog.close();
    } finally {
      Object.defineProperty(Element.prototype, 'innerHTML', descriptor);
    }
    expect(setter).not.toHaveBeenCalled();
  });

  it('shows statement link in the meta row and the shortcut hint in the footer', () => {
    const { shadow } = setup();
    expect(shadow.querySelector('.ka11y-meta .ka11y-link')?.getAttribute('href')).toBe('https://example.test/statement');
    expect(shadow.querySelector('.ka11y-hint')?.textContent).toBe('Keyboard shortcut: Alt+Shift+A');
  });

  it('omits statement link, hint and hide menu when not configured', () => {
    const config = createConfig({
      statementUrl: '',
      shortcut: { enabled: false, combo: 'Alt+Shift+A' },
      hideToolbar: { allow: false, days: [] },
    });
    const { shadow } = setup(config);
    expect(shadow.querySelector('.ka11y-link')).toBeNull();
    expect(shadow.querySelector('.ka11y-hint')).toBeNull();
    expect(shadow.querySelector('.ka11y-hide-toggle')).toBeNull();
    expect(shadow.querySelector('.ka11y-meta')).toBeNull();
  });

  it('mount injects widget and custom styles into the shadow root', () => {
    const { store, host } = setup();
    const fresh = document.createElement('div').attachShadow({ mode: 'open' });
    const kernel = { store, profiles: () => createProfiles(store, {}), attachData: jest.fn() } as unknown as KernelApi;
    mount({ kernel, config: createConfig(), data: panelData('.x{color:red}'), host, shadow: fresh });
    expect([...fresh.querySelectorAll('style')].some((style) => style.textContent === '.x{color:red}')).toBe(true);
  });

  it('mount attaches the data when the kernel has no profiles yet and returns a dialog', () => {
    const { store, host } = setup();
    const fresh = document.createElement('div').attachShadow({ mode: 'open' });
    let profiles: ReturnType<typeof createProfiles> | null = null;
    const attachData = jest.fn((): void => {
      profiles = createProfiles(store, {});
    });
    const kernel = { store, profiles: () => profiles, attachData } as unknown as KernelApi;
    const { dialog } = mount({ kernel, config: createConfig(), data: panelData(''), host, shadow: fresh });
    expect(attachData).toHaveBeenCalledTimes(1);
    expect(typeof dialog.open).toBe('function');
  });

  it('reuses a launcher that is already in the shadow root without adding a second one', () => {
    document.body.innerHTML = '<div id="ka11y-root"></div>';
    const host = document.getElementById('ka11y-root') as HTMLElement;
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<button type="button" class="ka11y-launcher" aria-haspopup="dialog"></button>';
    const first = shadow.querySelector('.ka11y-launcher');
    const config = createConfig();
    const store = createStore();
    createPanel({
      config,
      store,
      profiles: createProfiles(store, config.profiles, config.features),
      hideToolbar: createHideToolbar({ host, key: config.storage.key }),
      host,
      shadow,
    });
    expect(shadow.querySelectorAll('.ka11y-launcher')).toHaveLength(1);
    expect(shadow.querySelector('.ka11y-launcher')).toBe(first);
  });

  it('is inert and aria-expanded=false when closed', () => {
    const { dialogEl, launcher } = setup();
    expect(dialogEl.hasAttribute('inert')).toBe(true);
    expect(launcher.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens from the launcher and moves focus into the panel', () => {
    const { dialogEl, launcher, shadow, store } = setup();
    launcher.click();
    expect(dialogEl.hasAttribute('inert')).toBe(false);
    expect(launcher.getAttribute('aria-expanded')).toBe('true');
    expect(store.getState().open).toBe(true);
    expect(dialogEl.contains(shadow.activeElement)).toBe(true);
  });

  it('closes on Escape and returns focus to the launcher', () => {
    const { dialogEl, launcher, shadow, store } = setup();
    launcher.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(dialogEl.hasAttribute('inert')).toBe(true);
    expect(store.getState().open).toBe(false);
    expect(shadow.activeElement).toBe(launcher);
  });

  it('returns focus to the opener passed to open, then to the launcher by default', () => {
    const { dialog, launcher } = (() => {
      const result = setup();
      return { dialog: result.panel.dialog, launcher: result.launcher };
    })();
    const opener = document.createElement('a');
    opener.href = '#';
    document.body.append(opener);
    dialog.open(opener);
    dialog.close();
    expect(document.activeElement).toBe(opener);
    opener.blur();
    dialog.open();
    dialog.close();
    expect(launcher.getRootNode()).toBeInstanceOf(ShadowRoot);
    expect((launcher.getRootNode() as ShadowRoot).activeElement).toBe(launcher);
  });

  it('falls back to the launcher when the opener left the document', () => {
    const { panel, launcher, shadow } = setup();
    const opener = document.createElement('button');
    document.body.append(opener);
    panel.dialog.toggle(opener);
    opener.remove();
    panel.dialog.toggle();
    expect(shadow.activeElement).toBe(launcher);
  });

  it('closes via the close button and returns focus', () => {
    const { shadow, launcher, dialogEl } = setup();
    launcher.click();
    (shadow.querySelector('.ka11y-close') as HTMLButtonElement).click();
    expect(dialogEl.hasAttribute('inert')).toBe(true);
    expect(shadow.activeElement).toBe(launcher);
  });

  it('opens and closes when store.open changes', () => {
    const { dialogEl, store } = setup();
    store.set({ open: true });
    expect(dialogEl.hasAttribute('inert')).toBe(false);
    store.set({ open: false });
    expect(dialogEl.hasAttribute('inert')).toBe(true);
  });

  it('hide menu hides the toolbar for session and for days', () => {
    const { shadow, host, dialogEl, launcher } = setup();
    launcher.click();
    const toggle = shadow.querySelector('.ka11y-hide-toggle') as HTMLButtonElement;
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const days = shadow.querySelectorAll('[data-days]');
    expect(days).toHaveLength(2);
    expect(days[0]?.textContent).toBe('hideToolbarDays 1 hideToolbarDaysUnit');
    (days[1] as HTMLButtonElement).click();
    expect(host.hidden).toBe(true);
    expect(dialogEl.hasAttribute('inert')).toBe(true);
    expect(localStorage.getItem('ka11y-hidden')).not.toBeNull();
  });

  describe('skip to content card', () => {
    const skipConfig = (): KotlinskidevA11yConfig =>
      createConfig({ features: { skipToContent: { enabled: true, default: false } } });

    const select = (shadow: ShadowRoot): HTMLSelectElement => shadow.querySelector('.ka11y-select') as HTMLSelectElement;
    const card = (shadow: ShadowRoot): HTMLElement => select(shadow).closest('.ka11y-card') as HTMLElement;

    it('is absent when the feature is disabled or its section is off', () => {
      expect(setup(createConfig()).shadow.querySelector('.ka11y-select')).toBeNull();
      const off = setupWith(skipConfig(), dataWith({ sections: { profiles: true, content: true, color: true, orientation: true, skip: false } }));
      expect(off.shadow.querySelector('.ka11y-select')).toBeNull();
    });

    it('never renders as a tile', () => {
      const { shadow } = setup(skipConfig());
      expect(toggleOf(shadow, 'skipToContent')).toBeNull();
    });

    it('is hidden when no landmark exists', () => {
      const { panel } = setup(skipConfig());
      panel.dialog.open();
      expect(card(document.getElementById('ka11y-root')?.shadowRoot as ShadowRoot).hidden).toBe(true);
    });

    it('lists the landmarks found on open and focuses the chosen one', () => {
      const { shadow, panel } = setup(skipConfig());
      document.body.insertAdjacentHTML('beforeend', '<main id="m">m</main><footer id="f">f</footer>');
      panel.dialog.open();
      expect(card(shadow).hidden).toBe(false);
      const values = [...select(shadow).options].map((option) => option.value);
      expect(values).toEqual(['', 'main', 'footer']);
      expect(select(shadow).options[0]?.textContent).toBe('skipChoose');
      select(shadow).value = 'footer';
      select(shadow).dispatchEvent(new Event('change'));
      expect(document.activeElement).toBe(document.getElementById('f'));
      expect(select(shadow).value).toBe('');
    });

    it('does not change the feature level', () => {
      const { shadow, panel, store } = setup(skipConfig());
      document.body.insertAdjacentHTML('beforeend', '<main id="m">m</main>');
      panel.dialog.open();
      select(shadow).value = 'main';
      select(shadow).dispatchEvent(new Event('change'));
      expect(store.getState().levels.skipToContent).toBeUndefined();
    });
  });

  describe('open and close announcements', () => {
    it('dispatches ka11y:open and ka11y:close on document', () => {
      const { panel } = setup();
      const seen: string[] = [];
      const record = (event: Event): void => {
        seen.push(`${event.type}:${(event as CustomEvent).detail.source}`);
      };
      document.addEventListener('ka11y:open', record);
      document.addEventListener('ka11y:close', record);
      panel.dialog.open();
      panel.dialog.open();
      panel.dialog.close();
      document.removeEventListener('ka11y:open', record);
      document.removeEventListener('ka11y:close', record);
      expect(seen).toEqual(['ka11y:open:panel', 'ka11y:close:panel']);
    });

    it('does not bubble or cancel', () => {
      const { panel } = setup();
      let received: Event | null = null;
      const record = (event: Event): void => {
        received = event;
      };
      document.addEventListener('ka11y:open', record);
      panel.dialog.open();
      document.removeEventListener('ka11y:open', record);
      expect((received as unknown as Event).bubbles).toBe(false);
      expect((received as unknown as Event).cancelable).toBe(false);
    });

    it('syncs aria-expanded on open and toggle triggers, including late ones', () => {
      const { panel } = setup();
      document.body.insertAdjacentHTML(
        'beforeend',
        '<a data-ka11y="toggle" aria-controls="ka11y-root" aria-expanded="false"></a><button data-ka11y="close" aria-controls="ka11y-root"></button>'
      );
      const trigger = document.querySelector('[data-ka11y="toggle"]') as HTMLElement;
      const closer = document.querySelector('[data-ka11y="close"]') as HTMLElement;
      panel.dialog.open();
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      expect(closer.hasAttribute('aria-expanded')).toBe(false);
      panel.dialog.close();
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });
  });
});
