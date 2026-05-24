import { describe, expect, it } from "vitest";

import { isOverworld, isUnderground } from "./mapSpawn.ts";
import type { Spawn, SpawnItem } from "./types.ts";

function spawn(overrides: Partial<Spawn> & Pick<Spawn, "coords">): Spawn {
  return {
    location: "Test",
    members: "No",
    map_id: 0,
    plane: 0,
    ...overrides,
  };
}

describe("map_id -1 handling", () => {
  it("treats underground full-map spawns as underground", () => {
    const s = spawn({ map_id: -1, coords: [{ x: 1689, y: 9661, qty: 1 }] });
    expect(isUnderground(s)).toBe(true);
    expect(isOverworld(s)).toBe(false);
  });

  it("maps surface full-map spawns to the overworld layer", () => {
    const s = spawn({ map_id: -1, coords: [{ x: 3320, y: 3137, qty: 1 }] });
    expect(isOverworld(s)).toBe(true);
    expect(isUnderground(s)).toBe(false);
  });

  it("uses full map for instanced areas below the old y threshold", () => {
    const s = spawn({
      map_id: -1,
      plane: 2,
      coords: [{ x: 1834, y: 6187, qty: 1 }],
    });
    expect(isUnderground(s)).toBe(true);
    expect(isOverworld(s)).toBe(false);
  });

  it("classifies mixed items with surface and full-map underground spawns", () => {
    const spawns: Spawn[] = [
      spawn({ map_id: 0, coords: [{ x: 3320, y: 3137, qty: 1 }] }),
      spawn({ map_id: -1, coords: [{ x: 3026, y: 9379, qty: 1 }] }),
    ];
    const item: SpawnItem = {
      item: "Bronze mace",
      quest: "No",
      image_file: null,
      image_url: null,
      spawns,
    };
    expect(item.spawns.some(isOverworld)).toBe(true);
    expect(item.spawns.some(isUnderground)).toBe(true);
  });
});
