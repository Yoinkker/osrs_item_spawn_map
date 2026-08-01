import { FALLBACK_TILE_VERSION } from "../../shared/tileVersion.ts";
import {
  type Env,
  PROBE_TILE,
  TILE_VERSION_KV_KEY,
  TILE_VERSION_TTL_SECONDS,
  TILE_VERSION_UNCONFIRMED_TTL_SECONDS,
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

function ttlSeconds(record: TileVersionRecord): number {
  return record.confirmed ? TILE_VERSION_TTL_SECONDS : TILE_VERSION_UNCONFIRMED_TTL_SECONDS;
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

export function isFresh(record: TileVersionRecord, now = Date.now()): boolean {
  return now < record.verifiedAt + ttlSeconds(record) * 1000;
}

export function anchorVersion(raw: string | null): string {
  return parseRecord(raw)?.version ?? FALLBACK_TILE_VERSION;
}

async function versionExists(version: string): Promise<boolean> {
  const { z, plane, tx, ty, mapId } = PROBE_TILE;
  try {
    const resp = await fetch(upstreamTileUrl(version, z, plane, tx, ty, mapId), {
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
  anchor: string,
  now: Date = new Date(),
): Promise<TileVersionRecord> {
  if (await versionExists(anchor)) {
    return { version: anchor, verifiedAt: now.getTime(), confirmed: true };
  }
  console.warn("tileVersion: anchor", anchor, "is gone, scanning for a newer render");

  for (const candidate of generateProbeVersions(now)) {
    if (candidate === anchor) continue; // just checked it
    if (await versionExists(candidate)) {
      console.log("tileVersion: adopted", candidate);
      return { version: candidate, verifiedAt: now.getTime(), confirmed: true };
    }
  }

  console.error("tileVersion: no live render found, serving unconfirmed", FALLBACK_TILE_VERSION);
  return { version: FALLBACK_TILE_VERSION, verifiedAt: now.getTime(), confirmed: false };
}

async function store(env: Env, record: TileVersionRecord): Promise<void> {
  await env.TILE_VERSION_KV.put(TILE_VERSION_KV_KEY, JSON.stringify(record), {
    expirationTtl: ttlSeconds(record),
  });
}

export async function getTileVersion(env: Env): Promise<string> {
  const raw = await env.TILE_VERSION_KV.get(TILE_VERSION_KV_KEY);
  const cached = parseRecord(raw);
  if (cached && isFresh(cached)) return cached.version;

  const record = await resolveTileVersion(anchorVersion(raw));
  await store(env, record);
  return record.version;
}

export async function refreshTileVersion(env: Env): Promise<TileVersionRecord> {
  const raw = await env.TILE_VERSION_KV.get(TILE_VERSION_KV_KEY);
  const record = await resolveTileVersion(anchorVersion(raw));
  await store(env, record);
  return record;
}
