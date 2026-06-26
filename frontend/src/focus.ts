import L from "leaflet";

import type { AppContext } from "./appState.ts";
import {
  FULL_MAP_MAX_BOUNDS,
  OVERWORLD_MAX_BOUNDS,
  UNDERGROUND_FALLBACK_BOUNDS,
  type MapHandles,
} from "./map.ts";
import {
  applyPlaneFilter,
  hasOverworldSpawn,
  hasUndergroundSpawn,
  type MarkerRef,
} from "./markers.ts";
import { updateRowFocus } from "./sidebar.ts";
import { showToast } from "./toast.ts";
import type { Plane, SpawnItem } from "./types.ts";
import { syncUrlNow } from "./urlState.ts";

export function setPlane(
  ctx: AppContext,
  p: Plane,
  mapId: number,
  group: L.LayerGroup,
  updateMap: (p: Plane) => void,
): void {
  ctx.currentPlane = p;
  ctx.currentMapId = mapId;
  updateMap(p);
  applyPlaneFilter(group, ctx.markers.all, ctx.currentPlane, ctx.currentMapId, ctx.showQuest);
  if (ctx.mapHandles) syncUrlNow(ctx, ctx.mapHandles);
}

function applyMapBounds(ctx: AppContext, mapId: number, handles: MapHandles): void {
  if (mapId === 0) {
    handles.map.setMaxBounds(OVERWORLD_MAX_BOUNDS);
    return;
  }
  if (mapId === -1) {
    handles.map.setMaxBounds(FULL_MAP_MAX_BOUNDS);
    return;
  }
  const onMap = ctx.markers.all.filter((m) => m.mapId === mapId);
  if (onMap.length > 0) {
    const latlngs = onMap.map((m) => m.marker.getLatLng());
    handles.map.setMaxBounds(L.latLngBounds(latlngs).pad(1));
    return;
  }
  handles.map.setMaxBounds(UNDERGROUND_FALLBACK_BOUNDS);
}

function sortedItemMarkers(ctx: AppContext, itemName: string): MarkerRef[] {
  return ctx.markers.all
    .filter((m) => m.itemName === itemName)
    .sort((a, b) => {
      if (a.mapId !== b.mapId) return a.mapId - b.mapId;
      if (a.plane !== b.plane) return a.plane - b.plane;
      const al = a.marker.getLatLng();
      const bl = b.marker.getLatLng();
      if (al.lat !== bl.lat) return al.lat - bl.lat;
      return al.lng - bl.lng;
    });
}

function nearestMarkerIndex(map: L.Map, refs: MarkerRef[]): number {
  const center = map.getCenter();
  let nearestIdx = 0;
  let nearestDist = center.distanceTo(refs[0]!.marker.getLatLng());
  for (let i = 1; i < refs.length; i++) {
    const dist = center.distanceTo(refs[i]!.marker.getLatLng());
    if (dist < nearestDist) {
      nearestIdx = i;
      nearestDist = dist;
    }
  }
  return nearestIdx;
}

function focusMapView(handles: MapHandles, target: L.LatLng, zoom?: number): void {
  handles.map.invalidateSize();
  handles.map.setView(target, zoom ?? handles.map.getMaxZoom());
  handles.tileLayer.redraw();
}

function focusOnMarkerRef(ctx: AppContext, handles: MapHandles, ref: MarkerRef): void {
  const latlng = ref.marker.getLatLng();
  if (ref.mapId !== ctx.currentMapId || ref.plane !== ctx.currentPlane) {
    navigateToMapId(ctx, ref.mapId, ref.plane, handles, latlng);
  } else {
    applyMapBounds(ctx, ctx.currentMapId, handles);
    applyPlaneFilter(
      handles.markersGroup,
      ctx.markers.all,
      ctx.currentPlane,
      ctx.currentMapId,
      ctx.showQuest,
    );
    focusMapView(handles, latlng);
    syncUrlNow(ctx, handles);
  }
  ref.marker.openPopup();
}

export function focusOnItem(ctx: AppContext, item: SpawnItem, handles: MapHandles): void {
  const hasMapMarker = hasOverworldSpawn(item) || hasUndergroundSpawn(item);
  if (!hasMapMarker) {
    showToast(`${item.item} only spawns in an instance - map not available`);
    return;
  }

  const itemMarkers = sortedItemMarkers(ctx, item.item);
  if (itemMarkers.length === 0) return;

  if (ctx.lastFocusedItem === item.item) {
    ctx.focusedSpawnIndex = (ctx.focusedSpawnIndex + 1) % itemMarkers.length;
  } else {
    ctx.lastFocusedItem = item.item;
    ctx.focusedSpawnIndex = nearestMarkerIndex(handles.map, itemMarkers);
  }

  focusOnMarkerRef(ctx, handles, itemMarkers[ctx.focusedSpawnIndex]!);
  updateRowFocus(item.item, ctx.focusedSpawnIndex, itemMarkers.length);
}

export function navigateToMapId(
  ctx: AppContext,
  mapId: number,
  plane: Plane,
  handles: MapHandles,
  focusLatLng?: L.LatLng,
  zoom?: number,
): void {
  setPlane(ctx, plane, mapId, handles.markersGroup, handles.setPlane);
  const undergroundBtn = document.querySelector<HTMLButtonElement>("#underground-btn");
  if (undergroundBtn) undergroundBtn.classList.toggle("active", mapId !== 0);
  for (const b of document.querySelectorAll<HTMLButtonElement>(".plane-btn")) {
    b.classList.toggle("active", Number.parseInt(b.dataset.plane ?? "0", 10) === plane);
  }

  if (focusLatLng) {
    applyMapBounds(ctx, mapId, handles);
    focusMapView(handles, focusLatLng, zoom);
    syncUrlNow(ctx, handles);
    return;
  }

  if (mapId === 0) {
    handles.setMapRegion(OVERWORLD_MAX_BOUNDS, [3218, 3222], 1);
  } else if (mapId === -1) {
    handles.setMapRegion(FULL_MAP_MAX_BOUNDS, [3328, 2496], 1);
  } else {
    const onMap = ctx.markers.all.filter((m) => m.mapId === mapId);
    if (onMap.length > 0) {
      const latlngs = onMap.map((m) => m.marker.getLatLng());
      const bounds = L.latLngBounds(latlngs).pad(1);
      handles.setMapRegion(bounds, bounds.getCenter(), 2);
    } else {
      handles.setMapRegion(UNDERGROUND_FALLBACK_BOUNDS, [9600, 3200], 1);
    }
  }
  syncUrlNow(ctx, handles);
}
