import io

from osrs_spawn_scraper.check_spawns import find_shared_coords, warn_shared_coords


def test_find_shared_coords_groups_different_items_at_same_tile():
    items = [
        {
            "item": "Ashes",
            "spawns": [
                {
                    "location": "Bandit camp",
                    "map_id": -1,
                    "plane": 0,
                    "coords": [{"x": 1494, "y": 3177, "qty": 1}],
                },
            ],
        },
        {
            "item": "Iron sword",
            "spawns": [
                {
                    "location": "Bandit camp",
                    "map_id": 0,
                    "plane": 0,
                    "coords": [{"x": 1494, "y": 3177, "qty": 1}],
                },
            ],
        },
    ]

    shared = find_shared_coords(items)
    assert list(shared.keys()) == [(0, 1494, 3177)]
    assert shared[(0, 1494, 3177)] == [
        ("Ashes", "Bandit camp", -1),
        ("Iron sword", "Bandit camp", 0),
    ]


def test_find_shared_coords_ignores_unique_tiles():
    items = [
        {
            "item": "Ashes",
            "spawns": [
                {
                    "location": "Bandit camp",
                    "map_id": 0,
                    "plane": 0,
                    "coords": [{"x": 1494, "y": 3177, "qty": 1}],
                },
            ],
        },
        {
            "item": "Air rune",
            "spawns": [
                {
                    "location": "Lumbridge",
                    "map_id": 0,
                    "plane": 0,
                    "coords": [{"x": 3200, "y": 3200, "qty": 1}],
                },
            ],
        },
    ]

    assert find_shared_coords(items) == {}


def test_warn_shared_coords_prints_warning_without_failing():
    items = [
        {
            "item": "Ashes",
            "spawns": [
                {
                    "location": "Bandit camp",
                    "map_id": 0,
                    "plane": 0,
                    "coords": [{"x": 1494, "y": 3177, "qty": 1}],
                },
            ],
        },
        {
            "item": "Iron sword",
            "spawns": [
                {
                    "location": "Bandit camp",
                    "map_id": 0,
                    "plane": 0,
                    "coords": [{"x": 1494, "y": 3177, "qty": 1}],
                },
            ],
        },
    ]

    buf = io.StringIO()
    count = warn_shared_coords(items, stream=buf)
    output = buf.getvalue()

    assert count == 1
    assert "shared by multiple items" in output
    assert "Ashes" in output
    assert "Iron sword" in output
