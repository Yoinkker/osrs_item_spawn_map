import type { AppContext } from "./appState.ts";
import {
  exportCollected,
  importCollectedFromText,
  syncCollectedUI,
  toggleItem,
} from "./collected.ts";
import { focusOnItem, navigateToMapId, setPlane } from "./focus.ts";
import type { MapHandles } from "./map.ts";
import { applyFilter, updateRowFocus } from "./sidebar.ts";
import { saveCollected } from "./state.ts";
import { showToast } from "./toast.ts";
import type { Plane, SpawnItem } from "./types.ts";
import { MAX_IMPORT_FILE_BYTES } from "./validate.ts";

export function bindPlaneControls(ctx: AppContext, handles: MapHandles): void {
  for (const b of document.querySelectorAll<HTMLButtonElement>(".plane-btn")) {
    b.addEventListener("click", () => {
      const p = Number.parseInt(b.dataset.plane ?? "0", 10) as Plane;
      setPlane(ctx, p, ctx.currentMapId, handles.markersGroup, handles.setPlane);
    });
  }

  const undergroundBtn = document.querySelector<HTMLButtonElement>("#underground-btn");
  if (undergroundBtn) {
    undergroundBtn.addEventListener("click", () => {
      navigateToMapId(ctx, 0, 0, handles);
      ctx.lastFocusedItem = null;
      updateRowFocus(null, 0, 0);
    });
  }
}

export function bindSearch(ctx: AppContext): void {
  const searchEl = document.querySelector<HTMLInputElement>("#search");
  const clearBtn = document.querySelector<HTMLButtonElement>("#search-clear");
  if (!searchEl || !clearBtn) return;

  searchEl.addEventListener("input", () => {
    ctx.filterText = searchEl.value.toLowerCase();
    clearBtn.style.display = ctx.filterText ? "block" : "none";
    applyFilter(ctx.filterText);
  });
  clearBtn.addEventListener("click", () => {
    searchEl.value = "";
    ctx.filterText = "";
    clearBtn.style.display = "none";
    applyFilter(ctx.filterText);
  });
}

export function bindCollectedControls(ctx: AppContext): void {
  document.querySelector<HTMLButtonElement>("#toggle-all-btn")?.addEventListener("click", () => {
    ctx.allCollected = !ctx.allCollected;
    for (const i of ctx.spawnData) ctx.collected[i.item] = ctx.allCollected;
    saveCollected(ctx.collected);
    syncCollectedUI(ctx);
  });

  document
    .querySelector<HTMLButtonElement>("#export-btn")
    ?.addEventListener("click", () => exportCollected(ctx));
}

export function bindImportExport(ctx: AppContext): void {
  const importBtn = document.querySelector<HTMLButtonElement>("#import-btn");
  const importFile = document.querySelector<HTMLInputElement>("#import-file");
  if (!importBtn || !importFile) return;

  importBtn.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", () => {
    const file = importFile.files?.[0];
    importFile.value = "";
    if (!file) return;
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      showToast("Import failed: file too large (max 1 MB)");
      return;
    }
    file
      .text()
      .then((text) => importCollectedFromText(ctx, text))
      .catch(() => showToast("Import failed: could not read file"));
  });
}

export function createToggleHandler(ctx: AppContext): (name: string) => void {
  return (name) => toggleItem(ctx, name);
}

export function createItemClickHandler(
  ctx: AppContext,
  handles: MapHandles,
): (item: SpawnItem) => void {
  return (item) => focusOnItem(ctx, item, handles);
}
