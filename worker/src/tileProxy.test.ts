import { afterEach, describe, expect, it, vi } from "vitest";

import { TILE_PATH_RE, handleTileProxy, resolveUpstreamUrl } from "./tileProxy.ts";

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

  it("supports instance map ids in the 10000 range", () => {
    expect(resolveUpstreamUrl("tiles/10001_2026-05-01_a/3/0_87_143.png")).toBe(
      "https://maps.runescape.wiki/osrs/versions/2026-05-01_a/tiles/rendered/10001/3/0_87_143.png",
    );
  });

  it("rejects mapIds outside the allowed range", () => {
    expect(resolveUpstreamUrl("tiles/20001_2026-05-01_a/1/0_24_26.png")).toBeNull();
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

const LIVE = "2026-10-07_a";
const tilePath = (version: string): string => `tiles/0_${version}/3/0_103_98.png`;
const tileRequest = (version: string, query = ""): Request =>
  new Request(`https://worker.example/tile-proxy/${tilePath(version)}${query}`);

function mockCache(): Cache {
  const store = new Map<string, Response>();
  return {
    match: (key: Request) => {
      const hit = store.get(key.url);
      return Promise.resolve(hit ? hit.clone() : undefined);
    },
    put: (key: Request, response: Response) => {
      store.set(key.url, response.clone());
      return Promise.resolve();
    },
  } as Cache;
}

function live(): Promise<string> {
  return Promise.resolve(LIVE);
}

function mockUpstreamOk(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      return Promise.resolve(new Response(new ArrayBuffer(8), { status: 200 }));
    }),
  );
}

describe("handleTileProxy", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("never fetches tiles for a version other than the live one", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const counted = vi.fn();
    const resp = await handleTileProxy(
      tileRequest("2026-07-29_a"),
      tilePath("2026-07-29_a"),
      live,
      counted,
      mockCache(),
    );
    expect(resp.status).toBe(404);
    expect(resp.headers.get("Cache-Control")).toBe("no-store");
    expect(fetch).not.toHaveBeenCalled();
    expect(counted).not.toHaveBeenCalled();
  });

  it("serves query-string variants of a tile from one cache entry", async () => {
    mockUpstreamOk();
    const cache = mockCache();
    const counted = vi.fn();
    for (const query of ["", "?x=1", "?x=2"]) {
      const resp = await handleTileProxy(
        tileRequest(LIVE, query),
        tilePath(LIVE),
        live,
        counted,
        cache,
      );
      expect(resp.status).toBe(200);
    }
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(counted).toHaveBeenCalledTimes(1);
  });

  it("answers cache hits without looking up the live version", async () => {
    mockUpstreamOk();
    const cache = mockCache();
    const version = vi.fn(live);
    await handleTileProxy(tileRequest(LIVE), tilePath(LIVE), version, vi.fn(), cache);
    await handleTileProxy(tileRequest(LIVE), tilePath(LIVE), version, vi.fn(), cache);
    expect(version).toHaveBeenCalledTimes(1);
  });
});
