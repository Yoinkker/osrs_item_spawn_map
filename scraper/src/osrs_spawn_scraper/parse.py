import re

from .wiki import get_wikitext

MIN_COORD_PARTS = 2


class CoordParseError(ValueError):
    @classmethod
    def invalid(cls, coord_str: str) -> "CoordParseError":
        msg = f"Invalid coord: {coord_str!r}"
        return cls(msg)

    @classmethod
    def invalid_qty(cls, coord_str: str) -> "CoordParseError":
        msg = f"Invalid coord qty: {coord_str!r}"
        return cls(msg)


def parse_coord(coord_str: str) -> dict:
    parts = coord_str.split(",")
    if len(parts) < MIN_COORD_PARTS:
        raise CoordParseError.invalid(coord_str)
    try:
        x = int(parts[0])
        y = int(parts[1])
    except ValueError as exc:
        raise CoordParseError.invalid(coord_str) from exc
    qty = 1
    for part in parts[2:]:
        if part.startswith("qty:"):
            try:
                qty = int(part.replace("qty:", ""))
            except ValueError as exc:
                raise CoordParseError.invalid_qty(coord_str) from exc
    if qty < 1:
        raise CoordParseError.invalid_qty(coord_str)
    return {"x": x, "y": y, "qty": qty}


def normalize_members(raw: str | None) -> str:
    if not raw:
        return "?"
    lower = raw.lower()
    if lower == "yes":
        return "Yes"
    if lower == "no":
        return "No"
    return "?"


def clean_location(raw: str) -> str:
    def floor(m: re.Match) -> str:
        uk = re.search(r"uk=(\d+)", m.group(0))
        return f"level {uk.group(1)}" if uk else ""

    loc = re.sub(r"\{\{FloorNumber\|[^{}]*\}\}", floor, raw.strip())
    loc = re.sub(r"\{\{[^{}]*\}\}", "", loc)
    loc = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", loc)
    loc = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]|]+)", r"\1", loc)
    loc = re.sub(r"<ref[^>]*>.*?</ref>", "", loc, flags=re.DOTALL | re.IGNORECASE)
    loc = re.sub(r"<[^>]+>", "", loc)
    return re.sub(r"\s+", " ", loc).strip()


def normalize_spawn_name(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip().lower())


def spawn_name_matches(item_name: str, template_name: str | None) -> bool:
    if template_name is None:
        return True
    item = normalize_spawn_name(item_name)
    tmpl = normalize_spawn_name(template_name)
    if item == tmpl:
        return True
    return item in tmpl or tmpl in item


def parse_spawn_lines(wikitext: str, item_name: str | None = None) -> list[dict]:
    spawns = []
    for match in re.finditer(r"\{\{ItemSpawnLine((?:[^{}]|\{\{[^{}]*\}\})*)\}\}", wikitext, re.DOTALL):
        template = match.group(1)
        name = re.search(r"\|name=([^|}\n]+)", template)
        template_name = name.group(1).strip() if name else None
        if item_name is not None and not spawn_name_matches(item_name, template_name):
            continue
        location = re.search(r"\|location=((?:[^|{}\[\]\n]|\{\{[^{}]*\}\}|\[\[[^\]]*\]\])+)", template)
        members = re.search(r"\|members=(Yes|No)", template, re.IGNORECASE)
        map_id = re.search(r"\|mapID=(-?\d+)", template)
        plane = re.search(r"\|plane=(\d+)", template)
        stripped = re.sub(r"<!--.*?-->", "", template, flags=re.DOTALL)
        stripped = re.sub(r"\|[a-zA-Z][^|{}]*", "", stripped)
        coords = []
        for coord_str in re.findall(r"\|(\d{3,5},\d{3,5}(?:,qty:\d+)?)", stripped):
            try:
                coords.append(parse_coord(coord_str))
            except CoordParseError:
                continue
        spawns.append(
            {
                "location": clean_location(location.group(1)) if location else "Unknown",
                "members": normalize_members(members.group(1) if members else None),
                "map_id": int(map_id.group(1)) if map_id else 0,
                "plane": int(plane.group(1)) if plane else 0,
                "coords": coords,
            },
        )
    return spawns


def get_spawn_coords(item_name: str) -> list[dict]:
    wikitext = get_wikitext(item_name)
    if not wikitext:
        return []
    return parse_spawn_lines(wikitext, item_name)
