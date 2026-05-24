import { describe, expect, it } from "vitest";

import {
  buildViewSearch,
  clampPlane,
  clampZoom,
  DEFAULT_VIEW,
  parseViewFromUrl,
  removeViewParamsFromSearch,
} from "./urlState.ts";

describe("parseViewFromUrl", () => {
  it("returns null when no view params are present", () => {
    expect(parseViewFromUrl("")).toBeNull();
    expect(parseViewFromUrl("?item=Bronze+sword")).toBeNull();
  });

  it("parses full view params", () => {
    expect(parseViewFromUrl("?plane=2&map=123&x=3500&y=9800&zoom=4")).toEqual({
      plane: 2,
      mapId: 123,
      x: 3500,
      y: 9800,
      zoom: 4,
    });
  });

  it("fills missing params with defaults", () => {
    expect(parseViewFromUrl("?x=3200")).toEqual({
      plane: DEFAULT_VIEW.plane,
      mapId: DEFAULT_VIEW.mapId,
      x: 3200,
      y: DEFAULT_VIEW.y,
      zoom: DEFAULT_VIEW.zoom,
    });
  });

  it("clamps plane and zoom", () => {
    expect(parseViewFromUrl("?plane=9&zoom=99")).toEqual({
      plane: 3,
      mapId: DEFAULT_VIEW.mapId,
      x: DEFAULT_VIEW.x,
      y: DEFAULT_VIEW.y,
      zoom: 5,
    });
  });
});

describe("removeViewParamsFromSearch", () => {
  it("removes all view params", () => {
    expect(removeViewParamsFromSearch("?plane=1&map=10001&x=3200&y=3200&zoom=3")).toBe("");
  });

  it("preserves unrelated query params", () => {
    expect(removeViewParamsFromSearch("?item=Bronze+sword&plane=1&zoom=3")).toBe(
      "?item=Bronze+sword",
    );
  });

  it("returns empty string when no view params are present", () => {
    expect(removeViewParamsFromSearch("?item=Bronze+sword")).toBe("?item=Bronze+sword");
    expect(removeViewParamsFromSearch("")).toBe("");
  });
});

describe("buildViewSearch", () => {
  it("round-trips through parseViewFromUrl", () => {
    const params = { plane: 1 as const, mapId: 0, x: 3200, y: 3200, zoom: 3 };
    expect(parseViewFromUrl(`?${buildViewSearch(params)}`)).toEqual(params);
  });
});

describe("clampPlane", () => {
  it("keeps valid planes", () => {
    expect(clampPlane(0)).toBe(0);
    expect(clampPlane(3)).toBe(3);
  });

  it("clamps out-of-range values", () => {
    expect(clampPlane(-1)).toBe(0);
    expect(clampPlane(5)).toBe(3);
  });
});

describe("clampZoom", () => {
  it("keeps valid zoom levels", () => {
    expect(clampZoom(0)).toBe(0);
    expect(clampZoom(5)).toBe(5);
  });

  it("clamps out-of-range values", () => {
    expect(clampZoom(-1)).toBe(0);
    expect(clampZoom(9)).toBe(5);
  });
});
