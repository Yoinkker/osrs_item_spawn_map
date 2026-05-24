from pathlib import Path

import pytest

from osrs_spawn_scraper.parse import (
    CoordParseError,
    clean_location,
    parse_coord,
    parse_spawn_lines,
    spawn_name_matches,
)

FIXTURES = Path(__file__).parent / "fixtures"


def load(name):
    return (FIXTURES / name).read_text()


def test_parse_coord_basic():
    assert parse_coord("3150,3247") == {"x": 3150, "y": 3247, "qty": 1}


def test_parse_coord_with_qty():
    assert parse_coord("2938,3158,qty:3") == {"x": 2938, "y": 3158, "qty": 3}


def test_clean_location_strips_wikilinks():
    assert clean_location("East of [[Draynor Village|Draynor]] jail") == "East of Draynor jail"
    assert clean_location("East of [[Draynor Village]] jail") == "East of Draynor Village jail"


def test_clean_location_handles_floor_number():
    assert clean_location("Varrock Castle {{FloorNumber|uk=2}}") == "Varrock Castle level 2"


def test_clean_location_drops_unrelated_templates():
    assert clean_location("Foo {{Some Template|bar}} baz") == "Foo baz"


def test_clean_location_handles_unclosed_wikilinks():
    assert clean_location("Asgarnia - [[Chaos Temple (Asgarnia)") == "Asgarnia - Chaos Temple (Asgarnia)"
    assert clean_location("Wilderness - [[Chaos Temple (hut)") == "Wilderness - Chaos Temple (hut)"
    assert clean_location("[[Bandit (Varlamore)") == "Bandit (Varlamore)"


def test_clean_location_strips_ref_tags():
    assert clean_location('Myths\' Guild basement<ref group="l">Requires completion</ref>') == (
        "Myths' Guild basement"
    )


def test_parse_spawn_lines_basic_inline_and_multiline():
    spawns = parse_spawn_lines(load("basic.wiki"))
    assert len(spawns) == 2

    inline = spawns[0]
    assert inline["location"] == "East of Draynor Village jail"
    assert inline["members"] == "No"
    assert inline["map_id"] == 0
    assert inline["plane"] == 0
    assert inline["coords"] == [{"x": 3150, "y": 3247, "qty": 1}]

    multi = spawns[1]
    assert multi["location"] == "Musa Point"
    assert multi["coords"] == [
        {"x": 2938, "y": 3158, "qty": 3},
        {"x": 2939, "y": 3158, "qty": 1},
    ]


def test_parse_spawn_lines_preserves_nested_floor_number_in_location():
    spawns = parse_spawn_lines(load("floor_number.wiki"))
    assert len(spawns) == 1
    assert spawns[0]["location"] == "Varrock Castle level 2"
    assert spawns[0]["plane"] == 2
    assert spawns[0]["coords"] == [{"x": 3210, "y": 3490, "qty": 1}]


def test_parse_spawn_lines_empty_on_no_template():
    assert parse_spawn_lines("just some prose, no templates") == []


def test_parse_coord_invalid():
    with pytest.raises(CoordParseError):
        parse_coord("bad")
    with pytest.raises(CoordParseError):
        parse_coord("abc,def")


def test_parse_spawn_lines_skips_invalid_coords():
    wikitext = "{{ItemSpawnLine|location=Test spot|members=No|mapID=0|plane=0|bad,coord|3150,3247}}"
    spawns = parse_spawn_lines(wikitext)
    assert len(spawns) == 1
    assert spawns[0]["coords"] == [{"x": 3150, "y": 3247, "qty": 1}]


def test_parse_spawn_lines_normalizes_lowercase_members():
    wikitext = "{{ItemSpawnLine|location=Test|members=yes|mapID=0|plane=0|3150,3247}}"
    spawns = parse_spawn_lines(wikitext)
    assert spawns[0]["members"] == "Yes"


def test_spawn_name_matches_allows_variants_and_missing_name():
    assert spawn_name_matches("Bug lantern", "Unlit bug lantern")
    assert spawn_name_matches("Iron sword", None)
    assert not spawn_name_matches("Ashes", "Cabbage")


def test_parse_spawn_lines_filters_mismatched_name_field():
    wikitext = (
        "{{ItemSpawnLine|name=Ashes|location=Bandit camp|members=Yes|mapID=-1|1494,3177}}"
        "{{ItemSpawnLine|name=Cabbage|location=Realm of Memories|members=No|mapID=-1|plane=2|1834,6187}}"
        "{{ItemSpawnLine|name=Ashes|location=Sisterhood Sanctuary|members=Yes|mapID=14|3752,9780}}"
    )
    spawns = parse_spawn_lines(wikitext, "Ashes")
    assert len(spawns) == 2
    assert [s["location"] for s in spawns] == ["Bandit camp", "Sisterhood Sanctuary"]
