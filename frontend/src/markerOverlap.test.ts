import { describe, expect, it } from "vitest";

import { overlapKey, overlapPosition } from "./markerOverlap.ts";

describe("overlapPosition", () => {
  it("leaves a single marker at the original coordinate", () => {
    expect(overlapPosition(1494, 3177, 0, 1)).toEqual({ x: 1494, y: 3177 });
  });

  it("offsets two markers slightly side by side", () => {
    const first = overlapPosition(100, 200, 0, 2);
    const second = overlapPosition(100, 200, 1, 2);
    expect(first).toEqual({ x: 99, y: 200 });
    expect(second).toEqual({ x: 101, y: 200 });
  });
});

describe("overlapKey", () => {
  it("groups by map, plane, and coordinates", () => {
    expect(overlapKey(0, 0, 1494, 3177)).toBe("0:0:1494:3177");
  });
});
