import { describe, expect, it } from "vitest";

import { TILE_PATH_RE, resolveUpstreamUrl } from "./tileProxy.ts";

describe("resolveUpstreamUrl", () => {
  it("translates a valid tile path to the CDN URL", () => {
    expect(resolveUpstreamUrl("tiles/0_2026-05-01_a/1/0_24_26.png")).toBe(
      "https://maps.runescape.wiki/osrs/versions/2026-05-01_a/tiles/rendered/0/1/0_24_26.png",
    );
  });

  it("supports underground map ids", () => {
    expect(resolveUpstreamUrl("tiles/9_2026-05-01_a/2/1_10_20.png")).toBe(
      "https://maps.runescape.wiki/osrs/versions/2026-05-01_a/tiles/rendered/9/2/1_10_20.png",
    );
  });

  it("supports full-map id -1", () => {
    expect(resolveUpstreamUrl("tiles/-1_2026-05-01_a/2/0_52_75.png")).toBe(
      "https://maps.runescape.wiki/osrs/versions/2026-05-01_a/tiles/rendered/-1/2/0_52_75.png",
    );
  });

  it("rejects path traversal", () => {
    expect(resolveUpstreamUrl("tiles/../secret")).toBeNull();
  });

  it("rejects arbitrary upstream paths", () => {
    expect(resolveUpstreamUrl("versions/2026-05-01_a/other.png")).toBeNull();
    expect(resolveUpstreamUrl("")).toBeNull();
    expect(resolveUpstreamUrl("tiles/not-a-valid-path.png")).toBeNull();
  });

  it("rejects malformed version strings", () => {
    expect(resolveUpstreamUrl("tiles/0_../etc/passwd/1/0_24_26.png")).toBeNull();
    expect(resolveUpstreamUrl("tiles/0_evilversion/1/0_24_26.png")).toBeNull();
  });

  it("rejects mapIds outside the allowed range", () => {
    expect(resolveUpstreamUrl("tiles/9999_2026-05-01_a/1/0_24_26.png")).toBeNull();
    expect(resolveUpstreamUrl("tiles/-2_2026-05-01_a/1/0_24_26.png")).toBeNull();
  });

  it("rejects zoom, plane, and coords outside bounds", () => {
    expect(resolveUpstreamUrl("tiles/0_2026-05-01_a/9/0_24_26.png")).toBeNull();
    expect(resolveUpstreamUrl("tiles/0_2026-05-01_a/1/9_24_26.png")).toBeNull();
    expect(resolveUpstreamUrl("tiles/0_2026-05-01_a/1/0_99999_26.png")).toBeNull();
  });
});

describe("TILE_PATH_RE", () => {
  it("requires the tiles/ prefix and .png suffix", () => {
    expect(TILE_PATH_RE.test("tiles/0_2026-05-01_a/1/0_24_26.png")).toBe(true);
    expect(TILE_PATH_RE.test("0_2026-05-01_a/1/0_24_26.png")).toBe(false);
  });
});
