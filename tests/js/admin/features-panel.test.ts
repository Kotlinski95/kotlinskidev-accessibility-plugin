import {
  buildFeaturesPanel,
  moveFeature,
  orderedFeatures,
} from "../../../src/ts/admin/panels/features";
import { sampleContext } from "./helpers";

jest.mock("@wordpress/i18n", () => jest.requireActual("./wp-mocks").i18nMock, {
  virtual: true,
});

const rowKeys = (panel: HTMLElement, index: number): string[] =>
  [
    ...(
      panel.querySelectorAll(".ka11y-feature-group")[index] as HTMLElement
    ).querySelectorAll("tbody tr"),
  ].map((row) => row.getAttribute("data-feature") ?? "");

const moveButton = (
  panel: HTMLElement,
  feature: string,
  direction: "up" | "down",
): HTMLButtonElement =>
  panel.querySelector(
    `tr[data-feature="${feature}"] button[data-direction="${direction}"]`,
  ) as HTMLButtonElement;

afterEach(() => {
  document.body.replaceChildren();
});

describe("features panel order helpers", () => {
  it("keeps saved order and appends missing keys in default order", () => {
    expect(orderedFeatures(["c", "a", "x", "c"], ["a", "b", "c"])).toEqual([
      "c",
      "a",
      "b",
    ]);
    expect(orderedFeatures(undefined, ["a", "b"])).toEqual(["a", "b"]);
  });

  it("swaps neighbours and ignores moves past the edges", () => {
    expect(moveFeature(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveFeature(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
    expect(moveFeature(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"]);
  });
});

describe("features panel ordering", () => {
  it("moves a feature down, stores panel.order, announces and keeps focus", () => {
    const ctx = sampleContext();
    const panel = buildFeaturesPanel(ctx);
    document.body.append(panel);
    const before = rowKeys(panel, 0);

    moveButton(panel, "biggerText", "down").click();

    const after = rowKeys(panel, 0);
    expect(after[0]).toBe(before[1]);
    expect(after[1]).toBe("biggerText");
    expect((ctx.state.get("panel.order") as string[]).slice(0, 2)).toEqual([
      before[1],
      "biggerText",
    ]);
    expect(panel.querySelector("[aria-live]")?.textContent).toContain(
      "position 2",
    );
    expect(document.activeElement).toBe(
      moveButton(panel, "biggerText", "down"),
    );
  });

  it("disables up on the first row and down on the last row", () => {
    const panel = buildFeaturesPanel(sampleContext());
    const keys = rowKeys(panel, 1);

    expect(moveButton(panel, keys[0] as string, "up").disabled).toBe(true);
    expect(
      moveButton(panel, keys[keys.length - 1] as string, "down").disabled,
    ).toBe(true);
  });

  it("renders the saved order", () => {
    const settings = sampleContext().state.snapshot();
    (settings.panel as Record<string, unknown>).order = [
      "lineHeight",
      "biggerText",
    ];
    const panel = buildFeaturesPanel(sampleContext(settings));

    expect(rowKeys(panel, 0).slice(0, 3)).toEqual([
      "lineHeight",
      "biggerText",
      "letterSpacing",
    ]);
  });
});
