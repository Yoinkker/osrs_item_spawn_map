import json
from pathlib import Path

from osrs_spawn_scraper.cache import CACHE_VERSION, load_cache, save_cache


def test_round_trip(tmp_path: Path):
    path = str(tmp_path / "cache.json")
    save_cache({"Air rune": {"revid": 1}}, path)
    assert load_cache(path) == {"Air rune": {"revid": 1}}


def test_missing_file_is_empty(tmp_path: Path):
    assert load_cache(str(tmp_path / "nope.json")) == {}


def test_legacy_unversioned_cache_is_discarded(tmp_path: Path):
    path = tmp_path / "cache.json"
    path.write_text(json.dumps({"Air rune": {"item": "Air rune"}}))
    assert load_cache(str(path)) == {}


def test_other_version_is_discarded(tmp_path: Path):
    path = tmp_path / "cache.json"
    path.write_text(json.dumps({"version": CACHE_VERSION + 1, "items": {"Air rune": {}}}))
    assert load_cache(str(path)) == {}
