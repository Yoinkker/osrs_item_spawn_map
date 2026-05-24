import { describe, expect, it } from "vitest";

import {
  MAX_IMPORT_ITEMS,
  isBundledIconPath,
  isCollectedMap,
  parseSpawnItems,
  sanitizeImportItems,
} from "./validate.ts";

describe("isBundledIconPath", () => {
  it("allows bundled icon paths", () => {
    expect(isBundledIconPath("/icons/Air_rune.png")).toBe(true);
    expect(isBundledIconPath("/icons/Ahab's_beer.png")).toBe(true);
  });

  it("rejects remote and unsafe paths", () => {
    const scriptUrl = `${"java"}${"script:"}alert(1)`;
    expect(isBundledIconPath(scriptUrl)).toBe(false);
    expect(isBundledIconPath("https://evil.example/icons/x.png")).toBe(false);
    expect(isBundledIconPath('/icons/x.png" onload="alert(1)')).toBe(false);
    expect(isBundledIconPath("/images/Air_rune.png")).toBe(false);
  });
});

describe("parseSpawnItems", () => {
  it("accepts valid spawn data", () => {
    const data = [
      {
        item: "Air rune",
        quest: "No",
        image_file: "Air rune.png",
        image_url: "/icons/Air_rune.png",
        spawns: [
          {
            location: "Lumbridge",
            members: "No",
            map_id: 0,
            plane: 0,
            coords: [{ x: 3200, y: 3200, qty: 1 }],
          },
        ],
      },
    ];
    expect(parseSpawnItems(data)).toEqual(data);
  });

  it("rejects remote image URLs", () => {
    expect(() =>
      parseSpawnItems([
        {
          item: "Evil",
          quest: "No",
          image_file: null,
          image_url: "https://evil.example/x.png",
          spawns: [],
        },
      ]),
    ).toThrow();
  });

  it("does not mutate input", () => {
    const input = [
      {
        item: "Black dagger",
        quest: "No",
        image_file: null,
        image_url: "/icons/Black_dagger.png",
        spawns: [
          {
            location: "Charred Dungeon",
            members: "yes",
            map_id: -1,
            plane: 0,
            coords: [{ x: 2691, y: 8884, qty: 1 }],
          },
        ],
      },
    ];
    const snapshot = structuredClone(input);
    parseSpawnItems(input);
    expect(input).toEqual(snapshot);
  });

  it("normalizes lowercase members values", () => {
    const data = [
      {
        item: "Black dagger",
        quest: "No",
        image_file: null,
        image_url: "/icons/Black_dagger.png",
        spawns: [
          {
            location: "Charred Dungeon",
            members: "yes",
            map_id: -1,
            plane: 0,
            coords: [{ x: 2691, y: 8884, qty: 1 }],
          },
        ],
      },
    ];
    expect(parseSpawnItems(data)[0]?.spawns[0]?.members).toBe("Yes");
  });
});

describe("isCollectedMap", () => {
  it("accepts boolean maps and rejects unsafe keys", () => {
    expect(isCollectedMap({ "Air rune": true })).toBe(true);
    expect(isCollectedMap({ constructor: true })).toBe(false);
    expect(isCollectedMap(JSON.parse('{"prototype": true}'))).toBe(false);
  });
});

describe("sanitizeImportItems", () => {
  it("caps import size", () => {
    const items = Array.from({ length: MAX_IMPORT_ITEMS + 1 }, (_, i) => `Item ${i}`);
    expect(() => sanitizeImportItems(items)).toThrow();
  });
});
