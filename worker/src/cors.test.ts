import { describe, expect, it } from "vitest";

import type { Env } from "./config.ts";
import { corsHeaders, resolveAllowedOrigin } from "./cors.ts";

function makeEnv(allowed: string): Env {
  return { TILE_VERSION_KV: {} as KVNamespace, ALLOWED_ORIGINS: allowed };
}

function makeRequest(origin?: string): Request {
  const headers: HeadersInit = origin ? { Origin: origin } : {};
  return new Request("https://worker.example/api/tile-version", { headers });
}

describe("resolveAllowedOrigin", () => {
  it("echoes back an explicitly allowlisted origin", () => {
    const env = makeEnv("https://app.example,https://www.app.example");
    expect(resolveAllowedOrigin(makeRequest("https://app.example"), env)).toBe(
      "https://app.example",
    );
  });

  it("returns null for origins not in the allowlist", () => {
    const env = makeEnv("https://app.example");
    expect(resolveAllowedOrigin(makeRequest("https://evil.example"), env)).toBeNull();
  });

  it("returns null when allowlist is configured and Origin is missing", () => {
    const env = makeEnv("https://app.example");
    expect(resolveAllowedOrigin(makeRequest(), env)).toBeNull();
  });

  it("is permissive when allowlist is empty (dev mode)", () => {
    const env = makeEnv("");
    expect(resolveAllowedOrigin(makeRequest("https://anything.example"), env)).toBe(
      "https://anything.example",
    );
  });

  it("is permissive when allowlist is '*'", () => {
    const env = makeEnv("*");
    expect(resolveAllowedOrigin(makeRequest("https://anything.example"), env)).toBe(
      "https://anything.example",
    );
  });
});

describe("corsHeaders", () => {
  it("omits Allow-Origin when null", () => {
    const h = corsHeaders(null) as { [key: string]: string };
    expect(h["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(h["Vary"]).toBe("Origin");
  });

  it("sets Allow-Origin when provided", () => {
    const h = corsHeaders("https://app.example") as { [key: string]: string };
    expect(h["Access-Control-Allow-Origin"]).toBe("https://app.example");
  });
});
