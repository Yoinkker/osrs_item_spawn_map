import { FALLBACK_TILE_VERSION } from "../../shared/tileVersion.ts";
import {
  type Env,
  PROBE_TILE,
  TILE_VERSION_KV_KEY,
  TILE_VERSION_SCAN_BACKOFF_SECONDS,
  UPSTREAM_HEADERS,
  generateProbeVersions,
  isValidTileVersion,
  upstreamTileUrl,
} from "./config.ts";

const PROBE_FETCH_TIMEOUT_MS = 6000;

export interface TileVersionRecord {
  version: string;
  verifiedAt: number;
  confirmed: boolean;
}

export function parseRecord(raw: string | null): TileVersionRecord | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const { version, verifiedAt, confirmed } = (parsed ?? {}) as Partial<TileVersionRecord>;
  if (typeof version !== "string" || !isValidTileVersion(version)) return null;
  if (typeof verifiedAt !== "number" || !Number.isFinite(verifiedAt)) return null;
  return { version, verifiedAt, confirmed: confirmed === true };
}

export function scanBackedOff(record: TileVersionRecord | null, now = Date.now()): boolean {
  if (!record || record.confirmed) return false;
  return now < record.verifiedAt + TILE_VERSION_SCAN_BACKOFF_SECONDS * 1000;
}

export function anchorVersion(raw: string | null): string {
  return parseRecord(raw)?.version ?? FALLBACK_TILE_VERSION;
}

async function versionExists(version: string): Promise<boolean> {
  const { z, plane, tx, ty, mapId } = PROBE_TILE;
  const url = `${upstreamTileUrl(version, z, plane, tx, ty, mapId)}?probe=${Date.now()}`;
  try {
    const resp = await fetch(url, {
      headers: UPSTREAM_HEADERS,
      signal: AbortSignal.timeout(PROBE_FETCH_TIMEOUT_MS),
    });
    if (resp.ok) await resp.arrayBuffer();
    return resp.ok;
  } catch (error) {
    console.warn("tileVersion: probe failed for", version, error);
    return false;
  }
}

export async function resolveTileVersion(
  previous: TileVersionRecord | null,
  now: Date = new Date(),
  onProbe?: () => void,
): Promise<TileVersionRecord> {
  const exists = (version: string): Promise<boolean> => {
    onProbe?.();
    return versionExists(version);
  };
  const anchor = previous?.version ?? FALLBACK_TILE_VERSION;
  if (await exists(anchor)) {
    return { version: anchor, verifiedAt: now.getTime(), confirmed: true };
  }
  if (scanBackedOff(previous, now.getTime())) {
    console.warn("tileVersion: anchor", anchor, "still gone, scan backed off");
    return previous!;
  }
  console.warn("tileVersion: anchor", anchor, "is gone, scanning for a newer render");

  for (const candidate of generateProbeVersions(now)) {
    if (candidate === anchor) continue; // just checked it
    if (await exists(candidate)) {
      console.log("tileVersion: adopted", candidate);
      return { version: candidate, verifiedAt: now.getTime(), confirmed: true };
    }
  }

  console.error("tileVersion: no live render found, keeping unconfirmed", anchor);
  return { version: anchor, verifiedAt: now.getTime(), confirmed: false };
}

// Requests only read KV; the hourly cron is the sole caller that probes upstream,
// so a stale or missing record can never fan out into per-request probe storms.
export async function getTileVersion(env: Env): Promise<string> {
  return anchorVersion(await env.TILE_VERSION_KV.get(TILE_VERSION_KV_KEY));
}

export async function refreshTileVersion(
  env: Env,
  onProbe?: () => void,
): Promise<TileVersionRecord> {
  const previous = parseRecord(await env.TILE_VERSION_KV.get(TILE_VERSION_KV_KEY));
  const record = await resolveTileVersion(previous, undefined, onProbe);
  if (record !== previous) {
    await env.TILE_VERSION_KV.put(TILE_VERSION_KV_KEY, JSON.stringify(record));
  }
  return record;
}
