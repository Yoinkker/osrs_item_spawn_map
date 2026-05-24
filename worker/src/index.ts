import type { Env } from "./config.ts";
import { corsHeaders, resolveAllowedOrigin } from "./cors.ts";
import { rateLimitResponse } from "./rateLimit.ts";
import { getTileVersion } from "./tileVersion.ts";
import { handleTileProxy } from "./tileProxy.ts";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const allowedOrigin = resolveAllowedOrigin(request, env);
    const headers = (extra?: HeadersInit): HeadersInit => corsHeaders(allowedOrigin, extra);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: headers() });
    }
    if (request.method !== "GET") {
      return new Response("method not allowed", { status: 405, headers: headers() });
    }

    const url = new URL(request.url);
    const tileProxyPrefix = "/tile-proxy/";
    const isTileProxy = url.pathname.startsWith(tileProxyPrefix);
    const isTileVersion = url.pathname === "/api/tile-version";

    if (isTileProxy || isTileVersion) {
      const limited = await rateLimitResponse(request, isTileProxy ? "tiles" : "api");
      if (limited) {
        return new Response(limited.body, {
          status: limited.status,
          headers: headers({
            "Retry-After": limited.headers.get("Retry-After") ?? "60",
          }),
        });
      }
    }

    if (isTileVersion) {
      const version = await getTileVersion(env);
      return new Response(JSON.stringify({ version }), {
        status: 200,
        headers: headers({
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600",
        }),
      });
    }

    if (isTileProxy) {
      const tilePath = url.pathname.slice(tileProxyPrefix.length);
      const response = await handleTileProxy(request, tilePath);
      const merged = new Headers(response.headers);
      for (const [k, v] of Object.entries(headers() as { [key: string]: string })) {
        merged.set(k, v);
      }
      return new Response(response.body, { status: response.status, headers: merged });
    }

    return new Response("not found", { status: 404, headers: headers() });
  },
} satisfies ExportedHandler<Env>;
