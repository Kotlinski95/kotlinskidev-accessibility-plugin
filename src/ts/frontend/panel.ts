import type { FeatureLevel, KotlinskidevA11yConfig } from '../shared/types';
import { createDialog, type Dialog } from './a11y-dialog';
import { createElement } from './dom';
import { FEATURE_GROUPS, FEATURE_LEVEL_LABELS, levelCountOf } from './feature-groups';
import { findLandmarks, focusLandmark, type Landmark, type LandmarkKind } from './features/color-orientation/landmarks';
import { isLevelActive } from './feature-utils';
import type { HideToolbar } from './hide-toolbar';
import type { Profiles } from './profiles';
import type { Store, StoreState } from './store';
import { createTranslator, type Translator } from './translate';

export interface PanelOptions {
  config: KotlinskidevA11yConfig;
  store: Store;
  profiles: Profiles;
  hideToolbar: HideToolbar;
  host: HTMLElement;
  shadow: ShadowRoot;
  doc?: Document;
}

export interface Panel {
  dialog: Dialog;
  destroy(): void;
}

interface FeatureControl {
  key: string;
  button: HTMLButtonElement;
  stateLabel: HTMLElement;
}

interface ProfileControl {
  key: string;
  button: HTMLButtonElement;
}

const PANEL_ID = 'ka11y-panel';
const TITLE_ID = 'ka11y-panel-title';
const LAUNCHER_SELECTOR = '.ka11y-launcher';
const SKIP_FEATURE_KEY = 'skipToContent';
const SKIP_SELECT_ID = 'ka11y-skip-select';

const LANDMARK_LABEL_KEYS: Readonly<Record<LandmarkKind, string>> = {
  main: 'landmarkMain',
  navigation: 'landmarkNavigation',
  footer: 'landmarkFooter',
};

const firstLandmarkPerKind = (landmarks: Landmark[]): Landmark[] =>
  landmarks.filter((landmark, index) => landmarks.findIndex((other) => other.kind === landmark.kind) === index);

const nextLevel = (key: string, current: FeatureLevel | undefined): FeatureLevel => {
  const count = levelCountOf(key);
  if (count === 1) return !isLevelActive(current);
  const value = typeof current === 'number' ? current : 0;
  return value >= count ? 0 : value + 1;
};

const resolveLauncher = (host: HTMLElement, shadow: ShadowRoot, doc: Document, label: string): HTMLButtonElement => {
  const inShadow = shadow.querySelector<HTMLButtonElement>(LAUNCHER_SELECTOR);
  if (inShadow) return inShadow;
  const launcher =
    host.querySelector<HTMLButtonElement>(LAUNCHER_SELECTOR) ??
    createElement(doc, 'button', { type: 'button', class: 'ka11y-launcher', 'aria-label': label, 'aria-haspopup': 'dialog' });
  shadow.append(launcher);
  return launcher;
};

