export const WIKI_CALL_SOURCES = ["tiles", "cron", "ci"] as const;
export type WikiCallSource = (typeof WIKI_CALL_SOURCES)[number];
export type WikiCallTotals = { [S in WikiCallSource]: number };

export const WIKI_CALLS_WINDOW_DAYS = 30;
export const MAX_REPORTED_CALLS = 100_000;

export const WIKI_CALL_BADGES = {
  automated: {
    label: `wiki calls · automated (${WIKI_CALLS_WINDOW_DAYS}d)`,
    sources: ["ci", "cron"],
  },
  site: {
    label: `wiki calls · site (${WIKI_CALLS_WINDOW_DAYS}d)`,
    sources: ["tiles"],
  },
} as const satisfies { [name: string]: { label: string; sources: readonly WikiCallSource[] } };
export type WikiCallBadge = keyof typeof WIKI_CALL_BADGES;

export interface WikiCallStore {
  add(source: WikiCallSource, n: number): Promise<void>;
  totals(): Promise<WikiCallTotals>;
}

const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function windowStartDay(now: Date, days = WIKI_CALLS_WINDOW_DAYS): string {
  return utcDay(new Date(now.getTime() - (days - 1) * MILLIS_PER_DAY));
}

export function isWikiCallBadge(name: string): name is WikiCallBadge {
  return Object.hasOwn(WIKI_CALL_BADGES, name);
}

// Shields.io endpoint badge schema: https://shields.io/badges/endpoint-badge
export function badgeJson(badge: WikiCallBadge, totals: WikiCallTotals): object {
  const { label, sources } = WIKI_CALL_BADGES[badge];
  const n = sources.reduce((sum, source) => sum + totals[source], 0);
  return {
    schemaVersion: 1,
    label,
    message: n.toLocaleString("en-US"),
    color: "blue",
    cacheSeconds: 3600,
  };
}

export function parseReportedCount(body: unknown): number | null {
  const count = (body as { count?: unknown } | null)?.count;
  if (typeof count !== "number" || !Number.isInteger(count)) return null;
  return count >= 0 && count <= MAX_REPORTED_CALLS ? count : null;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function tokenMatches(authorization: string | null, token?: string): Promise<boolean> {
  const prefix = "Bearer ";
  if (!token || !authorization?.startsWith(prefix)) return false;
  const [given, expected] = await Promise.all([
    sha256Hex(authorization.slice(prefix.length)),
    sha256Hex(token),
  ]);
  return given === expected;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function handleWikiCalls(
  request: Request,
  subPath: string,
  store: WikiCallStore,
  token?: string,
): Promise<Response> {
  if (request.method === "POST" && subPath === "") {
    if (!(await tokenMatches(request.headers.get("Authorization"), token))) {
      return new Response("forbidden", { status: 403 });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    const count = parseReportedCount(body);
    if (count === null) return new Response("invalid count", { status: 400 });
    if (count > 0) await store.add("ci", count);
    return new Response(null, { status: 204 });
  }

  if (request.method === "GET" && isWikiCallBadge(subPath)) {
    return new Response(JSON.stringify(badgeJson(subPath, await store.totals())), {
      status: 200,
      headers: { ...JSON_HEADERS, "Cache-Control": "public, max-age=3600" },
    });
  }

  return new Response("not found", { status: 404 });
}
