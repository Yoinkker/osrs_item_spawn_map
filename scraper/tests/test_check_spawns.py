import json
from pathlib import Path

import pytest

from osrs_spawn_scraper.check_spawns import find_missing_icons, verify_bundled_icons

_REPO_ROOT = Path(__file__).resolve().parents[2]
SPAWN_DATA = _REPO_ROOT / "data" / "spawn_items.json"
ICONS_DIR = _REPO_ROOT / "data" / "icons"


def test_committed_spawn_data_has_bundled_icons():
    spawn_items = json.loads(SPAWN_DATA.read_text(encoding="utf-8"))
    missing = find_missing_icons(spawn_items, ICONS_DIR)
    assert missing == []


def test_verify_bundled_icons_exits_when_missing(tmp_path: Path):
    icons_dir = tmp_path / "icons"
    icons_dir.mkdir()
    spawn_items = [{"item": "Air rune", "image_url": "/icons/Air_rune.png"}]
    with pytest.raises(SystemExit):
        verify_bundled_icons(spawn_items, icons_dir)
