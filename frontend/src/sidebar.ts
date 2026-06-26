import { buildSearchText } from "./itemSearch.ts";
import { countMapMarkers, hasOverworldSpawn, hasUndergroundSpawn, isQuestItem } from "./markers.ts";
import type { CollectedMap } from "./state.ts";
import type { SpawnItem } from "./types.ts";
import { isBundledIconPath } from "./validate.ts";

export interface SidebarHandlers {
  onItemClick(item: SpawnItem): void;
  onToggleCollected(name: string): void;
}

export function buildSidebar(
  spawnData: SpawnItem[],
  collected: CollectedMap,
  handlers: SidebarHandlers,
): void {
  const list = document.querySelector("#item-list");
  if (!list) return;
  for (const r of list.querySelectorAll(".item-row")) r.remove();
  const noResults = document.querySelector("#no-results");

  for (const item of spawnData) {
    const row = document.createElement("div");
    const hasMap = hasOverworldSpawn(item) || hasUndergroundSpawn(item);
    const isQuest = isQuestItem(item);
    row.className =
      "item-row" +
      (collected[item.item] ? " collected" : "") +
      (hasMap ? "" : " no-overworld") +
      (isQuest ? " quest" : "");
    row.dataset.item = item.item;
    row.dataset.search = buildSearchText(item);
    if (isQuest) row.dataset.quest = "1";
    const markerCount = countMapMarkers(item);
    row.dataset.markerCount = String(markerCount);
    const titleSuffix = hasMap ? "" : " (instance - map not available)";

    if (item.image_url && isBundledIconPath(item.image_url)) {
      const img = document.createElement("img");
      img.className = "item-icon";
      img.src = item.image_url;
      img.alt = "";
      img.addEventListener("error", () => (img.style.display = "none"));
      row.append(img);
    }
    const nameEl = document.createElement("span");
    nameEl.className = "item-name";
    nameEl.textContent = item.item;
    nameEl.title = `${item.item}${titleSuffix}`;
    row.append(nameEl);

    if (isQuest) {
      const badge = document.createElement("span");
      badge.className = "quest-badge";
      badge.textContent = "quest";
      badge.title = "Used in a quest";
      row.append(badge);
    }

    const countSpan = document.createElement("span");
    countSpan.className = "item-count";
    countSpan.textContent = String(markerCount);
    row.append(countSpan);

    const check = document.createElement("div");
    check.className = "item-check";
    check.title = "Toggle collected";
    row.append(check);
    row.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains("item-check")) {
        handlers.onToggleCollected(item.item);
        return;
      }
      handlers.onItemClick(item);
    });
    if (noResults) noResults.before(row);
    else list.append(row);
  }
}

export function applyFilter(filterText: string, showQuest: boolean): void {
  let n = 0;
  for (const r of document.querySelectorAll<HTMLElement>(".item-row")) {
    const haystack = r.dataset.search ?? (r.dataset.item ?? "").toLowerCase();
    const questHidden = r.dataset.quest === "1" && !showQuest;
    const show = !questHidden && haystack.includes(filterText);
    r.style.display = show ? "" : "none";
    if (show) n++;
  }
  const empty = document.querySelector<HTMLElement>("#no-results");
  if (empty) empty.style.display = n > 0 ? "none" : "block";
}

export function updateRowCollected(name: string, collected: boolean): void {
  const row = document.querySelector<HTMLElement>(`.item-row[data-item="${CSS.escape(name)}"]`);
  if (row) row.classList.toggle("collected", collected);
}

export function updateRowFocus(name: string | null, index: number, total: number): void {
  for (const row of document.querySelectorAll<HTMLElement>(".item-row")) {
    const countEl = row.querySelector(".item-count");
    const markerCount = row.dataset.markerCount ?? "0";
    const isFocused = name !== null && row.dataset.item === name;
    row.classList.toggle("focused", isFocused);
    if (countEl) {
      countEl.textContent = isFocused && total > 1 ? `${index + 1}/${total}` : markerCount;
    }
  }
}
