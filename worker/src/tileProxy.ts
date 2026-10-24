import {
  TILE_CACHE_MAX_AGE_SECONDS,
  TILE_UPSTREAM_ERROR_CACHE_SECONDS,
  UPSTREAM_HEADERS,
  isValidTileMapId,
  isValidTileVersion,
  upstreamTileUrl,
} from "./config.ts";

export const TILE_PATH_RE = /^tiles\/(-?\d+)_([0-9a-z_-]+)\/(\d+)\/(\d+)_(-?\d+)_(-?\d+)\.png$/;
const UPSTREAM_FETCH_TIMEOUT_MS = 10_000;
const MAX_TILE_ZOOM = 3;
const MAX_TILE_PLANE = 3;
const MAX_TILE_COORD_AT_MAX_ZOOM = 1024;

function maxTileCoord(z: number): number {
  return MAX_TILE_COORD_AT_MAX_ZOOM / 2 ** (MAX_TILE_ZOOM - z);
}

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
  if (tx < 0 || ty < 0 || tx > maxTileCoord(z) || ty > maxTileCoord(z)) return null;
  return upstreamTileUrl(ver!, z, plane, tx, ty, mapId);
}

export async function handleTileProxy(
  request: Request,
  tilePath: string,
  currentVersion: () => Promise<string>,
  reserveUpstreamFetch: () => Promise<boolean>,
  cache: Cache = caches.default,
): Promise<Response> {
  const upstreamUrl = resolveUpstreamUrl(tilePath);
  if (!upstreamUrl) {
    return new Response("invalid tile path", { status: 400, headers: tileResponseHeaders() });
  }

  // Ignore the query string so ?x=1, ?x=2, ... can't each force an upstream fetch.
  const keyUrl = new URL(request.url);
  keyUrl.search = "";
  const cacheKey = new Request(keyUrl.toString(), { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) {
    return new Response(cached.body, {
      status: cached.status,
      headers: tileResponseHeaders({
        "Content-Type": cached.headers.get("Content-Type") ?? "image/png",
        "Cache-Control":
          cached.headers.get("Cache-Control") ?? `public, max-age=${TILE_CACHE_MAX_AGE_SECONDS}`,
      }),
    });
  }

  if (TILE_PATH_RE.exec(tilePath)![2] !== (await currentVersion())) {
    return new Response("unknown tile version", {
      status: 404,
      headers: tileResponseHeaders({ "Cache-Control": "no-store" }),
    });
  }

  if (!(await reserveUpstreamFetch())) {
    return new Response("daily wiki fetch budget reached", {
      status: 503,
      headers: tileResponseHeaders({ "Cache-Control": "no-store" }),
    });
  }

  const cacheAndReturn = async (response: Response): Promise<Response> => {
    await cache.put(cacheKey, response.clone());
    return response;
  };
  const upstreamError = (): Promise<Response> =>
    cacheAndReturn(
      new Response("upstream error", {
        status: 502,
        headers: tileResponseHeaders({
          "Cache-Control": `public, max-age=${TILE_UPSTREAM_ERROR_CACHE_SECONDS}`,
        }),
      }),
    );

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: UPSTREAM_HEADERS,
      signal: AbortSignal.timeout(UPSTREAM_FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    console.error("tileProxy: upstream fetch failed", upstreamUrl, error);
    return upstreamError();
  }

  if (upstream.status === 404) {
    return cacheAndReturn(
      new Response("not found", { status: 404, headers: tileResponseHeaders() }),
    );
  }
  if (!upstream.ok) {
    console.warn("tileProxy: upstream answered", upstream.status, upstreamUrl);
    return upstreamError();
  }

  const body = await upstream.arrayBuffer();
  return cacheAndReturn(
    new Response(body, {
      status: 200,
      headers: tileResponseHeaders({ "Content-Type": "image/png" }),
    }),
  );
}
