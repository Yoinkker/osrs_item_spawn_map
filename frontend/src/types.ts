export interface Coord {
  x: number;
  y: number;
  qty: number;
}

export interface Spawn {
  location: string;
  members: "Yes" | "No" | "?";
  map_id: number;
  plane: number;
  coords: Coord[];
}

export interface SpawnItem {
  item: string;
  quest: string | null;
  image_file: string | null;
  image_url: string | null;
  spawns: Spawn[];
}

export type Plane = 0 | 1 | 2 | 3;
