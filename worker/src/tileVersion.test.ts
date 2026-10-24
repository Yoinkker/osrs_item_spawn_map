import { afterEach, describe, expect, it, vi } from "vitest";

import { FALLBACK_TILE_VERSION } from "../../shared/tileVersion.ts";
import { MAX_PROBE_DAYS } from "./config.ts";
import {
  type TileVersionRecord,
  anchorVersion,
  parseRecord,
  resolveTileVersion,
  scanBackedOff,
} from "./tileVersion.ts";

const NOW = Date.parse("2026-08-01T00:00:00Z");
const record = (over: Partial<TileVersionRecord> = {}): string =>
  JSON.stringify({ version: "2026-07-29_a", verifiedAt: NOW, confirmed: true, ...over });

describe("parseRecord", () => {
  it("reads a well-formed record", () => {
    expect(parseRecord(record())).toEqual({
      version: "2026-07-29_a",
      verifiedAt: NOW,
      confirmed: true,
    });
  });

  it("discards legacy bare-string entries", () => {
    expect(parseRecord("2026-06-30_a")).toBeNull();
  });

  it("discards undated, malformed, and unparseable entries", () => {
    expect(parseRecord(null)).toBeNull();
    expect(parseRecord("{not json")).toBeNull();
    expect(parseRecord(JSON.stringify({ version: "2026-07-29_a" }))).toBeNull();
    expect(parseRecord(record({ version: "../etc/passwd" }))).toBeNull();
  });

  it("treats a missing confirmed flag as unconfirmed rather than trusted", () => {
    const raw = JSON.stringify({ version: "2026-07-29_a", verifiedAt: NOW });
    expect(parseRecord(raw)?.confirmed).toBe(false);
  });
});

describe("scanBackedOff", () => {
  const base = { version: "2026-07-29_a", verifiedAt: NOW };

  it("never backs off a confirmed version or a cold namespace", () => {
    expect(scanBackedOff({ ...base, confirmed: true }, NOW + 60_000)).toBe(false);
    expect(scanBackedOff(null, NOW)).toBe(false);
  });

  it("waits six hours between failed scans", () => {
    const r = { ...base, confirmed: false };
    expect(scanBackedOff(r, NOW + 5 * 3600_000)).toBe(true);
    expect(scanBackedOff(r, NOW + 7 * 3600_000)).toBe(false);
  });
});

describe("anchorVersion", () => {
  it("prefers the last version we saw upstream, even once stale", () => {
    expect(anchorVersion(record({ verifiedAt: NOW - 30 * 24 * 3600_000 }))).toBe("2026-07-29_a");
  });

  it("seeds from the baked fallback on a cold namespace", () => {
    expect(anchorVersion(null)).toBe(FALLBACK_TILE_VERSION);
    expect(anchorVersion("2026-06-30_a")).toBe(FALLBACK_TILE_VERSION);
  });
});

describe("resolveTileVersion", () => {
  const now = new Date(NOW);
  const confirmed = (version: string): TileVersionRecord => ({
    version,
    verifiedAt: NOW - 3600_000,
    confirmed: true,
  });
  const mockUpstream = (live: string | null): void => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        const ok = live !== null && String(url).includes(`/versions/${live}/`);
        return Promise.resolve(
          new Response(ok ? new ArrayBuffer(8) : null, { status: ok ? 200 : 404 }),
        );
      }),
    );
  };

  afterEach(() => vi.unstubAllGlobals());

  it("costs a single request while the anchor is alive", async () => {
    mockUpstream("2026-07-29_a");
    const result = await resolveTileVersion(confirmed("2026-07-29_a"), now);
    expect(result).toEqual({ version: "2026-07-29_a", verifiedAt: NOW, confirmed: true });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("probes with a unique URL so a stale CDN hit can't confirm a purged render", async () => {
    mockUpstream("2026-07-29_a");
    await resolveTileVersion(confirmed("2026-07-29_a"), now);
    expect(String(vi.mocked(fetch).mock.calls[0]![0])).toMatch(/\.png\?probe=\d+$/);
  });

  it("seeds from the baked fallback on a cold namespace", async () => {
    mockUpstream(FALLBACK_TILE_VERSION);
    const result = await resolveTileVersion(null, now);
    expect(result.version).toBe(FALLBACK_TILE_VERSION);
    expect(result.confirmed).toBe(true);
  });

  it("adopts the new render once the anchor is purged", async () => {
    mockUpstream("2026-07-30_a");
    const result = await resolveTileVersion(confirmed("2026-07-29_a"), now);
    expect(result.version).toBe("2026-07-30_a");
    expect(result.confirmed).toBe(true);
  });

  it("rides out a long-lived render because the anchor carries it", async () => {
    mockUpstream("2026-03-04_a");
    const result = await resolveTileVersion(confirmed("2026-03-04_a"), now);
    expect(result.version).toBe("2026-03-04_a");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps the anchor but marks it unconfirmed when nothing is live", async () => {
    mockUpstream(null);
    const result = await resolveTileVersion(confirmed("2026-07-29_a"), now);
    expect(result).toEqual({ version: "2026-07-29_a", verifiedAt: NOW, confirmed: false });
  });

  it("only re-checks the anchor while a failed scan is backed off", async () => {
    mockUpstream(null);
    const failed = { version: "2026-07-29_a", verifiedAt: NOW - 3600_000, confirmed: false };
    expect(await resolveTileVersion(failed, now)).toBe(failed);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("stays under the Workers subrequest limit when scanning", async () => {
    mockUpstream(null);
    await resolveTileVersion(confirmed("2026-07-29_a"), now);
    expect(vi.mocked(fetch).mock.calls.length).toBeLessThanOrEqual(MAX_PROBE_DAYS + 1);
    expect(MAX_PROBE_DAYS + 1).toBeLessThan(50);
  });
});
