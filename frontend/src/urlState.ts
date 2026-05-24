import type { Map } from "leaflet";

import type { AppContext } from "./appState.ts";
import type { MapHandles } from "./map.ts";
import type { Plane } from "./types.ts";

export interface MapViewParams {
  plane: Plane;
  mapId: number;
  x: number;
  y: number;
  zoom: number;
}

export const VIEW_URL_KEYS = ["plane", "map", "x", "y", "zoom"] as const;

const MIN_ZOOM = 0;
const MAX_ZOOM = 5;
const DEBOUNCE_MS = 300;

export const DEFAULT_VIEW: MapViewParams = {
  plane: 0,
  mapId: 0,
  x: 3222,
  y: 3218,
  zoom: 1,
};

export function clampPlane(value: number): Plane {
  return Math.max(0, Math.min(3, Math.round(value))) as Plane;
}

export function clampZoom(value: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(value)));
}

function parseIntParam(params: URLSearchParams, key: string, fallback: number): number {
  const raw = params.get(key);
  if (raw === null) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function parseViewFromUrl(search = window.location.search): MapViewParams | null {
  const params = new URLSearchParams(search);
  const hasViewParam =
    params.has("plane") ||
    params.has("map") ||
    params.has("x") ||
    params.has("y") ||
    params.has("zoom");
  if (!hasViewParam) return null;

  return {
    plane: clampPlane(parseIntParam(params, "plane", DEFAULT_VIEW.plane)),
    mapId: parseIntParam(params, "map", DEFAULT_VIEW.mapId),
    x: parseIntParam(params, "x", DEFAULT_VIEW.x),
    y: parseIntParam(params, "y", DEFAULT_VIEW.y),
    zoom: clampZoom(parseIntParam(params, "zoom", DEFAULT_VIEW.zoom)),
  };
}

export function viewParamsFromContext(ctx: AppContext, map: Map): MapViewParams {
  const center = map.getCenter();
  return {
    plane: ctx.currentPlane,
    mapId: ctx.currentMapId,
    x: Math.round(center.lng),
    y: Math.round(center.lat),
    zoom: map.getZoom(),
  };
}

export function buildViewSearch(params: MapViewParams): string {
  const sp = new URLSearchParams();
  sp.set("plane", String(params.plane));
  sp.set("map", String(params.mapId));
  sp.set("x", String(params.x));
  sp.set("y", String(params.y));
  sp.set("zoom", String(params.zoom));
  return sp.toString();
}

export function removeViewParamsFromSearch(search: string): string {
  const params = new URLSearchParams(search.replace(/^\?/, ""));
  for (const key of VIEW_URL_KEYS) {
    params.delete(key);
  }
  const remaining = params.toString();
  return remaining ? `?${remaining}` : "";
}

export function clearViewUrl(): void {
  const nextSearch = removeViewParamsFromSearch(window.location.search);
  const nextUrl = `${window.location.pathname}${nextSearch}`;
  const currentUrl = `${window.location.pathname}${window.location.search}`;
  if (currentUrl !== nextUrl) {
    history.replaceState(null, "", nextUrl);
  }
}

let urlSyncSuppressed = false;

export function suppressViewUrlSync(ms = DEBOUNCE_MS + 50): void {
  urlSyncSuppressed = true;
  window.setTimeout(() => {
    urlSyncSuppressed = false;
  }, ms);
}

export function syncUrlFromView(params: MapViewParams): void {
  const search = buildViewSearch(params);
  const nextUrl = `${window.location.pathname}?${search}`;
  const currentUrl = `${window.location.pathname}${window.location.search}`;
  if (currentUrl !== nextUrl) {
    history.replaceState(null, "", nextUrl);
  }
}

export function syncUrlNow(ctx: AppContext, handles: MapHandles): void {
  if (urlSyncSuppressed) return;
  syncUrlFromView(viewParamsFromContext(ctx, handles.map));
}

export function bindViewUrlSync(
  ctx: AppContext,
  handles: MapHandles,
  applyViewFromUrl: (params: MapViewParams) => void,
): void {
  let debounceTimer: number | undefined;
  let applyingFromUrl = false;

  const debouncedSync = (): void => {
    if (applyingFromUrl || urlSyncSuppressed) return;
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => syncUrlNow(ctx, handles), DEBOUNCE_MS);
  };

  handles.map.on("moveend zoomend", debouncedSync);

  window.addEventListener("popstate", () => {
    const params = parseViewFromUrl();
    if (!params) return;
    applyingFromUrl = true;
    applyViewFromUrl(params);
    applyingFromUrl = false;
  });
}
