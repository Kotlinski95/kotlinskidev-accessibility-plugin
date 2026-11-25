import { createHideToolbar } from "../../src/ts/frontend/hide-toolbar";
import { createPanel, type PanelDataSlice } from "../../src/ts/frontend/panel";
import { createProfiles } from "../../src/ts/frontend/profiles";
import { createStore } from "../../src/ts/frontend/store";
import type {
  KotlinskidevA11yConfig,
  PanelLocale,
} from "../../src/ts/shared/types";
import { createConfig } from "./helpers";

const LOCALES: PanelLocale[] = [
  { locale: "en_US", label: "English", rtl: false },
  { locale: "pl_PL", label: "Polski", rtl: false },
  { locale: "he_IL", label: "עברית", rtl: true },
];

const dataWith = (
  locales: PanelLocale[],
  languageSwitcher = true,
): PanelDataSlice => ({
  panel: {
    columns: 3,
    sections: {
      profiles: true,
      content: true,
      color: true,
      orientation: true,
      skip: true,
    },
    languageSwitcher,
  },
  icons: {},
  locales,
});

const setup = (
  data: PanelDataSlice,
  config: KotlinskidevA11yConfig = createConfig({
    data: [
      "https://example.test/a.json",
      "https://example.test/wp-json/ka11y/v1/panel-data?v=abc",
    ],
  }),
) => {
  document.body.innerHTML =
    '<div id="ka11y-root"><button type="button" class="ka11y-launcher"></button></div>';
  const host = document.getElementById("ka11y-root") as HTMLElement;
  const shadow = host.attachShadow({ mode: "open" });
  const store = createStore();
  const profiles = createProfiles(store, config.profiles, config.features);
  const hideToolbar = createHideToolbar({ host, key: config.storage.key });
  const panel = createPanel({
    config,
    store,
    profiles,
    hideToolbar,
    host,
    shadow,
    data,
  });
  return { host, shadow, panel };
};

const select = (shadow: ShadowRoot): HTMLSelectElement | null =>
  shadow.querySelector("#ka11y-lang");

const title = (shadow: ShadowRoot): string =>
  shadow.querySelector(".ka11y-title")?.textContent ?? "";

const respond = (strings: Record<string, string>): jest.Mock =>
  jest
    .fn()
    .mockResolvedValue({ ok: true, json: () => Promise.resolve({ strings }) });

const choose = async (shadow: ShadowRoot, value: string): Promise<void> => {
  const field = select(shadow) as HTMLSelectElement;
  field.value = value;
  field.dispatchEvent(new Event("change"));
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe("panel language switcher", () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = jest.fn();
  });

  it("renders a labelled select with per-option lang", () => {
    const { shadow } = setup(dataWith(LOCALES));
    const field = select(shadow) as HTMLSelectElement;
    expect([...field.options].map((option) => option.textContent)).toEqual([
      "English",
      "Polski",
      "עברית",
    ]);
    expect(field.options[1]?.lang).toBe("pl");
    expect(field.value).toBe("en_US");
    expect(shadow.querySelector('label[for="ka11y-lang"]')).not.toBeNull();
  });

  it("is absent with fewer than two locales or when disabled", () => {
    expect(
      select(setup(dataWith([LOCALES[0] as PanelLocale])).shadow),
    ).toBeNull();
    expect(select(setup(dataWith(LOCALES, false)).shadow)).toBeNull();
    expect(
      select(setup({ ...dataWith([]), locales: undefined }).shadow),
    ).toBeNull();
  });

  it("requests the REST url with locale set and v removed", async () => {
    const fetchMock = respond({ panelTitle: "Ustawienia" });
    global.fetch = fetchMock;
    const { shadow } = setup(dataWith(LOCALES));
    await choose(shadow, "pl_PL");
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get("locale")).toBe("pl_PL");
    expect(url.searchParams.has("v")).toBe(false);
    expect(fetchMock.mock.calls[0][1]).toEqual({ credentials: "same-origin" });
  });

  it("rebuilds strings, sets lang and dir, saves the choice and focuses the select", async () => {
    global.fetch = respond({ panelTitle: "Ustawienia", language: "Język" });
    const { host, shadow } = setup(dataWith(LOCALES));
    await choose(shadow, "he_IL");
    expect(title(shadow)).toBe("Ustawienia");
    expect(host.lang).toBe("he");
    expect(host.dir).toBe("rtl");
    expect(localStorage.getItem("ka11y-locale")).toBe("he_IL");
    expect(select(shadow)?.value).toBe("he_IL");
    expect(shadow.activeElement).toBe(select(shadow));
  });

  it("restores the select and writes loadError on failure", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    const config = createConfig({ data: ["a", "https://example.test/r?v=1"] });
    config.strings.loadError = "Load failed";
    const { host, shadow } = setup(dataWith(LOCALES), config);
    await choose(shadow, "pl_PL");
    expect(select(shadow)?.value).toBe("en_US");
    expect(shadow.querySelector('[role="status"]')?.textContent).toBe(
      "Load failed",
    );
    expect(localStorage.getItem("ka11y-locale")).toBeNull();
    expect(host.dir).toBe("");
  });

  it("fetches a saved locale on mount", async () => {
    localStorage.setItem("ka11y-locale", "pl_PL");
    const fetchMock = respond({ panelTitle: "Ustawienia" });
    global.fetch = fetchMock;
    const { shadow } = setup(dataWith(LOCALES));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(title(shadow)).toBe("Ustawienia");
    expect(select(shadow)?.value).toBe("pl_PL");
  });

  it("removes an unknown saved locale without fetching", () => {
    localStorage.setItem("ka11y-locale", "xx_XX");
    setup(dataWith(LOCALES));
    expect(localStorage.getItem("ka11y-locale")).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
