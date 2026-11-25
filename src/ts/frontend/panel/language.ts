import type { PanelData, PanelLocale } from "../../shared/types";
import { createElement } from "../dom";
import type { PanelContext } from "./context";

export const LANGUAGE_SELECT_ID = "ka11y-lang";

export interface LanguageOptions {
  locales: PanelLocale[];
  current: string;
  onSwitch(locale: string): Promise<boolean>;
}

const languageOf = (locale: string): string => locale.split("_")[0] as string;

export const buildLanguageSelect = (
  ctx: PanelContext,
  { locales, current, onSwitch }: LanguageOptions,
): HTMLElement[] => {
  const { doc, t } = ctx;
  const select = createElement(
    doc,
    "select",
    { id: LANGUAGE_SELECT_ID, class: "ka11y-lang" },
    locales.map(({ locale, label }) =>
      createElement(
        doc,
        "option",
        { value: locale, lang: languageOf(locale) },
        [label],
      ),
    ),
  );
  select.value = current;
  const onChange = (): void => {
    const chosen = select.value;
    void onSwitch(chosen).then((ok) => {
      if (!ok) select.value = current;
    });
  };
  ctx.listen(select, "change", onChange);
  return [
    createElement(
      doc,
      "label",
      { class: "ka11y-sr", for: LANGUAGE_SELECT_ID },
      [t("language")],
    ),
    select,
  ];
};

export const localeUrl = (
  base: string,
  locale: string,
  origin: string,
): string => {
  const url = new URL(base, origin);
  url.searchParams.set("locale", locale);
  url.searchParams.delete("v");
  return url.href;
};

export const fetchLocaleStrings = async (
  base: string | undefined,
  locale: string,
  origin: string,
): Promise<Record<string, string> | null> => {
  try {
    const response = await fetch(localeUrl(base as string, locale, origin), {
      credentials: "same-origin",
    });
    return response.ok ? ((await response.json()) as PanelData).strings : null;
  } catch {
    return null;
  }
};

export const readSavedLocale = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const writeSavedLocale = (key: string, locale: string | null): void => {
  try {
    if (locale === null) localStorage.removeItem(key);
    else localStorage.setItem(key, locale);
  } catch {
    return;
  }
};
