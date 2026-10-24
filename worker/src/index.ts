import type { Env } from "./config.ts";
import { corsHeaders, resolveAllowedOrigin } from "./cors.ts";
import { rateLimitResponse } from "./rateLimit.ts";
import { handleTileProxy } from "./tileProxy.ts";
import { getTileVersion, refreshTileVersion } from "./tileVersion.ts";
import { wikiCallStore } from "./wikiCallCounter.ts";
import { type WikiCallSource, handleWikiCalls, tileFetchBudget } from "./wikiCalls.ts";

export { WikiCallCounter } from "./wikiCallCounter.ts";

const WIKI_CALLS_PATH = "/api/wiki-calls";

function countWikiCalls(env: Env, source: WikiCallSource, n: number): Promise<void> {
  return wikiCallStore(env)
    .add(source, n)
    .catch((error: unknown) => console.warn("wikiCalls: failed to record", source, n, error));
}

async function reserveTileFetch(env: Env): Promise<boolean> {
  try {
    return await wikiCallStore(env).tryAdd(
      "tiles",
      1,
      tileFetchBudget(env.TILE_FETCH_DAILY_BUDGET),
    );
  } catch (error) {
    console.warn("wikiCalls: budget check failed, allowing fetch", error);
    return true;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const allowedOrigin = resolveAllowedOrigin(request, env);
    const headers = (extra?: HeadersInit): HeadersInit => corsHeaders(allowedOrigin, extra);
    const withCors = (response: Response): Response => {
      const merged = new Headers(response.headers);
      for (const [k, v] of Object.entries(headers() as { [key: string]: string })) {
        merged.set(k, v);
      }
      return new Response(response.body, { status: response.status, headers: merged });
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: headers() });
    }

    const url = new URL(request.url);
    const isWikiCallsReport = request.method === "POST" && url.pathname === WIKI_CALLS_PATH;
    if (request.method !== "GET" && !isWikiCallsReport) {
      return new Response("method not allowed", { status: 405, headers: headers() });
    }

    const tileProxyPrefix = "/tile-proxy/";
    const isTileProxy = url.pathname.startsWith(tileProxyPrefix);
    const isTileVersion = url.pathname === "/api/tile-version";
    const isWikiCalls =
      url.pathname === WIKI_CALLS_PATH || url.pathname.startsWith(`${WIKI_CALLS_PATH}/`);

    if (isTileProxy || isTileVersion || isWikiCalls) {
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

    if (isWikiCalls) {
      const subPath = url.pathname.slice(WIKI_CALLS_PATH.length).replace(/^\//, "");
      return withCors(
        await handleWikiCalls(request, subPath, wikiCallStore(env), env.WIKI_CALLS_TOKEN),
      );
    }

    if (isTileProxy) {
      const tilePath = url.pathname.slice(tileProxyPrefix.length);
      return withCors(
        await handleTileProxy(
          request,
          tilePath,
          () => getTileVersion(env),
          () => reserveTileFetch(env),
        ),
      );
    }

    return new Response("not found", { status: 404, headers: headers() });
  },

  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    let probes = 0;
    const record = await refreshTileVersion(env, () => probes++);
    if (probes > 0) await countWikiCalls(env, "cron", probes);
    if (!record.confirmed) {
      console.error("tileVersion: scheduled refresh could not confirm any version");
    }
  },
} satisfies ExportedHandler<Env>;
