import json
from pathlib import Path

import jsonschema
import pytest

from osrs_spawn_scraper.schema import validate_spawn_items

_REPO_ROOT = Path(__file__).resolve().parents[2]
SPAWN_DATA = _REPO_ROOT / "data" / "spawn_items.json"


def test_committed_spawn_data_matches_schema():
    data = json.loads(SPAWN_DATA.read_text(encoding="utf-8"))
    validate_spawn_items(data)


def test_validate_spawn_items_rejects_invalid_payload():
    with pytest.raises(jsonschema.ValidationError):
        validate_spawn_items([{"item": "Missing fields"}])
