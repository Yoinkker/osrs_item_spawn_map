import sys
import time
from pathlib import Path

from .cache import atomic_write_json, load_cache, save_cache
from .icons import bundle_spawn_icons, ensure_icon, icon_basename
from .parse import normalize_spawn, parse_spawn_lines
from .schema import validate_spawn_items
from .wiki import get_image_url, get_item_info, get_revision_ids, get_spawn_items, get_wikitext

RATE_LIMIT_SLEEP = 0.3
CACHE_FLUSH_INTERVAL = 25


def _cache_entry(
    item: str,
    quest: str | None,
    image_file: str | None,
    image_url: str | None,
    spawns: list[dict],
) -> dict:
    return {
        "item": item,
        "quest": quest,
        "image_file": image_file,
        "image_url": image_url,
        "spawns": [normalize_spawn(s) for s in spawns],
    }


def _output_entry(entry: dict) -> dict:
    return {k: v for k, v in entry.items() if k != "revid"}


def _is_reusable(entry: dict | None, revid: int | None) -> bool:
    """Reuse an entry only if its page is unedited since the fetch."""
    if entry is None or revid is None or entry.get("revid") != revid:
        return False
    return _include_entry(entry)


def _normalize_entry(entry: dict) -> dict:
    spawns = entry.get("spawns", [])
    normalized = [normalize_spawn(s) for s in spawns]
    if normalized == spawns:
        return entry
    return {**entry, "spawns": normalized}


def _include_entry(entry: dict) -> bool:
    return entry.get("quest") is not None and len(entry.get("spawns", [])) > 0


def _warn(message: str, warnings: list[str]) -> None:
    warnings.append(message)
    print(f"warning: {message}", file=sys.stderr)


def _fetch_item(item: str, icons_dir: Path) -> dict:
    wikitext = get_wikitext(item)
    time.sleep(RATE_LIMIT_SLEEP)
    quest_status, image_file = get_item_info(item, wikitext)
    print(f"{item}: quest={quest_status}, image={image_file}", end="")
    time.sleep(RATE_LIMIT_SLEEP)

    if quest_status is None:
        print(" - skipping (no infobox / ambiguous quest)")
        return _cache_entry(item, quest_status, None, None, [])

    remote_image_url = None
    if image_file and not (icons_dir / icon_basename(image_file)).is_file():
        remote_image_url = get_image_url(image_file)
        time.sleep(RATE_LIMIT_SLEEP)

    image_url = ensure_icon(
        icons_dir=icons_dir,
        image_file=image_file,
        remote_url=remote_image_url,
    )

    spawns = parse_spawn_lines(wikitext, item) if wikitext else []
    print(f", spawns={len(spawns)}, icon={image_url}")
    return _cache_entry(item, quest_status, image_file, image_url, spawns)


def run(output_path: str, cache_path: str, icons_dir: str = "data/icons") -> None:
    icons_path = Path(icons_dir)
    cache = load_cache(cache_path)
    cached_count = len(cache)
    print(f"Loaded cache with {cached_count} entries")

    spawn_items = get_spawn_items()
    revids = get_revision_ids(spawn_items)
    results: list[dict] = []
    warnings: list[str] = []

    def classify(entry: dict) -> None:
        if _include_entry(entry):
            results.append(_output_entry(entry))
            return
        item_name = entry.get("item")
        quest = entry.get("quest")
        if quest is None:
            _warn(f"{item_name}: skipped (no infobox / ambiguous quest)", warnings)
        elif quest == "No":
            _warn(f"{item_name}: no spawns found, excluded (unexpected for a non-quest item)", warnings)
        else:
            _warn(f"{item_name}: quest item has no spawns, excluded", warnings)

    print(f"\nChecking {len(spawn_items)} items...")
    fetched = 0
    fetched_since_flush = 0
    try:
        for i, item in enumerate(spawn_items):
            prefix = f"  [{i + 1}/{len(spawn_items)}]"

            revid = revids.get(item)
            if _is_reusable(cache.get(item), revid):
                entry = cache[item] = _normalize_entry(cache[item])
                print(f"{prefix} {item}: (unchanged) quest={entry['quest']}, spawns={len(entry['spawns'])}")
                classify(entry)
                continue

            print(f"{prefix} ", end="")
            entry = {**_fetch_item(item, icons_path), "revid": revid}
            cache[item] = entry
            fetched += 1
            fetched_since_flush += 1
            classify(entry)

            if fetched_since_flush >= CACHE_FLUSH_INTERVAL:
                save_cache(cache, cache_path)
                fetched_since_flush = 0
    finally:
        save_cache({k: cache[k] for k in spawn_items if k in cache}, cache_path)

    results = bundle_spawn_icons(results, icons_path)
    validate_spawn_items(results)
    atomic_write_json(output_path, results)

    print(f"\nDone. {fetched} fetched, {len(spawn_items) - fetched} unchanged since last run.")
    print(f"Saved {len(results)} items to {output_path}")
    if warnings:
        print(f"warning: {len(warnings)} item(s) excluded!", file=sys.stderr)
