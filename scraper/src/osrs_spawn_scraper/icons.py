import re
import time
from pathlib import Path
from urllib.parse import urlparse

import requests

from .wiki import HEADERS, TIMEOUT, get_image_url

RATE_LIMIT_SLEEP = 0.3
WIKI_IMAGE_HOST = "oldschool.runescape.wiki"
ICON_PATH_RE = re.compile(r"^/icons/[^/?#]+\.(png|gif|jpe?g)$", re.IGNORECASE)


def icon_basename(image_file: str) -> str:
    if "." in image_file:
        name, ext = image_file.rsplit(".", 1)
    else:
        name, ext = image_file, "png"
    safe_name = name.replace(" ", "_").replace("/", "_").replace("\\", "_")
    return f"{safe_name}.{ext.lower()}"


def bundled_icon_path(image_file: str) -> str:
    return f"/icons/{icon_basename(image_file)}"


def is_bundled_icon_path(value: str) -> bool:
    return bool(ICON_PATH_RE.match(value))


def is_wiki_image_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    if parsed.scheme != "https" or parsed.hostname != WIKI_IMAGE_HOST:
        return False
    if not parsed.path.startswith("/images/"):
        return False
    return bool(re.match(r"^/images/[^/?#]+\.(png|gif|jpe?g)$", parsed.path, re.IGNORECASE))


def _download_bytes(url: str) -> bytes | None:
    try:
        response = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        response.raise_for_status()
    except requests.RequestException:
        return None
    content_type = response.headers.get("Content-Type", "")
    if content_type and not content_type.startswith("image/"):
        return None
    return response.content


def ensure_icon(
    *,
    icons_dir: Path,
    image_file: str | None,
    remote_url: str | None,
    bundled_path: str | None = None,
) -> str | None:
    if bundled_path and is_bundled_icon_path(bundled_path):
        filename = bundled_path.removeprefix("/icons/")
        if (icons_dir / filename).is_file():
            return bundled_path

    if not image_file:
        return None

    filename = icon_basename(image_file)
    dest = icons_dir / filename
    local_path = bundled_icon_path(image_file)

    if dest.is_file():
        return local_path

    if not remote_url or not is_wiki_image_url(remote_url):
        return None

    payload = _download_bytes(remote_url)
    if payload is None:
        return None

    icons_dir.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(payload)
    time.sleep(RATE_LIMIT_SLEEP)
    return local_path


def bundle_entry_icons(entry: dict, icons_dir: Path) -> dict:
    image_file = entry.get("image_file")
    image_url = entry.get("image_url")
    if not isinstance(image_file, str) and not isinstance(image_url, str):
        return entry

    remote_url = image_url if isinstance(image_url, str) and is_wiki_image_url(image_url) else None
    bundled = image_url if isinstance(image_url, str) and is_bundled_icon_path(image_url) else None
    file_name = image_file if isinstance(image_file, str) else None

    if remote_url is None and file_name and not (icons_dir / icon_basename(file_name)).is_file():
        remote_url = get_image_url(file_name)

    local_path = ensure_icon(
        icons_dir=icons_dir,
        image_file=file_name,
        remote_url=remote_url,
        bundled_path=bundled,
    )
    if local_path == image_url:
        return entry
    return {**entry, "image_url": local_path}


def bundle_spawn_icons(spawn_items: list[dict], icons_dir: Path) -> list[dict]:
    return [bundle_entry_icons(entry, icons_dir) for entry in spawn_items]
