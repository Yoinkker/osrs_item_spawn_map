from osrs_spawn_scraper.icons import (
    bundled_icon_path,
    icon_basename,
    is_bundled_icon_path,
    is_wiki_image_url,
)


def test_icon_basename():
    assert icon_basename("Air rune.png") == "Air_rune.png"
    assert icon_basename("Ahab's beer.png") == "Ahab's_beer.png"


def test_bundled_icon_path():
    assert bundled_icon_path("Air rune.png") == "/icons/Air_rune.png"


def test_is_bundled_icon_path():
    assert is_bundled_icon_path("/icons/Air_rune.png")
    assert not is_bundled_icon_path("https://example.com/icons/x.png")


def test_is_wiki_image_url():
    assert is_wiki_image_url("https://oldschool.runescape.wiki/images/Air_rune.png")
    assert not is_wiki_image_url("https://evil.example/images/x.png")
