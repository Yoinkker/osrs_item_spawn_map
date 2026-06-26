import { isCollectedMap, sanitizeImportItems } from "./validate.ts";

const STORAGE_KEY = "osrs_c";
const SIDEBAR_KEY = "osrs_sidebar";
const SHOW_QUEST_KEY = "osrs_show_quest";

export type CollectedMap = { [key: string]: boolean };

export interface CollectedExport {
  version: 1;
  collected: string[];
  exportedAt: string;
}

export type CollectedImportResult = { ok: true; items: string[] } | { ok: false; error: string };

function isRecord(value: unknown): value is { [key: string]: unknown } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function itemsFromCollectedMap(map: CollectedMap): string[] {
  return Object.keys(map).filter((name) => map[name]);
}

export function serializeCollectedExport(collected: CollectedMap): string {
  const payload: CollectedExport = {
    version: 1,
    collected: itemsFromCollectedMap(collected).sort(),
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(payload, null, 2);
}

export function parseCollectedImport(text: string): CollectedImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "Invalid JSON" };
  }

  let items: string[];
  try {
    if (Array.isArray(parsed)) {
      if (!parsed.every((item) => typeof item === "string")) {
        return { ok: false, error: "Expected an array of item names" };
      }
      items = parsed;
    } else if (!isRecord(parsed)) {
      return { ok: false, error: "Expected a JSON object or array" };
    } else if (Array.isArray(parsed.collected)) {
      if (!parsed.collected.every((item) => typeof item === "string")) {
        return { ok: false, error: "Expected collected to be an array of item names" };
      }
      items = parsed.collected;
    } else if (isCollectedMap(parsed)) {
      items = itemsFromCollectedMap(parsed);
    } else {
      return { ok: false, error: "Unrecognised export format" };
    }
    items = sanitizeImportItems(items);
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }

  return { ok: true, items };
}

export function loadCollected(): CollectedMap {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) {
      const parsed: unknown = JSON.parse(s);
      if (isCollectedMap(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return {};
}

export function saveCollected(collected: CollectedMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collected));
  } catch {
    // ignore
  }
}

export function loadSidebarVisible(): boolean {
  try {
    const s = localStorage.getItem(SIDEBAR_KEY);
    if (s === "0") return false;
    if (s === "1") return true;
    return !window.matchMedia("(max-width: 640px)").matches;
  } catch {
    return true;
  }
}

export function saveSidebarVisible(visible: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_KEY, visible ? "1" : "0");
  } catch {
    // ignore
  }
}

export function loadShowQuest(): boolean {
  try {
    return localStorage.getItem(SHOW_QUEST_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveShowQuest(show: boolean): void {
  try {
    localStorage.setItem(SHOW_QUEST_KEY, show ? "1" : "0");
  } catch {
    // ignore
  }
}
