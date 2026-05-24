import L from "leaflet";

import { tileProxyBase } from "./api.ts";
import type { Plane } from "./types.ts";
import {
  GITHUB_REPO_URL,
  WIKI_BASE,
  WIKI_ITEM_SPAWN_URL,
  WIKI_LICENSE_URL,
  WIKI_MAPS_BASE,
} from "./wikiUrl.ts";

// Game y as lat - CRS.Simple negates lat so north is up.
export function toLL(x: number, y: number): L.LatLng {
  return L.latLng(y, x);
}

const BLANK_TILE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=";

export interface MapHandles {
  map: L.Map;
  tileLayer: L.TileLayer;
  markersGroup: L.LayerGroup;
  setPlane(p: Plane): void;
  setMapRegion(bounds: L.LatLngBoundsExpression, center: L.LatLngExpression, zoom: number): void;
}

const DEFAULT_CENTER_X = 3222;
const DEFAULT_CENTER_Y = 3218;

export const OVERWORLD_MAX_BOUNDS: L.LatLngBoundsExpression = [
  [2048, 768],
  [6400, 4096],
];

export const FULL_MAP_MAX_BOUNDS: L.LatLngBoundsExpression = [
  [1152, 896],
  [12672, 4288],
];

export const UNDERGROUND_FALLBACK_BOUNDS: L.LatLngBoundsExpression = [
  [6400, 0],
  [12800, 12800],
];

export function createMap(
  tileVersion: string,
  getPlane: () => Plane,
  getMapId: () => number,
): MapHandles {
  const map = L.map("map", {
    crs: L.CRS.Simple,
    minZoom: 0,
    maxZoom: 5,
    zoom: 1,
    center: toLL(DEFAULT_CENTER_X, DEFAULT_CENTER_Y),
  });

  const tileLayer = L.tileLayer("", {
    tileSize: 256,
    minNativeZoom: 0,
    maxNativeZoom: 3,
    noWrap: true,
    attribution:
      `Map tiles © <a href="${WIKI_MAPS_BASE}/">RuneScape Wiki Maps</a> · ` +
      `Spawn data from <a href="${WIKI_ITEM_SPAWN_URL}">Item_spawn</a> · ` +
      `© <a href="${WIKI_BASE}/">OSRS Wiki</a> · ` +
      `<a href="${WIKI_LICENSE_URL}">CC BY-NC-SA 3.0</a> · ` +
      `<a href="${GITHUB_REPO_URL}">GitHub</a>`,
  });
  const OVERWORLD_BOUNDS: {
    [z: number]: { minTx: number; maxTx: number; minTy: number; maxTy: number };
  } = {
    0: { minTx: 3, maxTx: 15, minTy: 8, maxTy: 16 },
    1: { minTx: 7, maxTx: 31, minTy: 16, maxTy: 32 },
    2: { minTx: 14, maxTx: 62, minTy: 32, maxTy: 65 },
    3: { minTx: 28, maxTx: 124, minTy: 64, maxTy: 131 },
  };

  const base = tileProxyBase();
  tileLayer.getTileUrl = function (coords: L.Coords): string {
    const z = Math.max(0, Math.min(3, coords.z));
    const tx = coords.x;
    const ty = -coords.y - 1;
    if (tx < 0 || ty < 0) return BLANK_TILE;
    const mapId = getMapId();
    if (mapId === 0) {
      const b = OVERWORLD_BOUNDS[z];
      if (b && (tx < b.minTx || tx > b.maxTx || ty < b.minTy || ty > b.maxTy)) {
        return BLANK_TILE;
      }
    }
    return `${base}/${mapId}_${tileVersion}/${z}/${getPlane()}_${tx}_${ty}.png`;
  };
  tileLayer.addTo(map);

  const markersGroup = L.layerGroup().addTo(map);

  function setPlane(p: Plane): void {
    for (const b of document.querySelectorAll<HTMLButtonElement>(".plane-btn")) {
      b.classList.toggle("active", Number.parseInt(b.dataset.plane ?? "0", 10) === p);
    }
    tileLayer.redraw();
  }

  function setMapRegion(
    bounds: L.LatLngBoundsExpression,
    center: L.LatLngExpression,
    zoom: number,
  ): void {
    map.setMaxBounds(bounds);
    map.setView(center, zoom);
    tileLayer.redraw();
  }

  return { map, tileLayer, markersGroup, setPlane, setMapRegion };
}
