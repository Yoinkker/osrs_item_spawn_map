export const WIKI_BASE = "https://oldschool.runescape.wiki";
export const WIKI_MAPS_BASE = "https://maps.runescape.wiki";
export const WIKI_LICENSE_URL = "https://creativecommons.org/licenses/by-nc-sa/3.0/";
export const WIKI_ITEM_SPAWN_URL = `${WIKI_BASE}/w/Item_spawn`;
export const WIKI_LICENSING_URL = "https://meta.weirdgloop.org/w/Licensing";
export const JAGEX_FAN_CONTENT_URL = "https://legal.jagex.com/docs/policies/fan-content-policy";
export const GITHUB_REPO_URL = "https://github.com/Yoinkker/osrs_item_spawn_map";

export const JAGEX_FAN_CONTENT_DISCLAIMER =
  "Created using intellectual property belonging to Jagex Limited under the terms of Jagex's Fan Content Policy. " +
  "This content is not endorsed by or affiliated with Jagex.";

export function wikiItemUrl(itemName: string): string {
  return `${WIKI_BASE}/w/${encodeURIComponent(itemName.replaceAll(" ", "_"))}`;
}

export function wikiItemLink(itemName: string, displayName?: string): HTMLAnchorElement {
  const link = document.createElement("a");
  link.href = wikiItemUrl(itemName);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = displayName ?? itemName;
  return link;
}

export interface QuestLink {
  /** Wiki page name to link to. */
  page: string;
  /** Display text for the link. */
  display: string;
}

const QUEST_LINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

export function parseQuestLinks(quest: string | null): QuestLink[] {
  if (!quest) return [];
  const links: QuestLink[] = [];
  for (const match of quest.matchAll(QUEST_LINK_RE)) {
    const page = match[1]!.trim();
    if (!page || page.toLowerCase() === "miniquest") continue;
    links.push({ page, display: (match[2] ?? match[1])!.trim() });
  }
  return links;
}
