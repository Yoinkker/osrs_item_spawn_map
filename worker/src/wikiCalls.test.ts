import { describe, expect, it, vi } from "vitest";

import {
  MAX_REPORTED_CALLS,
  type WikiCallStore,
  type WikiCallTotals,
  badgeJson,
  handleWikiCalls,
  parseReportedCount,
  tokenMatches,
  windowStartDay,
} from "./wikiCalls.ts";

const TOKEN = "s3cret";
const TOTALS: WikiCallTotals = { tiles: 1234, cron: 30, ci: 1500 };

function mockStore(): WikiCallStore {
  return {
    add: vi.fn(() => {
      return Promise.resolve();
    }),
    totals: vi.fn(() => {
      return Promise.resolve(TOTALS);
    }),
  };
}

function report(body: unknown, auth = `Bearer ${TOKEN}`): Request {
  return new Request("https://worker.example/api/wiki-calls", {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("windowStartDay", () => {
  it("covers today plus the 29 days before it", () => {
    expect(windowStartDay(new Date("2026-10-24T13:00:00Z"))).toBe("2026-09-25");
  });
});

describe("badgeJson", () => {
  it("sums CI and cron into the automated badge", () => {
    expect(badgeJson("automated", TOTALS)).toMatchObject({
      schemaVersion: 1,
      message: "1,530",
    });
  });

  it("shows only tile fetches on the site badge", () => {
    expect(badgeJson("site", TOTALS)).toMatchObject({ message: "1,234" });
  });
});

describe("parseReportedCount", () => {
  it("accepts a non-negative integer count", () => {
    expect(parseReportedCount({ count: 0 })).toBe(0);
    expect(parseReportedCount({ count: 42 })).toBe(42);
  });

  it("rejects anything else", () => {
    expect(parseReportedCount(null)).toBeNull();
    expect(parseReportedCount({ count: "42" })).toBeNull();
    expect(parseReportedCount({ count: 1.5 })).toBeNull();
    expect(parseReportedCount({ count: -1 })).toBeNull();
    expect(parseReportedCount({ count: MAX_REPORTED_CALLS + 1 })).toBeNull();
  });
});

describe("tokenMatches", () => {
  it("requires the exact bearer token", async () => {
    expect(await tokenMatches(`Bearer ${TOKEN}`, TOKEN)).toBe(true);
    expect(await tokenMatches(`Bearer ${TOKEN}x`, TOKEN)).toBe(false);
    expect(await tokenMatches(TOKEN, TOKEN)).toBe(false);
    expect(await tokenMatches(null, TOKEN)).toBe(false);
  });

  it("rejects everything when no token is configured", async () => {
    expect(await tokenMatches("Bearer ")).toBe(false);
    expect(await tokenMatches("Bearer ", "")).toBe(false);
  });
});

describe("handleWikiCalls", () => {
  it("records an authorized CI report", async () => {
    const store = mockStore();
    const resp = await handleWikiCalls(report({ count: 17 }), "", store, TOKEN);
    expect(resp.status).toBe(204);
    expect(store.add).toHaveBeenCalledWith("ci", 17);
  });

  it("refuses reports with the wrong token", async () => {
    const store = mockStore();
    const resp = await handleWikiCalls(report({ count: 17 }, "Bearer nope"), "", store, TOKEN);
    expect(resp.status).toBe(403);
    expect(store.add).not.toHaveBeenCalled();
  });

  it("refuses malformed reports", async () => {
    const store = mockStore();
    const resp = await handleWikiCalls(report({ count: "lots" }), "", store, TOKEN);
    expect(resp.status).toBe(400);
    expect(store.add).not.toHaveBeenCalled();
  });

  it("serves a shields.io badge for each counter", async () => {
    const resp = await handleWikiCalls(
      new Request("https://worker.example/api/wiki-calls/site"),
      "site",
      mockStore(),
      TOKEN,
    );
    expect(resp.status).toBe(200);
    expect(await resp.json()).toMatchObject({ message: "1,234" });
  });

  it("404s unknown badges", async () => {
    const resp = await handleWikiCalls(
      new Request("https://worker.example/api/wiki-calls/everything"),
      "everything",
      mockStore(),
      TOKEN,
    );
    expect(resp.status).toBe(404);
  });
});
