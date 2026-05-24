import {
  TILE_404_CACHE_MAX_AGE_SECONDS,
  TILE_CACHE_MAX_AGE_SECONDS,
  UPSTREAM_HEADERS,
  isValidTileMapId,
  isValidTileVersion,
  upstreamTileUrl,
} from "./config.ts";

export const TILE_PATH_RE = /^tiles\/(-?\d+)_([0-9a-z_-]+)\/(\d+)\/(\d+)_(-?\d+)_(-?\d+)\.png$/;
const UPSTREAM_FETCH_TIMEOUT_MS = 10_000;
const MAX_TILE_ZOOM = 3;
const MAX_TILE_PLANE = 3;
const MAX_TILE_COORD = 4096;

function tileResponseHeaders(extra: HeadersInit = {}): HeadersInit {
  return {
    "Cache-Control": `public, max-age=${TILE_CACHE_MAX_AGE_SECONDS}`,
    ...(extra as { [key: string]: string }),
  };
}

export function resolveUpstreamUrl(tilePath: string): string | null {
  const m = TILE_PATH_RE.exec(tilePath);
  if (!m) return null;
  const [, mapIdRaw, ver, zRaw, planeRaw, txRaw, tyRaw] = m;
  const mapId = Number.parseInt(mapIdRaw!, 10);
  const z = Number.parseInt(zRaw!, 10);
  const plane = Number.parseInt(planeRaw!, 10);
  const tx = Number.parseInt(txRaw!, 10);
  const ty = Number.parseInt(tyRaw!, 10);
  if (!isValidTileMapId(mapId)) return null;
  if (!isValidTileVersion(ver!)) return null;
  if (z < 0 || z > MAX_TILE_ZOOM) return null;
  if (plane < 0 || plane > MAX_TILE_PLANE) return null;
  if (Math.abs(tx) > MAX_TILE_COORD || Math.abs(ty) > MAX_TILE_COORD) return null;
  return upstreamTileUrl(ver!, z, plane, tx, ty, mapId);
}

export async function handleTileProxy(_request: Request, tilePath: string): Promise<Response> {
  const upstreamUrl = resolveUpstreamUrl(tilePath);
  if (!upstreamUrl) {
    return new Response("invalid tile path", { status: 400, headers: tileResponseHeaders() });
  }

  const cache = caches.default;
  const cacheKey = new Request(upstreamUrl, { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) {
    return new Response(cached.body, {
      status: cached.status,
      headers: tileResponseHeaders({
        "Content-Type": cached.headers.get("Content-Type") ?? "image/png",
      }),
    });
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: UPSTREAM_HEADERS,
      signal: AbortSignal.timeout(UPSTREAM_FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    console.error("tileProxy: upstream fetch failed", upstreamUrl, error);
    return new Response("upstream error", { status: 502, headers: tileResponseHeaders() });
  }

  if (!upstream.ok) {
    const notFound = new Response("not found", {
      status: 404,
      headers: tileResponseHeaders({
        "Cache-Control": `public, max-age=${TILE_404_CACHE_MAX_AGE_SECONDS}`,
      }),
    });
    await cache.put(cacheKey, notFound.clone());
    return notFound;
  }

  const body = await upstream.arrayBuffer();
  const response = new Response(body, {
    status: 200,
    headers: tileResponseHeaders({ "Content-Type": "image/png" }),
  });
  await cache.put(cacheKey, response.clone());
  return response;
}
