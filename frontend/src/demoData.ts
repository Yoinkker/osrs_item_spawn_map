import type { SpawnItem } from "./types.ts";

export function demoData(): SpawnItem[] {
  return [
    {
      item: "Air rune",
      quest: "No",
      image_file: "Air rune.png",
      image_url: "/icons/Air_rune.png",
      spawns: [
        {
          location: "East of Draynor jail",
          members: "No",
          plane: 0,
          map_id: 0,
          coords: [{ x: 3150, y: 3247, qty: 1 }],
        },
        {
          location: "Musa Point",
          members: "No",
          plane: 0,
          map_id: 0,
          coords: [{ x: 2938, y: 3158, qty: 1 }],
        },
      ],
    },
    {
      item: "Iron sword",
      quest: "No",
      image_file: "Iron sword.png",
      image_url: "/icons/Iron_sword.png",
      spawns: [
        {
          location: "Shayzien",
          members: "Yes",
          plane: 0,
          map_id: 0,
          coords: [{ x: 1569, y: 3547, qty: 1 }],
        },
      ],
    },
    {
      item: "Dwellberries",
      quest: "[[Plague City]]",
      image_file: "Dwellberries.png",
      image_url: "/icons/Dwellberries.png",
      spawns: [
        {
          location: "McGrubor's Wood",
          members: "Yes",
          plane: 0,
          map_id: 0,
          coords: [{ x: 2638, y: 3479, qty: 1 }],
        },
      ],
    },
  ];
}
