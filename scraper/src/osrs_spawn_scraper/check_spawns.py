import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

from .schema import validate_spawn_items

CoordKey = tuple[int, int, int]
SpawnRef = tuple[str, str, int]
ICON_PATH_PREFIX = "/icons/"
MAX_MISSING_ICON_REPORT = 20


def find_missing_icons(spawn_items: list[dict], icons_dir: Path) -> list[tuple[str, str]]:
    missing: list[tuple[str, str]] = []
    for entry in spawn_items:
        image_url = entry.get("image_url")
        if not isinstance(image_url, str) or not image_url.startswith(ICON_PATH_PREFIX):
            continue
        filename = image_url.removeprefix(ICON_PATH_PREFIX)
        if not (icons_dir / filename).is_file():
            missing.append((entry["item"], image_url))
    return missing


def verify_bundled_icons(spawn_items: list[dict], icons_dir: Path) -> None:
    missing = find_missing_icons(spawn_items, icons_dir)
    if not missing:
        return
    lines = [f"error: {len(missing)} bundled icon(s) missing under {icons_dir}:"]
    lines.extend(f"  - {item}: {path}" for item, path in missing[:MAX_MISSING_ICON_REPORT])
    if len(missing) > MAX_MISSING_ICON_REPORT:
        lines.append(f"  ... and {len(missing) - MAX_MISSING_ICON_REPORT} more")
    lines.append("Run: uv run python -m osrs_spawn_scraper --bundle-icons-only")
    raise SystemExit("\n".join(lines))


def find_shared_coords(spawn_items: list[dict]) -> dict[CoordKey, list[SpawnRef]]:
    by_coord: dict[CoordKey, dict[str, tuple[str, int]]] = defaultdict(dict)
    for entry in spawn_items:
        item_name = entry["item"]
        for spawn in entry.get("spawns", []):
            map_id = spawn["map_id"]
            plane = spawn["plane"]
            location = spawn["location"]
            for coord in spawn.get("coords", []):
                key = (plane, coord["x"], coord["y"])
                by_coord[key][item_name] = (location, map_id)
    return {
        key: [(item, loc, map_id) for item, (loc, map_id) in sorted(items.items())]
        for key, items in sorted(by_coord.items())
        if len(items) > 1
    }


def format_shared_coord_warning(key: CoordKey, refs: list[SpawnRef]) -> str:
    plane, x, y = key
    lines = [f"  plane={plane} ({x}, {y}):"]
    lines.extend(f"    - {item} @ {location} (map_id={map_id})" for item, location, map_id in refs)
    return "\n".join(lines)


def warn_shared_coords(spawn_items: list[dict], *, stream=None) -> int:
    shared = find_shared_coords(spawn_items)
    if not shared:
        return 0

    out = stream or sys.stderr
    print(f"warning: found {len(shared)} coordinate(s) shared by multiple items:", file=out)
    for key, refs in shared.items():
        print(format_shared_coord_warning(key, refs), file=out)
        print(file=out)
    return len(shared)


def main() -> None:
    p = argparse.ArgumentParser(description="Warn when spawn_items.json has overlapping coordinates.")
    p.add_argument(
        "path",
        nargs="?",
        default="data/spawn_items.json",
        help="Path to spawn_items.json (default: data/spawn_items.json)",
    )
    p.add_argument(
        "--icons-dir",
        default="data/icons",
        help="Directory of bundled icon PNGs (default: data/icons)",
    )
    args = p.parse_args()

    path = Path(args.path)
    icons_dir = Path(args.icons_dir)
    spawn_items = json.loads(path.read_text(encoding="utf-8"))
    validate_spawn_items(spawn_items)
    verify_bundled_icons(spawn_items, icons_dir)
    warn_shared_coords(spawn_items)


if __name__ == "__main__":
    main()
