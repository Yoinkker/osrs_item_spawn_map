import type { Spawn } from "./types.ts";

export const OVERWORLD_Y_THRESHOLD = 6400;

const SURFACE_MIN_X = 896;
const SURFACE_MAX_X = 4096;
const SURFACE_MIN_Y = 1984;
const SURFACE_MAX_Y = 4288;

function isInSurfaceBounds(x: number, y: number): boolean {
  return x >= SURFACE_MIN_X && x <= SURFACE_MAX_X && y >= SURFACE_MIN_Y && y <= SURFACE_MAX_Y;
}

export function effectiveMapId(spawn: Spawn): number {
  if (spawn.map_id === -1) {
    if (spawn.coords.length > 0 && spawn.coords.every((c) => isInSurfaceBounds(c.x, c.y))) {
      return 0;
    }
    return -1;
  }
  if (spawn.map_id === null) return 0;
  return spawn.map_id;
}

export function isOverworld(spawn: Spawn): boolean {
  return (
    effectiveMapId(spawn) === 0 &&
    spawn.coords.length > 0 &&
    spawn.coords.every((c) => c.y < OVERWORLD_Y_THRESHOLD)
  );
}

export function isUnderground(spawn: Spawn): boolean {
  if (spawn.coords.length === 0) return false;
  const mid = effectiveMapId(spawn);
  return (
    mid === -1 || mid > 0 || (mid === 0 && spawn.coords.some((c) => c.y >= OVERWORLD_Y_THRESHOLD))
  );
}
