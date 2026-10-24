import { DurableObject } from "cloudflare:workers";

import type { Env } from "./config.ts";
import {
  WIKI_CALL_SOURCES,
  type WikiCallSource,
  type WikiCallTotals,
  utcDay,
  windowStartDay,
} from "./wikiCalls.ts";

export class WikiCallCounter extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS calls (
        day TEXT NOT NULL,
        source TEXT NOT NULL,
        n INTEGER NOT NULL,
        PRIMARY KEY (day, source)
      )`,
    );
  }

  add(source: WikiCallSource, n: number): void {
    const now = new Date();
    this.ctx.storage.sql.exec(
      `INSERT INTO calls (day, source, n) VALUES (?, ?, ?)
       ON CONFLICT (day, source) DO UPDATE SET n = n + excluded.n`,
      utcDay(now),
      source,
      n,
    );
    this.ctx.storage.sql.exec("DELETE FROM calls WHERE day < ?", windowStartDay(now));
  }

  tryAdd(source: WikiCallSource, n: number, dailyLimit: number): boolean {
    const [row] = this.ctx.storage.sql
      .exec<{ n: number }>(
        "SELECT n FROM calls WHERE day = ? AND source = ?",
        utcDay(new Date()),
        source,
      )
      .toArray();
    const used = row?.n ?? 0;
    if (used + n > dailyLimit) return false;
    this.add(source, n);
    if (used + n === dailyLimit) {
      console.error("wikiCalls: daily budget reached for", source, dailyLimit);
    }
    return true;
  }

  totals(): WikiCallTotals {
    const totals = Object.fromEntries(WIKI_CALL_SOURCES.map((s) => [s, 0])) as WikiCallTotals;
    const rows = this.ctx.storage.sql.exec<{ source: string; n: number }>(
      "SELECT source, SUM(n) AS n FROM calls WHERE day >= ? GROUP BY source",
      windowStartDay(new Date()),
    );
    for (const { source, n } of rows) {
      if (Object.hasOwn(totals, source)) totals[source as WikiCallSource] = n;
    }
    return totals;
  }
}

export function wikiCallStore(env: Env): DurableObjectStub<WikiCallCounter> {
  return env.WIKI_CALLS.get(env.WIKI_CALLS.idFromName("global"));
}
