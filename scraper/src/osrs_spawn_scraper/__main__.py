import argparse
import json
from pathlib import Path

from .cache import atomic_write_json
from .icons import bundle_spawn_icons
from .pipeline import run
from .schema import validate_spawn_items
from .wiki import WIKI_CALLS


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
    p.add_argument("--calls-file", help="Write the number of wiki requests made to this file")
    args = p.parse_args()
    try:
        _run(args)
    finally:
        if args.calls_file:
            Path(args.calls_file).write_text(f"{WIKI_CALLS.count}\n", encoding="utf-8")
        print(f"Wiki requests made: {WIKI_CALLS.count}")


def _run(args: argparse.Namespace) -> None:
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
