import { FALLBACK_TILE_VERSION } from "../../shared/tileVersion.ts";
import type { AppContext } from "./appState.ts";
import { fetchSpawnData, fetchTileVersion } from "./api.ts";
import {
  bindCollectedControls,
  bindImportExport,
  bindPlaneControls,
  bindSearch,
  createItemClickHandler,
  createPlaneClickHandler,
  createToggleHandler,
} from "./bindControls.ts";
import { updateStats } from "./collected.ts";
import { demoData } from "./demoData.ts";
import { createMap } from "./map.ts";
import { applyPlaneFilter, buildMarkers } from "./markers.ts";
import { applyFilter, buildSidebar } from "./sidebar.ts";
import { restoreSidebarVisibility } from "./sidebarLayout.ts";
import { loadCollected } from "./state.ts";

function hideLoadingOverlay(loading: HTMLElement): void {
  const FALLBACK_MS = 1000;
  let done = false;
  const finish = (): void => {
    if (done) return;
    done = true;
    loading.style.display = "none";
  };
  loading.addEventListener("transitionend", finish, { once: true });
  loading.style.opacity = "0";
  window.setTimeout(finish, FALLBACK_MS);
}

export async function initApp(ctx: AppContext): Promise<void> {
  ctx.collected = loadCollected();
  const loading = document.querySelector<HTMLElement>("#loading");
  const loadingP = loading?.querySelector<HTMLElement>("p");
  const setStatus = (msg: string): void => {
    if (loadingP) loadingP.textContent = msg;
  };
  setStatus("Detecting tile version…");

  let tileVersion: string;
  try {
    tileVersion = await fetchTileVersion();
  } catch (error) {
    console.warn("tile-version fetch failed, using fallback:", error);
    tileVersion = FALLBACK_TILE_VERSION;
  }

  setStatus("Initialising map…");
  const handles = createMap(
    tileVersion,
    () => ctx.currentPlane,
    () => ctx.currentMapId,
  );
  ctx.mapHandles = handles;

  setStatus("Loading spawn data…");
  try {
    ctx.spawnData = await fetchSpawnData();
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("Using demo data:", (error as Error).message);
      ctx.spawnData = demoData();
    } else {
      throw new Error(`Failed to load spawn data: ${(error as Error).message}`);
    }
  }

  setStatus("Building markers…");
  const onToggle = createToggleHandler(ctx);
  const onPlaneClick = createPlaneClickHandler(ctx, handles);
  ctx.markers = buildMarkers(
    ctx.spawnData,
    ctx.collected,
    onToggle,
    (name) => !!ctx.collected[name],
    onPlaneClick,
  );
  applyPlaneFilter(handles.markersGroup, ctx.markers.all, ctx.currentPlane, ctx.currentMapId);

  buildSidebar(ctx.spawnData, ctx.collected, {
    onToggleCollected: onToggle,
    onItemClick: createItemClickHandler(ctx, handles),
  });
  updateStats(ctx);
  applyFilter(ctx.filterText);

  bindPlaneControls(ctx, handles);
  bindSearch(ctx);
  restoreSidebarVisibility(ctx);
  bindCollectedControls(ctx);
  bindImportExport(ctx);

  if (loading) hideLoadingOverlay(loading);
}

export function showInitError(error: unknown): void {
  console.error(error);
  const p = document.querySelector("#loading p");
  if (p) p.textContent = "Error: " + (error as Error).message;
}
