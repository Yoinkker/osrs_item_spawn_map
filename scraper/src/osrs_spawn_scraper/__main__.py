import argparse
import json
from pathlib import Path

from .cache import atomic_write_json
from .icons import bundle_spawn_icons
from .pipeline import run
from .schema import validate_spawn_items


def main():
    p = argparse.ArgumentParser(prog="osrs_spawn_scraper")
    p.add_argument("--output", default="data/spawn_items.json")
    p.add_argument("--cache", default="data/cache.json")
    p.add_argument("--icons-dir", default="data/icons")
    p.add_argument(
        "--bundle-icons-only",
        action="store_true",
        help="Download bundled icons for an existing spawn_items.json and rewrite image_url paths",
    )
    args = p.parse_args()
    if args.bundle_icons_only:
        path = Path(args.output)
        icons_path = Path(args.icons_dir)
        spawn_items = json.loads(path.read_text(encoding="utf-8"))
        updated = bundle_spawn_icons(spawn_items, icons_path)
        validate_spawn_items(updated)
        atomic_write_json(str(path), updated)
        print(f"Bundled icons into {icons_path} and updated {path}")
        return
    run(args.output, args.cache, args.icons_dir)


if __name__ == "__main__":
    main()
