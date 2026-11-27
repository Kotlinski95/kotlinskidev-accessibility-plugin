import { orderFeatures } from "../../src/ts/frontend/panel/cards";

describe("orderFeatures", () => {
  it("follows the saved order and appends missing keys in default order", () => {
    expect(orderFeatures(["a", "b", "c", "d"], ["c", "a"])).toEqual([
      "c",
      "a",
      "b",
      "d",
    ]);
  });

  it("drops unknown keys", () => {
    expect(orderFeatures(["a", "b"], ["z", "b"])).toEqual(["b", "a"]);
  });

  it("returns the default order without a saved one", () => {
    expect(orderFeatures(["a", "b"])).toEqual(["a", "b"]);
  });
});
