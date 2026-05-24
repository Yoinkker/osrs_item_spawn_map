import json
from functools import lru_cache
from pathlib import Path

import jsonschema

_REPO_ROOT = Path(__file__).resolve().parents[3]
SCHEMA_PATH = _REPO_ROOT / "schemas" / "spawn_items.schema.json"


@lru_cache(maxsize=1)
def load_schema() -> dict:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def validate_spawn_items(data: object) -> None:
    jsonschema.validate(instance=data, schema=load_schema())
