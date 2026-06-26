import re
import time

import requests

HEADERS = {
    "User-Agent": ("osrs-item-spawn-scraper/1.0 (+https://github.com/Yoinkker/osrs_item_spawn_map)"),
}
BASE = "https://oldschool.runescape.wiki/api.php"

TIMEOUT = 10

_ASCII_SPACE = 0x20
_ASCII_DEL = 0x7F


class WikiError(Exception):
    @classmethod
    def http_error(cls, status_code: int) -> "WikiError":
        msg = f"Wiki API HTTP {status_code}"
        return cls(msg)

    @classmethod
    def non_object_json(cls) -> "WikiError":
        return cls("Wiki API returned non-object JSON")

    @classmethod
    def api_error(cls, code: str) -> "WikiError":
        msg = f"Wiki API error: {code}"
        return cls(msg)


class BucketStringError(ValueError): ...


def _escape_bucket_string(value: str) -> str:
    if any(ord(c) < _ASCII_SPACE or ord(c) == _ASCII_DEL for c in value):
        msg = f"refusing to escape bucket string with control chars: {value!r}"
        raise BucketStringError(msg)
    return value.replace("\\", "\\\\").replace("'", "\\'")


def _get_json(params: dict) -> dict:
    r = requests.get(BASE, params=params, headers=HEADERS, timeout=TIMEOUT)
    try:
        r.raise_for_status()
    except requests.HTTPError as exc:
        raise WikiError.http_error(r.status_code) from exc
    data = r.json()
    if not isinstance(data, dict):
        raise WikiError.non_object_json()
    if "error" in data:
        err = data["error"]
        code = err.get("code", "unknown") if isinstance(err, dict) else "unknown"
        raise WikiError.api_error(code)
    return data


def get_wikitext(page_name: str) -> str | None:
    try:
        data = _get_json(
            {
                "action": "parse",
                "page": page_name,
                "prop": "wikitext",
                "format": "json",
            },
        )
    except WikiError:
        return None
    parse = data.get("parse")
    if not isinstance(parse, dict):
        return None
    wikitext = parse.get("wikitext")
    if not isinstance(wikitext, dict):
        return None
    text = wikitext.get("*")
    return text if isinstance(text, str) else None


def _extract_row(row: dict) -> tuple[str | None, str | None]:
    quest = row.get("quest")
    image_list = row.get("image", [])
    image_file = image_list[0].replace("File:", "").strip() if image_list else None
    return quest, image_file


def _bucket_query(name: str) -> tuple[str | None, str | None]:
    try:
        escaped = _escape_bucket_string(name)
    except BucketStringError:
        return None, None
    query = f"bucket('infobox_item').select('item_name','quest','image').where('item_name','{escaped}').run()"
    try:
        data = _get_json({"action": "bucket", "query": query, "format": "json"})
    except WikiError:
        return None, None
    rows = data.get("bucket", [])
    if rows:
        return _extract_row(rows[0])
    return None, None


def get_item_info(item_name: str) -> tuple[str | None, str | None]:
    quest, image_file = _bucket_query(item_name)
    if quest is not None or image_file is not None:
        return quest, image_file

    wikitext = get_wikitext(item_name)
    if not wikitext:
        return None, None

    version1 = re.search(r"\|version1\s*=\s*([^\n|]+)", wikitext)
    name1 = re.search(r"\|name1\s*=\s*([^\n|]+)", wikitext)
    candidate = version1 or name1
    if candidate:
        variant_name = candidate.group(1).strip()
        time.sleep(0.3)
        quest, image_file = _bucket_query(variant_name)
        if quest is not None or image_file is not None:
            return quest, image_file

    quest_match = re.search(r"\|quest\s*=\s*([^\n|]+)", wikitext, re.IGNORECASE)
    quest = None
    if quest_match:
        val = quest_match.group(1).strip().lower()
        quest = "No" if val == "no" else ("Yes" if val != "" else None)

    image_match = re.search(r"\|image1?\s*=\s*\[\[File:([^\]|]+)", wikitext)
    image_file = image_match.group(1).strip() if image_match else None

    return quest, image_file


def get_image_url(filename: str) -> str | None:
    try:
        data = _get_json(
            {
                "action": "query",
                "titles": f"File:{filename}",
                "prop": "imageinfo",
                "iiprop": "url",
                "format": "json",
            },
        )
    except WikiError:
        return None
    query = data.get("query")
    if not isinstance(query, dict):
        return None
    pages = query.get("pages")
    if not isinstance(pages, dict):
        return None
    for page in pages.values():
        if not isinstance(page, dict):
            continue
        info = page.get("imageinfo", [])
        if info and isinstance(info[0], dict):
            url = info[0].get("url")
            if isinstance(url, str):
                return url
    return None


UNOBTAINABLE_SUFFIX = " (unobtainable item)"
UNOBTAINABLE_CATEGORY = "Category:Unobtainable items"


def filter_unobtainable_duplicates(items: list[str]) -> list[str]:
    names = set(items)
    return [
        name
        for name in items
        if not (name.endswith(UNOBTAINABLE_SUFFIX) and name.removesuffix(UNOBTAINABLE_SUFFIX) in names)
    ]


def get_unobtainable_items() -> set[str]:
    print("Fetching unobtainable items category...")
    names: set[str] = set()
    cmcontinue: str | None = None
    pages = 0
    while True:
        params = {
            "action": "query",
            "list": "categorymembers",
            "cmtitle": UNOBTAINABLE_CATEGORY,
            "cmtype": "page",
            "cmlimit": "500",
            "format": "json",
        }
        if cmcontinue:
            params["cmcontinue"] = cmcontinue
        data = _get_json(params)
        members = data.get("query", {}).get("categorymembers", [])
        names.update(m["title"] for m in members if m.get("ns") == 0)
        pages += 1
        print(f"  Page {pages}: {len(members)} items ({len(names)} items so far)")
        cont = data.get("continue")
        if not isinstance(cont, dict) or "cmcontinue" not in cont:
            break
        cmcontinue = cont["cmcontinue"]
    print(f"  Fetched {len(names)} unobtainable items across {pages} page(s)")
    return names


def filter_unobtainable(items: list[str], unobtainable: set[str]) -> list[str]:
    return [name for name in items if name not in unobtainable]


def get_spawn_items() -> list[str]:
    print("Fetching item spawn page links...")
    data = _get_json(
        {
            "action": "parse",
            "page": "Item_spawn",
            "prop": "links",
            "format": "json",
        },
    )
    parse = data["parse"]
    links = parse["links"]
    skip = {"Item", "Herblore", "Wilderness"}
    items = [link["*"] for link in links if link["ns"] == 0 and link["*"] not in skip]
    deduped = filter_unobtainable_duplicates(items)
    dup_skipped = len(items) - len(deduped)

    unobtainable = get_unobtainable_items()
    filtered = filter_unobtainable(deduped, unobtainable)
    unobt_skipped = len(deduped) - len(filtered)

    print(f"  Found {len(filtered)} items", end="")
    notes = []
    if dup_skipped:
        notes.append(f"{dup_skipped} unobtainable duplicates")
    if unobt_skipped:
        notes.append(f"{unobt_skipped} unobtainable items")
    if notes:
        print(f" ({', '.join(notes)} skipped)", end="")
    print()
    return filtered
