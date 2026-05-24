import json
import os
import tempfile
from pathlib import Path


def load_cache(path: str) -> dict:
    p = Path(path)
    if p.exists():
        with p.open() as f:
            return json.load(f)
    return {}


def save_cache(cache: dict, path: str) -> None:
    atomic_write_json(path, cache)


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
