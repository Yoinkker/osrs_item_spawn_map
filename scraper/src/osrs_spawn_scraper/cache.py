import json
import os
import tempfile
from pathlib import Path

# Bump when parsing changes so the committed cache can't serve entries built by old logic.
CACHE_VERSION = 2


def load_cache(path: str) -> dict:
    p = Path(path)
    if not p.exists():
        return {}
    with p.open() as f:
        data = json.load(f)
    if not isinstance(data, dict) or data.get("version") != CACHE_VERSION:
        return {}
    items = data.get("items")
    return items if isinstance(items, dict) else {}


def save_cache(cache: dict, path: str) -> None:
    atomic_write_json(path, {"version": CACHE_VERSION, "items": cache})


def atomic_write_json(path: str, data: object) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(dir=target.parent, suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(data, f, indent=2)
        Path(tmp_path).replace(target)
    except Exception:
        tmp = Path(tmp_path)
        if tmp.exists():
            tmp.unlink()
        raise
