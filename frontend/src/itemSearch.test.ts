import { describe, expect, it } from "vitest";

import { buildSearchText } from "./itemSearch.ts";
import type { SpawnItem } from "./types.ts";

function makeItem(overrides: Partial<SpawnItem>): SpawnItem {
  return {
    item: "Item",
    quest: null,
    image_file: null,
    image_url: null,
    spawns: [],
    ...overrides,
  };
}

describe("buildSearchText", () => {
  it("includes the item name", () => {
    expect(buildSearchText(makeItem({ item: "Grail bell" }))).toContain("grail bell");
  });

  it("includes spawn locations", () => {
    const item = makeItem({
      item: "Grail bell",
      spawns: [
        {
          location: "In front of the castle entrance ruins - Dilapidated Fisher Realm",
          members: "Yes",
          map_id: 0,
          plane: 0,
          coords: [],
        },
      ],
    });
    const text = buildSearchText(item);
    expect(text).toContain("castle entrance ruins");
    expect(text).toContain("dilapidated fisher realm");
  });

  it("includes quest names", () => {
    expect(buildSearchText(makeItem({ quest: "[[Holy Grail]]" }))).toContain("holy grail");
  });

  it("includes both the quest display text and page name", () => {
    const text = buildSearchText(makeItem({ quest: "[[Recipe for Disaster|RFD]]" }));
    expect(text).toContain("rfd");
    expect(text).toContain("recipe for disaster");
  });
});
