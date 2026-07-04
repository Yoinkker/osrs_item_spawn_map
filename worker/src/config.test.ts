import { describe, expect, it } from "vitest";

import { FALLBACK_TILE_VERSION } from "../../shared/tileVersion.ts";
import { generateVersionCandidates, isValidTileVersion } from "./config.ts";

describe("generateVersionCandidates", () => {
  const now = new Date("2026-06-27T00:00:00Z");

  it("probes the current day first (newest-first ordering)", () => {
    const candidates = generateVersionCandidates(now);
    expect(candidates[0]).toBe("2026-06-27_a");
    expect(candidates[1]).toBe("2026-06-26_a");
  });

  it("puts the fallback last so a valid recent render is adopted before it", () => {
    const candidates = generateVersionCandidates(now);
    expect(candidates[candidates.length - 1]).toBe(FALLBACK_TILE_VERSION);
    expect(candidates.indexOf(FALLBACK_TILE_VERSION)).toBe(candidates.length - 1);
  });

  it("does not duplicate the fallback when it lands on a generated day", () => {
    const fallbackDate = new Date(`${FALLBACK_TILE_VERSION.slice(0, 10)}T00:00:00Z`);
    const fourDaysLater = new Date(fallbackDate.getTime() + 4 * 24 * 60 * 60 * 1000);
    const candidates = generateVersionCandidates(fourDaysLater);
    const occurrences = candidates.filter((v) => v === FALLBACK_TILE_VERSION).length;
    expect(occurrences).toBe(1);
    expect(candidates).toHaveLength(120); // no extra trailing entry
    expect(candidates.indexOf(FALLBACK_TILE_VERSION)).toBe(4);
  });

  it("emits only validly formatted versions", () => {
    for (const v of generateVersionCandidates(now)) {
      expect(isValidTileVersion(v)).toBe(true);
    }
  });
});
