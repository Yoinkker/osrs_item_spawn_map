import L from "leaflet";

import { effectiveMapId, isOverworld, isUnderground } from "./mapSpawn.ts";
import { overlapKey, overlapPosition } from "./markerOverlap.ts";
import { toLL } from "./map.ts";
import type { CollectedMap } from "./state.ts";
import type { Coord, Plane, Spawn, SpawnItem } from "./types.ts";
import { isBundledIconPath } from "./validate.ts";
import { wikiItemLink } from "./wikiUrl.ts";

const MARKER_ICON_SIZE: [number, number] = [30, 36];
const MARKER_ICON_ANCHOR: [number, number] = [15, 36];
const POPUP_MAX_WIDTH = 240;
const ADJACENT_PLANE_CLASS = "adjacent-plane";

interface MarkerPlaneState {
  adjacentPlane?: boolean;
}

function getSpawnMarkerEl(marker: L.Marker): HTMLElement | null {
  return marker.getElement()?.querySelector<HTMLElement>(".spawn-marker") ?? null;
}

function setMarkerAdjacentPlane(marker: L.Marker, adjacent: boolean): void {
  (marker as L.Marker & MarkerPlaneState).adjacentPlane = adjacent;
  getSpawnMarkerEl(marker)?.classList.toggle(ADJACENT_PLANE_CLASS, adjacent);
}

function reapplyMarkerAdjacentPlane(marker: L.Marker): void {
  const adjacent = !!(marker as L.Marker & MarkerPlaneState).adjacentPlane;
  getSpawnMarkerEl(marker)?.classList.toggle(ADJACENT_PLANE_CLASS, adjacent);
}

function attachMarkerIconErrorHandler(marker: L.Marker): void {
  const img = marker.getElement()?.querySelector<HTMLImageElement>("img.marker-icon");
  if (!img || img.dataset.errorBound === "true") return;
  img.dataset.errorBound = "true";
  img.addEventListener(
    "error",
    () => {
      img.style.display = "none";
    },
    { once: true },
  );
}

export function bindMarkerIconImageErrors(marker: L.Marker): void {
  marker.on("add", () => attachMarkerIconErrorHandler(marker));
  attachMarkerIconErrorHandler(marker);
}

export function setMarkerIcon(marker: L.Marker, item: SpawnItem, done: boolean): void {
  marker.setIcon(makeIcon(item, done));
  attachMarkerIconErrorHandler(marker);
  reapplyMarkerAdjacentPlane(marker);
}

export function countMapMarkers(item: SpawnItem): number {
  let n = 0;
  for (const spawn of item.spawns) {
    if (isOverworld(spawn) || isUnderground(spawn)) n += spawn.coords.length;
  }
  return n;
}

export function hasOverworldSpawn(item: SpawnItem): boolean {
  return item.spawns.some(isOverworld);
}

export function hasUndergroundSpawn(item: SpawnItem): boolean {
  return item.spawns.some(isUnderground);
}

export function isQuestItem(item: SpawnItem): boolean {
  return item.quest !== null && item.quest !== "No";
}

function buildMarkerIconHtml(item: SpawnItem, done: boolean): string {
  const wrap = document.createElement("div");
  wrap.className = "spawn-marker";

  const bg = document.createElement("div");
  bg.className = `marker-bg ${done ? "collected" : "uncollected"}`;
  wrap.append(bg);

  if (item.image_url && isBundledIconPath(item.image_url)) {
    const img = document.createElement("img");
    img.className = "marker-icon";
    img.src = item.image_url;
    img.alt = "";
    wrap.append(img);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "marker-icon";
    placeholder.style.width = "14px";
    placeholder.style.height = "14px";
    placeholder.style.borderRadius = "50%";
    placeholder.style.background = "rgba(255,255,255,.3)";
    wrap.append(placeholder);
  }

  return wrap.outerHTML;
}

export function makeIcon(item: SpawnItem, done: boolean): L.DivIcon {
  return L.divIcon({
    className: "",
    html: buildMarkerIconHtml(item, done),
    iconSize: MARKER_ICON_SIZE,
    iconAnchor: MARKER_ICON_ANCHOR,
    popupAnchor: [0, -38],
    tooltipAnchor: [0, -36],
  });
}

export interface MarkerRef {
  marker: L.Marker;
  plane: Plane;
  mapId: number;
  itemName: string;
  isQuest: boolean;
}

export interface MarkerIndex {
  all: MarkerRef[];
  byItem: { [key: string]: L.Marker[] };
}

export function syncPopupBtn(btn: HTMLButtonElement, done: boolean): void {
  btn.textContent = done ? "✓ Collected" : "Mark as Collected";
  btn.classList.toggle("collected", done);
}

function appendPopupImage(header: HTMLElement, imageUrl: string | null): void {
  if (!imageUrl || !isBundledIconPath(imageUrl)) return;
  const img = document.createElement("img");
  img.src = imageUrl;
  img.alt = "";
  img.addEventListener("error", () => (img.style.display = "none"));
  header.append(img);
}

