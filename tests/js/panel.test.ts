import { createHideToolbar } from '../../src/ts/frontend/hide-toolbar';
import { createPanel, type Panel } from '../../src/ts/frontend/panel';
import { createProfiles } from '../../src/ts/frontend/profiles';
import { createStore, type Store } from '../../src/ts/frontend/store';
import type { KotlinskidevA11yConfig } from '../../src/ts/shared/types';
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

const toggleOf = (shadow: ShadowRoot, key: string): HTMLButtonElement =>
  shadow.querySelector(`[data-feature="${key}"]`) as HTMLButtonElement;

describe('panel', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('moves the launcher into the shadow root and renders dialog semantics', () => {
    const { host, shadow, dialogEl, launcher } = setup();
    expect(host.querySelector('.ka11y-launcher')).toBeNull();
    expect(launcher.getAttribute('aria-haspopup')).toBe('dialog');
    expect(dialogEl.getAttribute('aria-modal')).toBe('true');
    const titleId = dialogEl.getAttribute('aria-labelledby') ?? '';
    expect(shadow.getElementById(titleId)?.textContent).toBe('Accessibility settings');
  });

  it('renders toggles only for enabled configured features', () => {
    const { shadow } = setup();
    expect(toggleOf(shadow, 'biggerText')).not.toBeNull();
    expect(toggleOf(shadow, 'highlightLinks')).not.toBeNull();
    expect(toggleOf(shadow, 'saturation')).not.toBeNull();
    expect(toggleOf(shadow, 'hideImages')).toBeNull();
    expect(toggleOf(shadow, 'biggerText').textContent).toContain('Bigger text');
  });

  it('groups toggles', () => {
    const { shadow } = setup();
    const titles = [...shadow.querySelectorAll('.ka11y-group__title')].map((node) => node.textContent);
    expect(titles).toEqual(['groupContent', 'groupColor']);
  });

  it('falls back to the key for unknown strings', () => {
    const config = createConfig({ strings: {} });
    const { shadow } = setup(config);
    expect(shadow.querySelector('.ka11y-title')?.textContent).toBe('panelTitle');
  });

  it('updates aria-pressed for boolean toggles', () => {
    const { shadow } = setup();
    const button = toggleOf(shadow, 'highlightLinks');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    button.click();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.querySelector('.ka11y-toggle__state')?.textContent).toBe('On');
    button.click();
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('cycles multi-level features and shows the level', () => {
    const { shadow, store } = setup();
    const button = toggleOf(shadow, 'biggerText');
    const state = (): string | null | undefined => button.querySelector('.ka11y-toggle__state')?.textContent;
    expect(state()).toBe('Off');
    button.click();
    expect(state()).toBe('Low');
    button.click();
    expect(state()).toBe('Medium');
    button.click();
    expect(state()).toBe('High');
    expect(store.getState().levels.biggerText).toBe(3);
    button.click();
    expect(state()).toBe('Off');
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('reset button clears state', () => {
    const { shadow, store } = setup();
    toggleOf(shadow, 'highlightLinks').click();
    (shadow.querySelector('.ka11y-reset') as HTMLButtonElement).click();
    expect(store.getState().levels).toEqual({});
    expect(toggleOf(shadow, 'highlightLinks').getAttribute('aria-pressed')).toBe('false');
  });

  it('renders profiles that drive features', () => {
    const { shadow, store } = setup();
    const profile = shadow.querySelector('[data-profile="visionImpaired"]') as HTMLButtonElement;
    expect(profile.getAttribute('aria-pressed')).toBe('false');
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

  it('shows statement link and shortcut hint', () => {
    const { shadow } = setup();
    expect(shadow.querySelector('.ka11y-link')?.getAttribute('href')).toBe('https://example.test/statement');
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
    expect(shadow.querySelector('.ka11y-hide')).toBeNull();
  });

  it('injects widget and custom styles into the shadow root', () => {
    const { shadow } = setup();
    expect([...shadow.querySelectorAll('style')].some((style) => style.textContent === '.x{color:red}')).toBe(true);
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

  it('traps Tab inside the panel', () => {
    const { dialogEl, launcher, shadow } = setup();
    launcher.click();
    const focusable = [...dialogEl.querySelectorAll<HTMLElement>('button, a[href]')].filter(
      (element) => element.closest('[hidden]') === null
    );
    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;
    last.focus();
    const forward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(forward);
    expect(forward.defaultPrevented).toBe(true);
    expect(shadow.activeElement).toBe(first);
    const backward = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    document.dispatchEvent(backward);
    expect(shadow.activeElement).toBe(last);
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

  describe('skip to content control', () => {
    const skipConfig = (): KotlinskidevA11yConfig =>
      createConfig({ features: { skipToContent: { enabled: true, default: false } } });

    const select = (shadow: ShadowRoot): HTMLSelectElement => shadow.querySelector('.ka11y-select') as HTMLSelectElement;
    const wrapper = (shadow: ShadowRoot): HTMLElement => shadow.querySelector('.ka11y-skip') as HTMLElement;

    it('is absent when the feature is disabled', () => {
      const { shadow } = setup(createConfig());
      expect(shadow.querySelector('.ka11y-skip')).toBeNull();
    });

    it('stays hidden until the feature is on and a landmark exists', () => {
      const { shadow, store } = setup(skipConfig());
      store.setLevel('skipToContent', true);
      expect(wrapper(shadow).hidden).toBe(true);
    });

    it('lists only landmarks present and focuses the chosen one', () => {
      const { shadow, store } = setup(skipConfig());
      document.body.insertAdjacentHTML('beforeend', '<main id="m">m</main><footer id="f">f</footer>');
      store.setLevel('skipToContent', true);
      expect(wrapper(shadow).hidden).toBe(false);
      const values = [...select(shadow).options].map((option) => option.value);
      expect(values).toEqual(['', 'main', 'footer']);
      select(shadow).value = 'footer';
      select(shadow).dispatchEvent(new Event('change'));
      expect(document.activeElement).toBe(document.getElementById('f'));
      expect(select(shadow).value).toBe('');
    });

    it('hides again when the feature is turned off', () => {
      const { shadow, store } = setup(skipConfig());
      document.body.insertAdjacentHTML('beforeend', '<main>m</main>');
      store.setLevel('skipToContent', true);
      expect(wrapper(shadow).hidden).toBe(false);
      store.setLevel('skipToContent', false);
      expect(wrapper(shadow).hidden).toBe(true);
    });
  });
});
