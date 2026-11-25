import type { KotlinskidevA11yConfig, PanelData } from "../shared/types";
import { createDialog, type Dialog } from "./a11y-dialog";
import { createElement } from "./dom";
import type { HideToolbar } from "./hide-toolbar";
import type { Profiles } from "./profiles";
import type { Store, StoreState } from "./store";
import { buildCards, type Cards } from "./panel/cards";
import type { PanelContext } from "./panel/context";
import { buildFooter } from "./panel/footer";
import { buildHeader, PANEL_TITLE_ID } from "./panel/header";
import {
  fetchLocaleStrings,
  LANGUAGE_SELECT_ID,
  readSavedLocale,
  writeSavedLocale,
} from "./panel/language";
import { createIconFactory } from "./panel/icons";
import { createPanelLayout } from "./panel/layout";
import { buildSkipCard, type SkipCard } from "./panel/skip";
import { createTranslator } from "./translate";

export type PanelDataSlice = Pick<PanelData, "panel" | "icons"> &
  Partial<Pick<PanelData, "locales">>;

export interface PanelOptions {
  config: KotlinskidevA11yConfig;
  store: Store;
  profiles: Profiles;
  hideToolbar: HideToolbar;
  host: HTMLElement;
  shadow: ShadowRoot;
  doc?: Document;
  sheetQuery?: string;
  data?: PanelDataSlice;
}

export interface Panel {
  dialog: Dialog;
  destroy(): void;
}

const PANEL_ID = "ka11y-panel";
const EXPANDED_TRIGGERS = '[aria-controls="ka11y-root"][aria-expanded]';
const LAUNCHER_SELECTOR = ".ka11y-launcher";
const SKIP_FEATURE_KEY = "skipToContent";

const DEFAULT_DATA: PanelDataSlice = {
  panel: {
    columns: 3,
    sections: {
      profiles: true,
      content: true,
      color: true,
      orientation: true,
      skip: true,
    },
    languageSwitcher: true,
  },
  icons: {},
};

const resolveLauncher = (
  host: HTMLElement,
  shadow: ShadowRoot,
  doc: Document,
  label: string,
): HTMLButtonElement => {
  const inShadow = shadow.querySelector<HTMLButtonElement>(LAUNCHER_SELECTOR);
  if (inShadow) return inShadow;
  const launcher =
    host.querySelector<HTMLButtonElement>(LAUNCHER_SELECTOR) ??
    createElement(doc, "button", {
      type: "button",
      class: "ka11y-launcher",
      "aria-label": label,
      "aria-haspopup": "dialog",
    });
  shadow.append(launcher);
  return launcher;
};

export const createPanel = ({
  config,
  store,
  profiles,
  hideToolbar,
  host,
  shadow,
  doc = document,
  sheetQuery,
  data = DEFAULT_DATA,
}: PanelOptions): Panel => {
  const listeners: Array<() => void> = [];
  const listen = (
    target: EventTarget,
    type: string,
    handler: EventListener,
  ): void => {
    target.addEventListener(type, handler);
    listeners.push(() => target.removeEventListener(type, handler));
  };
  const { panel: panelConfig, locales = [] } = data;
  const localeKey = `${config.storage.key}-locale`;
  const showLanguage = panelConfig.languageSwitcher && locales.length > 1;
  let current = config.locale;
  let cards: Cards = { elements: [], controls: [] };
  let skip: SkipCard | null = null;

  const launcher = resolveLauncher(
    host,
    shadow,
    doc,
    createTranslator(config.strings)("open"),
  );
  const panel = createElement(doc, "div", {
    id: PANEL_ID,
    class: "ka11y-panel",
    role: "dialog",
    "aria-labelledby": PANEL_TITLE_ID,
    "data-columns": String(panelConfig.columns),
  });

  const switchLocale = async (locale: string): Promise<boolean> => {
    const strings = await fetchLocaleStrings(
      config.data?.[1],
      locale,
      doc.baseURI,
    );
    if (strings === null) {
      const status = panel.querySelector('[role="status"]');
      if (status)
        status.textContent = createTranslator(config.strings)("loadError");
      return false;
    }
    current = locale;
    writeSavedLocale(localeKey, locale);
    host.lang = locale.split("_")[0] as string;
    host.dir = locales.find((item) => item.locale === locale)?.rtl
      ? "rtl"
      : "ltr";
    build(strings);
    render(store.getState());
    if (dialog.isOpen()) skip?.refresh();
    panel.querySelector<HTMLElement>(`#${LANGUAGE_SELECT_ID}`)?.focus();
    return true;
  };

  const build = (strings: Record<string, string>): void => {
    listeners.splice(0).forEach((remove) => remove());
    const ctx: PanelContext = {
      doc,
      t: createTranslator(strings),
      icon: createIconFactory(doc, data.icons),
      store,
      listen,
    };
    const header = buildHeader(ctx, {
      config,
      hideToolbar,
      onClose: () => dialog.close(),
      language: showLanguage
        ? { locales, current, onSwitch: switchLocale }
        : undefined,
    });
    cards = buildCards(ctx, config.features, profiles, panelConfig.sections);
    skip =
      config.features[SKIP_FEATURE_KEY]?.enabled === true &&
      panelConfig.sections.skip
        ? buildSkipCard(ctx, `features.${SKIP_FEATURE_KEY}.label`)
        : null;
    const body = createElement(doc, "div", { class: "ka11y-body" }, [
      ...cards.elements,
      ...(skip ? [skip.element] : []),
    ]);
    panel.replaceChildren(header.element, body, buildFooter(ctx, config));
  };

  build(config.strings);

  const announce = (open: boolean): void => {
    doc
      .querySelectorAll(EXPANDED_TRIGGERS)
      .forEach((trigger) =>
        trigger.setAttribute("aria-expanded", String(open)),
      );
    doc.dispatchEvent(
      new CustomEvent(open ? "ka11y:open" : "ka11y:close", {
        detail: { source: "panel" },
      }),
    );
  };

  const onChange = (open: boolean): void => {
    if (open) {
      layout.place();
      skip?.refresh();
    }
    if (store.getState().open !== open) store.set({ open });
    announce(open);
  };

  const layout = createPanelLayout({
    panel,
    host,
    sheetQuery: sheetQuery ?? "",
    win: doc.defaultView ?? window,
  });
  const dialog = createDialog({ panel, launcher, shadow, doc, onChange });
  shadow.append(panel);

  const render = (state: StoreState): void => {
    cards.controls.forEach((control) => control.update(state));
    if (state.open && !dialog.isOpen()) dialog.open();
    if (!state.open && dialog.isOpen()) dialog.close();
  };

  const onStateChange = (state: StoreState): void => render(state);
  const unsubscribe = store.subscribe(onStateChange);
  render(store.getState());

  const saved = showLanguage ? readSavedLocale(localeKey) : null;
  if (saved !== null && !locales.some((item) => item.locale === saved))
    writeSavedLocale(localeKey, null);
  else if (saved !== null && saved !== current) void switchLocale(saved);

  const destroy = (): void => {
    unsubscribe();
    listeners.forEach((remove) => remove());
    dialog.destroy();
    layout.destroy();
  };

  return { dialog, destroy };
};