function buildMarkerTooltip(item: SpawnItem): HTMLElement {
  const el = document.createElement("div");
  el.className = "marker-tooltip";
  el.append(wikiItemLink(item.item));
  const hint = document.createElement("span");
  hint.className = "marker-tooltip-hint";
  hint.textContent = " · Ctrl+click to mark collected";
  el.append(hint);
  return el;
}

interface PendingMarker {
  item: SpawnItem;
  spawn: Spawn;
  coord: Coord;
  plane: Plane;
  mapId: number;
}

function collectPendingMarkers(spawnData: SpawnItem[]): PendingMarker[] {
  const pending: PendingMarker[] = [];
  for (const item of spawnData) {
    for (const spawn of item.spawns) {
      if (!isOverworld(spawn) && !isUnderground(spawn)) continue;
      const plane = (spawn.plane || 0) as Plane;
      const mapId = effectiveMapId(spawn);
      for (const coord of spawn.coords) {
        pending.push({ item, spawn, coord, plane, mapId });
      }
    }
  }
  return pending;
}

function groupPendingMarkers(pending: PendingMarker[]): Map<string, PendingMarker[]> {
  const groups = new Map<string, PendingMarker[]>();
  for (const entry of pending) {
    const key = overlapKey(entry.mapId, entry.plane, entry.coord.x, entry.coord.y);
    const group = groups.get(key);
    if (group) group.push(entry);
    else groups.set(key, [entry]);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => a.item.item.localeCompare(b.item.item));
  }
  return groups;
}

export function buildMarkers(
  spawnData: SpawnItem[],
  collected: CollectedMap,
  onToggle: (name: string) => void,
  isCollected: (name: string) => boolean = (name) => !!collected[name],
  onPlaneClick?: (plane: Plane, mapId: number, marker: L.Marker) => void,
): MarkerIndex {
  const all: MarkerRef[] = [];
  const byItem: { [key: string]: L.Marker[] } = {};
  const groups = groupPendingMarkers(collectPendingMarkers(spawnData));

  for (const group of groups.values()) {
    for (const [index, entry] of group.entries()) {
      const { item, spawn, coord, plane, mapId } = entry;
      if (!byItem[item.item]) byItem[item.item] = [];

      const pos = overlapPosition(coord.x, coord.y, index, group.length);
      const done = !!collected[item.item];
      const m = L.marker(toLL(pos.x, pos.y), {
        icon: makeIcon(item, done),
      });
      bindMarkerIconImageErrors(m);
      m.on("add", () => reapplyMarkerAdjacentPlane(m));
      m.bindTooltip(buildMarkerTooltip(item), {
        direction: "top",
        offset: [0, -4],
        opacity: 0.95,
        interactive: true,
        className: "spawn-tooltip",
      });
      const qty = coord.qty > 1 ? ` ×${coord.qty}` : "";
      const loc = spawn.location;

      const container = document.createElement("div");
      container.className = "popup-inner";

      const header = document.createElement("div");
      header.className = "popup-header";
      appendPopupImage(header, item.image_url);
      const h3 = document.createElement("h3");
      h3.append(wikiItemLink(item.item, item.item + qty));
      header.append(h3);
      container.append(header);

      const locDiv = document.createElement("div");
      locDiv.className = "popup-loc";
      locDiv.textContent = loc + (plane ? ` · Floor ${plane}` : "");
      container.append(locDiv);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "popup-btn" + (done ? " collected" : "");
      btn.dataset.item = item.item;
      btn.textContent = done ? "✓ Collected" : "Mark as Collected";
      btn.addEventListener("click", (e) => {
        L.DomEvent.stopPropagation(e);
        onToggle(item.item);
      });
      container.append(btn);

      m.bindPopup(container, { maxWidth: POPUP_MAX_WIDTH });
      m.on("click", (e) => {
        const ev = e.originalEvent as MouseEvent;
        if (ev.ctrlKey || ev.metaKey) {
          L.DomEvent.stop(e);
          onToggle(item.item);
          return;
        }
        if ((m as L.Marker & MarkerPlaneState).adjacentPlane && onPlaneClick) {
          L.DomEvent.stop(e);
          onPlaneClick(plane, mapId, m);
        }
      });
      m.on("popupopen", () => {
        m.closeTooltip();
        syncPopupBtn(btn, isCollected(item.item));
      });
      byItem[item.item]!.push(m);
      all.push({ marker: m, plane, mapId, itemName: item.item, isQuest: isQuestItem(item) });
    }
  }
  return { all, byItem };
}

export function applyPlaneFilter(
  group: L.LayerGroup,
  all: MarkerRef[],
  currentPlane: Plane,
  currentMapId: number,
  showQuest: boolean,
): void {
  for (const { marker, plane, mapId, isQuest } of all) {
    if (mapId !== currentMapId || (isQuest && !showQuest)) {
      group.removeLayer(marker);
      setMarkerAdjacentPlane(marker, false);
      marker.setZIndexOffset(0);
      continue;
    }
    group.addLayer(marker);
    const planeDelta = Math.abs(plane - currentPlane);
    const onCurrentPlane = planeDelta === 0;
    setMarkerAdjacentPlane(marker, !onCurrentPlane);
    marker.setZIndexOffset(onCurrentPlane ? 1000 : Math.max(0, 1000 - planeDelta * 100));
  }
}
