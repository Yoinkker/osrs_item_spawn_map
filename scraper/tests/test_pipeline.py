from osrs_spawn_scraper.pipeline import _include_entry, _is_stale_quest_entry


def _entry(quest: object, spawns: list, image_file: str | None = None) -> dict:
    return {
        "item": "X",
        "quest": quest,
        "image_file": image_file,
        "image_url": None,
        "spawns": spawns,
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


class TestStaleQuestEntry:
    def test_old_sentinel_is_stale(self):
        # Pre-migration skip: concrete quest, no spawns, no image.
        assert _is_stale_quest_entry(_entry("[[Plague City]]", [], image_file=None)) is True

    def test_freshly_fetched_empty_quest_item_not_stale(self):
        # After the change, a genuinely spawnless quest item still has an image fetched.
        assert _is_stale_quest_entry(_entry("Yes", [], image_file="Charcoal.png")) is False

    def test_quest_item_with_spawns_not_stale(self):
        assert _is_stale_quest_entry(_entry("Yes", [SPAWN])) is False

    def test_non_quest_entry_not_stale(self):
        assert _is_stale_quest_entry(_entry("No", [])) is False

    def test_null_quest_not_stale(self):
        assert _is_stale_quest_entry(_entry(None, [])) is False
