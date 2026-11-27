import { createHideToolbar } from "../../src/ts/frontend/hide-toolbar";
import { createPanel, type PanelDataSlice } from "../../src/ts/frontend/panel";
import { createProfiles } from "../../src/ts/frontend/profiles";
import { createStore } from "../../src/ts/frontend/store";
import { createConfig } from "./helpers";

const credit = { name: "Jane Doe", url: "https://example.test/jane" };

const render = (
  withCredit: boolean,
  template = "Developed by %s",
): ShadowRoot => {
  document.body.innerHTML =
    '<div id="ka11y-root"><button type="button" class="ka11y-launcher" aria-label="Open" aria-haspopup="dialog" aria-expanded="false"></button></div>';
  const host = document.getElementById("ka11y-root") as HTMLElement;
  const shadow = host.attachShadow({ mode: "open" });
  const base = createConfig();
  const config = { ...base, strings: { ...base.strings, credit: template } };
  const data: PanelDataSlice = {
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
      ...(withCredit ? { credit } : {}),
    },
    icons: {},
  };
  const store = createStore();
  createPanel({
    config,
    store,
    profiles: createProfiles(store, config.profiles, config.features),
    hideToolbar: createHideToolbar({ host, key: config.storage.key }),
    host,
    shadow,
    data,
  });
  return shadow;
};

describe("panel credit", () => {
  it("renders a translated credit line with a safe link", () => {
    const shadow = render(true);
    const line = shadow.querySelector(".ka11y-foot .ka11y-credit");
    const link = line?.querySelector("a") as HTMLAnchorElement;
    expect(line?.textContent).toBe("Developed by Jane Doe");
    expect(link.getAttribute("href")).toBe(credit.url);
    expect(link.getAttribute("rel")).toBe("noopener");
    expect(link.getAttribute("target")).toBeNull();
  });

  it("keeps translated word order around the placeholder", () => {
    const shadow = render(true, "%s: autor wtyczki");
    expect(shadow.querySelector(".ka11y-credit")?.textContent).toBe(
      "Jane Doe: autor wtyczki",
    );
  });

  it("omits the line without credit data", () => {
    expect(render(false).querySelector(".ka11y-credit")).toBeNull();
  });

  it("omits the line when the string has no placeholder", () => {
    expect(render(true, "Credit").querySelector(".ka11y-credit")).toBeNull();
  });
});
