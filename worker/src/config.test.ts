import { describe, expect, it } from "vitest";

import { MAX_PROBE_DAYS, generateProbeVersions, isValidTileVersion } from "./config.ts";

describe("generateProbeVersions", () => {
  const now = new Date("2026-08-01T00:00:00Z");

  it("scans newest-first so the freshest render wins", () => {
    const versions = generateProbeVersions(now);
    expect(versions[0]).toBe("2026-08-01_a");
    expect(versions[1]).toBe("2026-07-31_a");
  });

  it("crosses month boundaries correctly", () => {
    expect(generateProbeVersions(new Date("2026-03-01T00:00:00Z"), 2)).toEqual([
      "2026-03-01_a",
      "2026-02-28_a",
    ]);
  });

  it("stays within the Workers subrequest budget", () => {
    expect(generateProbeVersions(now)).toHaveLength(MAX_PROBE_DAYS);
    expect(MAX_PROBE_DAYS).toBeLessThan(50);
  });

  it("emits only validly formatted versions", () => {
    for (const v of generateProbeVersions(now)) {
      expect(isValidTileVersion(v)).toBe(true);
    }
  });
});

describe("isValidTileVersion", () => {
  it("accepts a render version", () => {
    expect(isValidTileVersion("2026-07-29_a")).toBe(true);
  });

  it("rejects anything that could escape the upstream path", () => {
    expect(isValidTileVersion("../etc/passwd")).toBe(false);
    expect(isValidTileVersion("evilversion")).toBe(false);
    expect(isValidTileVersion("2026-07-29")).toBe(false);
  });
});
