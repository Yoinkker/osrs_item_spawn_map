import pytest

from osrs_spawn_scraper import wiki
from osrs_spawn_scraper.wiki import (
    _escape_bucket_string,
    _parse_quest_wikitext,
    filter_unobtainable,
    filter_unobtainable_duplicates,
    get_revision_ids,
)


def test_parse_quest_wikitext_preserves_quest_links():
    wikitext = (
        "{{Infobox Item\n|name = Holy grail\n|quest = [[Holy Grail]], [[King's Ransom]]\n|weight = 0\n}}"
    )
    assert _parse_quest_wikitext(wikitext) == "[[Holy Grail]], [[King's Ransom]]"


def test_parse_quest_wikitext_normalizes_no_and_absent():
    assert _parse_quest_wikitext("|quest = No\n") == "No"
    assert _parse_quest_wikitext("|quest =   \n") is None
    assert _parse_quest_wikitext("|weight = 1\n") is None


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


def test_get_revision_ids_batches_and_maps_normalized_titles(monkeypatch: pytest.MonkeyPatch):
    calls: list[list[str]] = []

    def fake_get_json(params: dict) -> dict:
        titles = params["titles"].split("|")
        calls.append(titles)
        pages = [{"title": t.replace("_", " "), "lastrevid": i} for i, t in enumerate(titles)]
        pages.append({"title": "Gone", "missing": True})
        normalized = [{"from": t, "to": t.replace("_", " ")} for t in titles if "_" in t]
        return {"query": {"normalized": normalized, "pages": pages}}

    monkeypatch.setattr(wiki, "_get_json", fake_get_json)
    monkeypatch.setattr(wiki.time, "sleep", lambda _: None)
    titles = [f"Item_{n}" for n in range(120)]

    revids = get_revision_ids(titles)

    assert [len(c) for c in calls] == [50, 50, 20]
    assert revids["Item_0"] == 0
    assert revids["Item_119"] == 19
    assert "Gone" not in revids


def test_wiki_get_counts_every_request(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(wiki.requests, "get", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(wiki, "WIKI_CALLS", wiki.CallCounter())

    wiki.wiki_get("https://oldschool.runescape.wiki/api.php")
    wiki.wiki_get("https://oldschool.runescape.wiki/images/Air_rune.png")

    assert wiki.WIKI_CALLS.count == 2
