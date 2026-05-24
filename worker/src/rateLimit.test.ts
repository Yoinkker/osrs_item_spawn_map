import { describe, expect, it } from "vitest";

import { API_MAX_REQUESTS, TILE_PROXY_MAX_REQUESTS, rateLimitResponse } from "./rateLimit.ts";

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

function rateLimitRequest(ip: string | null = "203.0.113.1"): Request {
  const headers: HeadersInit = ip ? { "CF-Connecting-IP": ip } : {};
  return new Request("https://worker.example/tile-proxy/tiles/0_v/1/0_1_1.png", { headers });
}

describe("rateLimitResponse", () => {
  it("allows requests under the limit", async () => {
    const cache = mockCache();
    expect(await rateLimitResponse(rateLimitRequest(), "tiles", cache)).toBeNull();
  });

  it("rejects requests without a client IP", async () => {
    const cache = mockCache();
    const resp = await rateLimitResponse(rateLimitRequest(null), "tiles", cache);
    expect(resp?.status).toBe(400);
  });

  it("blocks when the tile limit is exceeded", async () => {
    const cache = mockCache();
    const request = rateLimitRequest();
    for (let i = 0; i < TILE_PROXY_MAX_REQUESTS; i++) {
      expect(await rateLimitResponse(request, "tiles", cache)).toBeNull();
    }
    const blocked = await rateLimitResponse(request, "tiles", cache);
    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get("Retry-After")).toBe("60");
  });

  it("tracks API and tile buckets separately", async () => {
    const cache = mockCache();
    const request = rateLimitRequest();
    for (let i = 0; i < API_MAX_REQUESTS; i++) {
      expect(await rateLimitResponse(request, "api", cache)).toBeNull();
    }
    const blockedApi = await rateLimitResponse(request, "api", cache);
    expect(blockedApi?.status).toBe(429);
    expect(await rateLimitResponse(request, "tiles", cache)).toBeNull();
  });

  it("tracks clients separately", async () => {
    const cache = mockCache();
    for (let i = 0; i < API_MAX_REQUESTS; i++) {
      expect(await rateLimitResponse(rateLimitRequest("203.0.113.1"), "api", cache)).toBeNull();
    }
    const blockedClient = await rateLimitResponse(rateLimitRequest("203.0.113.1"), "api", cache);
    expect(blockedClient?.status).toBe(429);
    expect(await rateLimitResponse(rateLimitRequest("203.0.113.2"), "api", cache)).toBeNull();
  });
});
