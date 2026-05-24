import type { SpawnItem } from "./types.ts";
import { parseSpawnItems } from "./validate.ts";

const WORKER_BASE = import.meta.env.VITE_WORKER_URL ?? "";

function hasStringVersion(value: unknown): value is { version: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { version?: unknown }).version === "string"
  );
}

export async function fetchTileVersion(): Promise<string> {
  const r = await fetch(`${WORKER_BASE}/api/tile-version`);
  if (!r.ok) throw new Error(`tile-version HTTP ${r.status}`);
  const data: unknown = await r.json();
  if (!hasStringVersion(data)) throw new Error("Invalid tile-version response");
  return data.version;
}

export async function fetchSpawnData(): Promise<SpawnItem[]> {
  const r = await fetch("/spawn_items.json");
  if (!r.ok) throw new Error(`spawn data HTTP ${r.status}`);
  return parseSpawnItems(await r.json());
}

export function tileProxyBase(): string {
  return `${WORKER_BASE}/tile-proxy/tiles`;
}
