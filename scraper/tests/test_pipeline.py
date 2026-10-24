from osrs_spawn_scraper.pipeline import _include_entry, _is_reusable, _output_entry


def _entry(quest: object, spawns: list, image_file: str | None = None, revid: int | None = None) -> dict:
    return {
        "item": "X",
        "quest": quest,
        "image_file": image_file,
        "image_url": None,
        "spawns": spawns,
        "revid": revid,
    }


SPAWN = {"location": "Somewhere", "members": "No", "map_id": 0, "plane": 0, "coords": []}


class TestIncludeEntry:
    def test_non_quest_item_with_spawns_included(self):
        assert _include_entry(_entry("No", [SPAWN])) is True

    def test_quest_item_with_spawns_included(self):
        assert _include_entry(_entry("[[Plague City]]", [SPAWN])) is True

    def test_quest_item_without_spawns_excluded(self):
        assert _include_entry(_entry("Yes", [])) is False

    def test_non_quest_item_without_spawns_excluded(self):
        assert _include_entry(_entry("No", [])) is False

    def test_null_quest_excluded(self):
        assert _include_entry(_entry(None, [SPAWN])) is False


class TestIsReusable:
    def test_unedited_page_is_reused(self):
        assert _is_reusable(_entry("No", [SPAWN], revid=7), 7) is True

    def test_edited_page_is_refetched(self):
        assert _is_reusable(_entry("No", [SPAWN], revid=7), 8) is False

    def test_entry_without_revid_is_refetched(self):
        assert _is_reusable(_entry("No", [SPAWN]), 7) is False

    def test_unknown_current_revid_is_refetched(self):
        assert _is_reusable(_entry("No", [SPAWN], revid=7), None) is False

    def test_missing_entry_is_fetched(self):
        assert _is_reusable(None, 7) is False

    def test_excluded_entry_is_always_refetched(self):
        # A transient wiki error looks like "no infobox"; never pin it to a revision.
        assert _is_reusable(_entry(None, [], revid=7), 7) is False
        assert _is_reusable(_entry("Yes", [], revid=7), 7) is False


def test_output_entry_drops_cache_only_fields():
    assert "revid" not in _output_entry(_entry("No", [SPAWN], revid=7))
