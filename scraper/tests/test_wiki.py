from osrs_spawn_scraper.wiki import (
    _escape_bucket_string,
    filter_unobtainable,
    filter_unobtainable_duplicates,
)


def test_escape_bucket_string_handles_quotes_and_backslashes():
    assert _escape_bucket_string("O'Reilly") == "O\\'Reilly"
    assert _escape_bucket_string("back\\slash") == "back\\\\slash"
    assert _escape_bucket_string("O\\'Reilly") == "O\\\\\\'Reilly"


def test_filter_unobtainable_duplicates_drops_redundant_pages():
    items = [
        "Brewin' guide",
        "Brewin' guide (unobtainable item)",
        "Wine of zamorak",
        "Wine of zamorak (unobtainable item)",
        "Rotten barrel (unobtainable item)",
    ]
    assert filter_unobtainable_duplicates(items) == [
        "Brewin' guide",
        "Wine of zamorak",
        "Rotten barrel (unobtainable item)",
    ]


def test_filter_unobtainable_drops_category_members():
    items = ["Air rune", "Ahab's beer", "Rope (Olaf's Quest)", "Bread"]
    unobtainable = {"Ahab's beer", "Rope (Olaf's Quest)", "Some other item"}
    assert filter_unobtainable(items, unobtainable) == ["Air rune", "Bread"]
