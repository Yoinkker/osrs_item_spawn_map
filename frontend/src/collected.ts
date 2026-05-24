import type { AppContext } from "./appState.ts";
import { setMarkerIcon, syncPopupBtn } from "./markers.ts";
import { updateRowCollected } from "./sidebar.ts";
import { parseCollectedImport, saveCollected, serializeCollectedExport } from "./state.ts";
import { showToast } from "./toast.ts";

export function updateStats(ctx: AppContext): void {
  const collectedCount = Object.values(ctx.collected).filter(Boolean).length;
  const statItems = document.querySelector("#stat-items");
  const statCollected = document.querySelector("#stat-collected");
  if (statItems) statItems.textContent = String(ctx.spawnData.length);
  if (statCollected) statCollected.textContent = String(collectedCount);
}

export function syncCollectedUI(ctx: AppContext): void {
  for (const item of ctx.spawnData) {
    const done = !!ctx.collected[item.item];
    for (const m of ctx.markers.byItem[item.item] ?? []) setMarkerIcon(m, item, done);
    updateRowCollected(item.item, done);
    for (const b of document.querySelectorAll<HTMLButtonElement>(
      `.popup-btn[data-item="${CSS.escape(item.item)}"]`,
    )) {
      syncPopupBtn(b, done);
    }
  }
  ctx.allCollected =
    ctx.spawnData.length > 0 && ctx.spawnData.every((item) => ctx.collected[item.item]);
  const toggleAllBtn = document.querySelector("#toggle-all-btn") as HTMLButtonElement | null;
  if (toggleAllBtn) toggleAllBtn.textContent = ctx.allCollected ? "Clear All" : "Mark All";
  updateStats(ctx);
}

export function exportCollected(ctx: AppContext): void {
  const json = serializeCollectedExport(ctx.collected);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "osrs-spawn-collected.json";
  link.click();
  URL.revokeObjectURL(url);
  const count = Object.values(ctx.collected).filter(Boolean).length;
  showToast(`Exported ${count} collected item${count === 1 ? "" : "s"}`);
}

export function importCollectedFromText(ctx: AppContext, text: string): void {
  const result = parseCollectedImport(text);
  if (!result.ok) {
    showToast(`Import failed: ${result.error}`);
    return;
  }

  const knownItems = new Set(ctx.spawnData.map((item) => item.item));
  let applied = 0;
  let skipped = 0;
  for (const name of result.items) {
    if (!knownItems.has(name)) {
      skipped++;
      continue;
    }
    ctx.collected[name] = true;
    applied++;
  }

  saveCollected(ctx.collected);
  syncCollectedUI(ctx);

  if (applied === 0 && skipped > 0) {
    showToast("Import failed: no matching items found");
    return;
  }
  if (skipped > 0) {
    showToast(`Imported ${applied} item${applied === 1 ? "" : "s"} (${skipped} unknown skipped)`);
    return;
  }
  showToast(`Imported ${applied} item${applied === 1 ? "" : "s"}`);
}

export function toggleItem(ctx: AppContext, name: string): void {
  ctx.collected[name] = !ctx.collected[name];
  saveCollected(ctx.collected);
  const item = ctx.spawnData.find((i) => i.item === name);
  if (item) {
    for (const m of ctx.markers.byItem[name] ?? []) {
      setMarkerIcon(m, item, !!ctx.collected[name]);
    }
  }
  updateRowCollected(name, !!ctx.collected[name]);
  for (const b of document.querySelectorAll<HTMLButtonElement>(
    `.popup-btn[data-item="${CSS.escape(name)}"]`,
  )) {
    syncPopupBtn(b, !!ctx.collected[name]);
  }
  updateStats(ctx);
}
