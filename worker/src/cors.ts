import type { Env } from "./config.ts";

const ALLOW_METHODS = "GET, OPTIONS";

function parseAllowList(env: Env): string[] {
  return (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function resolveAllowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get("Origin");
  const allowList = parseAllowList(env);
  if (allowList.length === 0 || allowList.includes("*")) {
    return origin ?? "*";
  }
  if (!origin) return null;
  return allowList.includes(origin) ? origin : null;
}

export function corsHeaders(allowedOrigin: string | null, extra: HeadersInit = {}): HeadersInit {
  const base: { [key: string]: string } = {
    "Access-Control-Allow-Methods": ALLOW_METHODS,
    Vary: "Origin",
  };
  if (allowedOrigin) base["Access-Control-Allow-Origin"] = allowedOrigin;
  return { ...base, ...(extra as { [key: string]: string }) };
}
