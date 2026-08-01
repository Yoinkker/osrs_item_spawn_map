const REPO_URL = "https://github.com/Yoinkker/osrs_item_spawn_map";

export const UPSTREAM_HEADERS: HeadersInit = {
  "User-Agent": `osrs-item-spawn-map-worker (+${REPO_URL})`,
  Accept: "image/png,image/*,*/*;q=0.8",
};

export const MAX_PROBE_DAYS = 40;

export const PROBE_TILE = { z: 1, plane: 0, tx: 24, ty: 26, mapId: 0 } as const;

export function generateProbeVersions(now: Date = new Date(), maxDays = MAX_PROBE_DAYS): string[] {
  const versions: string[] = [];
  const millisPerDay = 24 * 60 * 60 * 1000;
  for (let day = 0; day < maxDays; day++) {
    const d = new Date(now.getTime() - day * millisPerDay);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    versions.push(`${y}-${m}-${dd}_a`);
  }
  return versions;
}

export const TILE_VERSION_RE = /^\d{4}-\d{2}-\d{2}_[a-z]$/;
export const TILE_MAP_ID_MIN = -1;
export const TILE_MAP_ID_MAX = 20000;

export function isValidTileVersion(version: string): boolean {
  return TILE_VERSION_RE.test(version);
}

export function isValidTileMapId(mapId: number): boolean {
  return Number.isInteger(mapId) && mapId >= TILE_MAP_ID_MIN && mapId <= TILE_MAP_ID_MAX;
}

export function upstreamTileUrl(
  version: string,
  z: number | string,
  plane: number | string,
  tx: number | string,
  ty: number | string,
  mapId: number | string = 0,
): string {
  return (
    `https://maps.runescape.wiki/osrs/versions/${version}` +
    `/tiles/rendered/${mapId}/${z}/${plane}_${tx}_${ty}.png`
  );
}

export const TILE_VERSION_KV_KEY = "current";
export const TILE_VERSION_TTL_SECONDS = 6 * 60 * 60;
export const TILE_VERSION_UNCONFIRMED_TTL_SECONDS = 5 * 60;
export const TILE_CACHE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
export const TILE_404_CACHE_MAX_AGE_SECONDS = 10 * 60;

export interface Env {
  TILE_VERSION_KV: KVNamespace;
  ALLOWED_ORIGINS?: string;
}
