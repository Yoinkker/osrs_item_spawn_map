import type { SpawnItem } from "./types.ts";
import { parseQuestLinks } from "./wikiUrl.ts";

/** Combined lowercase text searched by the sidebar filter: item name, spawn locations, quest names. */
export function buildSearchText(item: SpawnItem): string {
  const parts = [item.item];
  for (const spawn of item.spawns) {
    if (spawn.location) parts.push(spawn.location);
  }
  for (const quest of parseQuestLinks(item.quest)) {
    parts.push(quest.display);
    if (quest.page !== quest.display) parts.push(quest.page);
  }
  return parts.join(" ").toLowerCase();
}
