import type { MapHandles } from "./map.ts";
import type { MarkerIndex } from "./markers.ts";
import type { CollectedMap } from "./state.ts";
import type { Plane, SpawnItem } from "./types.ts";

export interface AppContext {
  spawnData: SpawnItem[];
  collected: CollectedMap;
  currentPlane: Plane;
  currentMapId: number;
  markers: MarkerIndex;
  filterText: string;
  allCollected: boolean;
  showQuest: boolean;
  lastFocusedItem: string | null;
  focusedSpawnIndex: number;
  mapHandles: MapHandles | null;
}

export const app: AppContext = {
  spawnData: [],
  collected: {},
  currentPlane: 0,
  currentMapId: 0,
  markers: { all: [], byItem: {} },
  filterText: "",
  allCollected: false,
  showQuest: false,
  lastFocusedItem: null,
  focusedSpawnIndex: 0,
  mapHandles: null,
};