export const createPanel = ({ config, store, profiles, hideToolbar, host, shadow, doc = document }: PanelOptions): Panel => {
  const t: Translator = createTranslator(config.strings);
  const featureControls: FeatureControl[] = [];
  const profileControls: ProfileControl[] = [];
  const listeners: Array<() => void> = [];
  let skipRefresh: () => void = () => undefined;

  const listen = (target: EventTarget, type: string, handler: EventListener): void => {
    target.addEventListener(type, handler);
    listeners.push(() => target.removeEventListener(type, handler));
  };

  const levelText = (key: string, level: FeatureLevel | undefined): string => {
    if (!isLevelActive(level)) return t('levelOff');
    const labels = FEATURE_LEVEL_LABELS[key];
    if (typeof level === 'number' && labels) return t(labels[level - 1] ?? 'levelOn');
    return t('levelOn');
  };

  const buildFeature = (key: string): HTMLElement => {
    const descriptionId = `ka11y-desc-${key}`;
    const stateLabel = createElement(doc, 'span', { class: 'ka11y-toggle__state' });
    const button = createElement(
      doc,
      'button',
      { type: 'button', class: 'ka11y-toggle', 'aria-pressed': 'false', 'aria-describedby': descriptionId, 'data-feature': key },
      [
        createElement(doc, 'span', { class: 'ka11y-toggle__label' }, [t(`features.${key}.label`)]),
        stateLabel,
      ]
    );
    const description = createElement(doc, 'span', { class: 'ka11y-toggle__description', id: descriptionId }, [
      t(`features.${key}.description`),
    ]);
    const onFeatureClick = (): void => store.setLevel(key, nextLevel(key, store.getState().levels[key]));
    listen(button, 'click', onFeatureClick);
    featureControls.push({ key, button, stateLabel });
    return createElement(doc, 'div', { class: 'ka11y-feature' }, [button, description]);
  };

  const buildGroup = (titleKey: string, groupId: string, keys: readonly string[]): HTMLElement | null => {
    const enabled = keys.filter((key) => config.features[key]?.enabled === true);
    if (enabled.length === 0) return null;
    const titleId = `ka11y-group-${groupId}`;
    return createElement(doc, 'section', { class: 'ka11y-group', 'aria-labelledby': titleId }, [
      createElement(doc, 'h4', { class: 'ka11y-group__title', id: titleId }, [t(titleKey)]),
      createElement(doc, 'div', { class: 'ka11y-grid' }, enabled.map(buildFeature)),
    ]);
  };

  const buildProfiles = (): HTMLElement | null => {
    const keys = profiles.keys();
    if (keys.length === 0) return null;
    const buttons = keys.map((key) => {
      const button = createElement(
        doc,
        'button',
        { type: 'button', class: 'ka11y-profile', 'aria-pressed': 'false', 'data-profile': key },
        [t(`profiles.${key}`)]
      );
      const onProfileClick = (): void => profiles.toggle(key);
      listen(button, 'click', onProfileClick);
      profileControls.push({ key, button });
      return button;
    });
    return createElement(doc, 'section', { class: 'ka11y-section', 'aria-labelledby': 'ka11y-profiles-title' }, [
      createElement(doc, 'h3', { class: 'ka11y-section__title', id: 'ka11y-profiles-title' }, [t('profilesTitle')]),
      createElement(doc, 'div', { class: 'ka11y-profiles' }, buttons),
    ]);
  };

  const buildFeatures = (): HTMLElement | null => {
    const groups = FEATURE_GROUPS.map((group) => buildGroup(group.titleKey, group.id, group.features)).filter(
      (group): group is HTMLElement => group !== null
    );
    if (groups.length === 0) return null;
    return createElement(doc, 'section', { class: 'ka11y-section', 'aria-labelledby': 'ka11y-features-title' }, [
      createElement(doc, 'h3', { class: 'ka11y-section__title', id: 'ka11y-features-title' }, [t('featuresTitle')]),
      ...groups,
    ]);
  };

  const buildSkipControl = (): HTMLElement | null => {
    if (config.features[SKIP_FEATURE_KEY]?.enabled !== true) return null;
    const select = createElement(doc, 'select', { id: SKIP_SELECT_ID, class: 'ka11y-select' });
    const wrapper = createElement(doc, 'div', { class: 'ka11y-skip', hidden: true }, [
      createElement(doc, 'label', { class: 'ka11y-skip__label', for: SKIP_SELECT_ID }, [t(`features.${SKIP_FEATURE_KEY}.label`)]),
      select,
    ]);
    let landmarks: Landmark[] = [];
    const onSkipChange = (): void => {
      const landmark = landmarks.find((item) => item.kind === select.value);
      select.value = '';
      if (landmark) focusLandmark(landmark);
    };
    listen(select, 'change', onSkipChange);
    const refresh = (): void => {
      const active = isLevelActive(store.getState().levels[SKIP_FEATURE_KEY]);
      landmarks = active ? firstLandmarkPerKind(findLandmarks(doc)) : [];
      const options = landmarks.map((landmark) =>
        createElement(doc, 'option', { value: landmark.kind }, [t(LANDMARK_LABEL_KEYS[landmark.kind])])
      );
      select.replaceChildren(createElement(doc, 'option', { value: '' }, [t(`features.${SKIP_FEATURE_KEY}.label`)]), ...options);
      wrapper.hidden = options.length === 0;
    };
    skipRefresh = refresh;
    return wrapper;
  };

  const buildHideMenu = (onHide: () => void): HTMLElement | null => {
    if (!config.hideToolbar.allow) return null;
    const menu = createElement(doc, 'div', { class: 'ka11y-hide-menu', id: 'ka11y-hide-menu', hidden: true });
    const toggle = createElement(
      doc,
      'button',
      { type: 'button', class: 'ka11y-action ka11y-hide-toggle', 'aria-expanded': 'false', 'aria-controls': 'ka11y-hide-menu' },
      [t('hideToolbar')]
    );
    const onHideToggleClick = (): void => {
      menu.hidden = !menu.hidden;
      toggle.setAttribute('aria-expanded', String(!menu.hidden));
    };
    listen(toggle, 'click', onHideToggleClick);
    const sessionButton = createElement(doc, 'button', { type: 'button', class: 'ka11y-action' }, [t('hideToolbarSession')]);
    const onSessionClick = (): void => {
      onHide();
      hideToolbar.hideForSession();
    };
    listen(sessionButton, 'click', onSessionClick);
    menu.append(sessionButton);
    config.hideToolbar.days.forEach((days) => {
      const button = createElement(doc, 'button', { type: 'button', class: 'ka11y-action', 'data-days': String(days) }, [
        `${t('hideToolbarDays')} ${days} ${t('hideToolbarDaysUnit')}`,
      ]);
      const onDaysClick = (): void => {
        onHide();
        hideToolbar.hideForDays(days);
      };
      listen(button, 'click', onDaysClick);
      menu.append(button);
    });
    return createElement(doc, 'div', { class: 'ka11y-hide' }, [toggle, menu]);
  };

  const buildFooter = (onHide: () => void): HTMLElement => {
    const reset = createElement(doc, 'button', { type: 'button', class: 'ka11y-action ka11y-reset' }, [t('reset')]);
    const onResetClick = (): void => store.reset();
    listen(reset, 'click', onResetClick);
    const footer = createElement(doc, 'footer', { class: 'ka11y-footer' }, [reset]);
    const hideMenu = buildHideMenu(onHide);
    if (hideMenu) footer.append(hideMenu);
    if (config.statementUrl !== '') {
      footer.append(createElement(doc, 'a', { class: 'ka11y-link', href: config.statementUrl }, [t('statementLink')]));
    }
    if (config.shortcut.enabled) {
      footer.append(createElement(doc, 'p', { class: 'ka11y-hint' }, [`${t('shortcutHint')}: ${config.shortcut.combo}`]));
    }
    return footer;
  };

  const placePanel = (panel: HTMLElement): void => {
    const rect = host.getBoundingClientRect();
    const win = doc.defaultView ?? window;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    panel.dataset.horizontal = centerX < win.innerWidth / 2 ? 'left' : 'right';
    if (centerY < win.innerHeight / 3) panel.dataset.vertical = 'down';
    else if (centerY > (win.innerHeight * 2) / 3) panel.dataset.vertical = 'up';
    else panel.dataset.vertical = 'middle';
  };

  const launcher = resolveLauncher(host, shadow, doc, t('open'));

  const closeButton = createElement(doc, 'button', { type: 'button', class: 'ka11y-close', 'aria-label': t('close') }, [
    createElement(doc, 'span', { 'aria-hidden': 'true' }, ['×']),
  ]);
  const content = createElement(doc, 'div', { class: 'ka11y-body' });
  const panel = createElement(
    doc,
    'div',
    { id: PANEL_ID, class: 'ka11y-panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': TITLE_ID },
    [
      createElement(doc, 'header', { class: 'ka11y-header' }, [
        createElement(doc, 'h2', { class: 'ka11y-title', id: TITLE_ID }, [t('panelTitle')]),
        closeButton,
      ]),
      content,
    ]
  );

  const onChange = (open: boolean): void => {
    if (open) {
      placePanel(panel);
      skipRefresh();
    }
    if (store.getState().open !== open) store.set({ open });
  };

  const dialog = createDialog({ panel, launcher, shadow, doc, onChange });

  const onCloseClick = (): void => dialog.close();
  listen(closeButton, 'click', onCloseClick);

  [buildProfiles(), buildFeatures(), buildSkipControl()].forEach((section) => {
    if (section) content.append(section);
  });
  content.append(buildFooter(() => dialog.close()));
  shadow.append(panel);

  const render = (state: StoreState): void => {
    featureControls.forEach(({ key, button, stateLabel }) => {
      const level = state.levels[key];
      button.setAttribute('aria-pressed', String(isLevelActive(level)));
      stateLabel.textContent = levelText(key, level);
    });
    profileControls.forEach(({ key, button }) => {
      button.setAttribute('aria-pressed', String(profiles.isActive(key)));
    });
    skipRefresh();
    if (state.open && !dialog.isOpen()) dialog.open();
    if (!state.open && dialog.isOpen()) dialog.close();
  };

  const onStateChange = (state: StoreState): void => render(state);
  const unsubscribe = store.subscribe(onStateChange);
  render(store.getState());

  const destroy = (): void => {
    unsubscribe();
    listeners.forEach((remove) => remove());
    dialog.destroy();
  };

  return { dialog, destroy };
};
