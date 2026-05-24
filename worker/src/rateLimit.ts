export const RATE_LIMIT_WINDOW_SECONDS = 60;
export const TILE_PROXY_MAX_REQUESTS = 500;
export const API_MAX_REQUESTS = 30;

function clientIp(request: Request): string | null {
  return request.headers.get("CF-Connecting-IP");
}

function rateLimitKey(bucket: string, ip: string): Request {
  return new Request(`https://rate-limit.internal/${bucket}/${ip}`);
}

export async function rateLimitResponse(
  request: Request,
  bucket: "tiles" | "api",
  cache: Cache = caches.default,
): Promise<Response | null> {
  const maxRequests = bucket === "tiles" ? TILE_PROXY_MAX_REQUESTS : API_MAX_REQUESTS;
  const ip = clientIp(request);
  if (ip === null) {
    return new Response("missing client ip", {
      status: 400,
      headers: { "Retry-After": String(RATE_LIMIT_WINDOW_SECONDS) },
    });
  }
  const cacheKey = rateLimitKey(bucket, ip);

  let count = 0;
  const cached = await cache.match(cacheKey);
  if (cached) {
    count = Number.parseInt(await cached.text(), 10) || 0;
    if (count >= maxRequests) {
      return new Response("rate limit exceeded", {
        status: 429,
        headers: { "Retry-After": String(RATE_LIMIT_WINDOW_SECONDS) },
      });
    }
  }

  await cache.put(
    cacheKey,
    new Response(String(count + 1), {
      headers: { "Cache-Control": `max-age=${RATE_LIMIT_WINDOW_SECONDS}` },
    }),
  );
  return null;
}
