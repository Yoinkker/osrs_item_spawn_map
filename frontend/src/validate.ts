import type { Coord, Spawn, SpawnItem } from "./types.ts";

export const MAX_IMPORT_FILE_BYTES = 1024 * 1024;
export const MAX_IMPORT_ITEMS = 10_000;

const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const BUNDLED_ICON_PATH_RE = /^\/icons\/[^/?#]+\.(png|gif|jpe?g)$/i;

export function isBundledIconPath(path: string): boolean {
  if (!path.startsWith("/icons/")) return false;
  if (/["<>\\]/.test(path)) return false;
  return BUNDLED_ICON_PATH_RE.test(path);
}

function isCoord(value: unknown): value is Coord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const c = value as { [key: string]: unknown };
  return (
    typeof c.x === "number" &&
    Number.isFinite(c.x) &&
    typeof c.y === "number" &&
    Number.isFinite(c.y) &&
    typeof c.qty === "number" &&
    Number.isFinite(c.qty) &&
    c.qty >= 1
  );
}

function normalizeMembers(value: unknown): "Yes" | "No" | "?" | null {
  if (value === "?") return "?";
  if (typeof value !== "string") return null;
  const lower = value.toLowerCase();
  if (lower === "yes") return "Yes";
  if (lower === "no") return "No";
  return null;
}

function isSpawn(value: unknown): value is Spawn {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const s = value as { [key: string]: unknown };
  if (typeof s.location !== "string") return false;
  if (normalizeMembers(s.members) === null) return false;
  if (typeof s.map_id !== "number" || !Number.isFinite(s.map_id)) return false;
  if (typeof s.plane !== "number" || !Number.isFinite(s.plane)) return false;
  if (!Array.isArray(s.coords) || !s.coords.every(isCoord)) return false;
  return true;
}

function isSpawnItem(value: unknown): value is SpawnItem {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const item = value as { [key: string]: unknown };
  if (typeof item.item !== "string" || item.item.length === 0) return false;
  if (item.quest !== null && typeof item.quest !== "string") return false;
  if (item.image_file !== null && typeof item.image_file !== "string") return false;
  if (
    item.image_url !== null &&
    (typeof item.image_url !== "string" || !isBundledIconPath(item.image_url))
  ) {
    return false;
  }
  if (!Array.isArray(item.spawns) || !item.spawns.every(isSpawn)) return false;
  return true;
}

function normalizeSpawnItem(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
  const item = value as { [key: string]: unknown };
  if (!Array.isArray(item.spawns)) return item;
  const spawns = item.spawns.map((spawn) => {
    if (typeof spawn !== "object" || spawn === null || Array.isArray(spawn)) return spawn;
    const s = spawn as { [key: string]: unknown };
    const members = normalizeMembers(s.members);
    return members === null ? s : { ...s, members };
  });
  return { ...item, spawns };
}

export function parseSpawnItems(data: unknown): SpawnItem[] {
  if (!Array.isArray(data)) {
    throw new TypeError("Expected spawn data to be a JSON array");
  }
  const normalized = data.map((item) => normalizeSpawnItem(item));
  if (!normalized.every(isSpawnItem)) {
    throw new Error("Spawn data failed validation");
  }
  return normalized;
}

export function isCollectedMap(value: unknown): value is { [key: string]: boolean } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") return false;
    if (UNSAFE_KEYS.has(key)) return false;
    const val = (value as { [key: string]: unknown })[key];
    if (typeof val !== "boolean") return false;
  }
  return true;
}

export function sanitizeImportItems(items: string[]): string[] {
  if (items.length > MAX_IMPORT_ITEMS) {
    throw new Error(`Too many items (max ${MAX_IMPORT_ITEMS})`);
  }
  return items.filter((name) => typeof name === "string" && name.length > 0);
}
