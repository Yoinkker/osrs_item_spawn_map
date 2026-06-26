import { FALLBACK_TILE_VERSION } from "../../shared/tileVersion.ts";
import {
  type Env,
  TILE_VERSION_KV_KEY,
  TILE_VERSION_TTL_SECONDS,
  UPSTREAM_HEADERS,
  generateVersionCandidates,
  upstreamTileUrl,
} from "./config.ts";

const PROBE_FETCH_TIMEOUT_MS = 6000;

async function probeTileVersion(): Promise<string> {
  const candidates = generateVersionCandidates();
  for (const v of candidates) {
    const url = upstreamTileUrl(v, 1, 0, 24, 26);
    try {
      const resp = await fetch(url, {
        headers: UPSTREAM_HEADERS,
        signal: AbortSignal.timeout(PROBE_FETCH_TIMEOUT_MS),
      });
      if (resp.ok) {
        await resp.arrayBuffer();
        return v;
      }
    } catch (error) {
      console.warn("tileVersion: probe failed for", v, error);
    }
  }
  console.error("tileVersion: all candidates failed, falling back to", FALLBACK_TILE_VERSION);
  return FALLBACK_TILE_VERSION;
}

export async function getTileVersion(env: Env): Promise<string> {
  const cached = await env.TILE_VERSION_KV.get(TILE_VERSION_KV_KEY);
  if (cached) return cached;
  const v = await probeTileVersion();
  await env.TILE_VERSION_KV.put(TILE_VERSION_KV_KEY, v, {
    expirationTtl: TILE_VERSION_TTL_SECONDS,
  });
  return v;
}
