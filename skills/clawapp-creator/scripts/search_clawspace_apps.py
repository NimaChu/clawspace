#!/usr/bin/env python3
from __future__ import annotations

import argparse
import html
import json
import re
import sys
import urllib.parse
import urllib.request
from html.parser import HTMLParser

DEFAULT_SITE_URL = "https://www.nima-tech.space"


def fail(message: str) -> None:
    raise SystemExit(message)


def stage(message: str) -> None:
    print(f"[stage] {message}", file=sys.stderr)


def done(message: str) -> None:
    print(f"[done] {message}", file=sys.stderr)


def fetch_text(url: str) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "clawapp-creator-search/1.0",
            "Accept": "text/html,application/xhtml+xml",
        },
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(charset, errors="replace")


def normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


class AppCardParser(HTMLParser):
    def __init__(self, site_url: str) -> None:
        super().__init__()
        self.site_url = site_url
        self.apps: list[dict] = []
        self._current: dict | None = None
        self._div_depth = 0
        self._capture_author = False
        self._capture_stars = False
        self._pending_label = ""

    @staticmethod
    def _attrs_to_dict(attrs: list[tuple[str, str | None]]) -> dict[str, str]:
        result: dict[str, str] = {}
        for key, value in attrs:
            if key:
                result[key] = value or ""
        return result

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = self._attrs_to_dict(attrs)
        if self._current is None and "data-app-card" in attrs_dict:
            detail_path = ""
            self._current = {
                "slug": "",
                "name": normalize_space(attrs_dict.get("data-app-title", "")),
                "description": normalize_space(attrs_dict.get("data-app-description", "")),
                "tags": [tag for tag in normalize_space(attrs_dict.get("data-app-tags", "")).split("|") if tag],
                "author": "",
                "stars": 0,
                "detailPath": detail_path,
            }
            self._div_depth = 1
            return

        if self._current is None:
            return

        if tag == "div":
            self._div_depth += 1
        if tag == "a":
            href = attrs_dict.get("href", "")
            if href.startswith("/apps/") and not self._current.get("detailPath"):
                self._current["detailPath"] = href
                self._current["slug"] = href.rsplit("/", 1)[-1].strip()
        if "data-star-count-display" in attrs_dict:
            self._capture_stars = True

    def handle_endtag(self, tag: str) -> None:
        if self._current is None:
            return

        if tag == "div":
            self._div_depth -= 1
        if self._div_depth <= 0:
            detail_path = self._current.get("detailPath") or f"/apps/{self._current.get('slug', '')}"
            slug = self._current.get("slug") or detail_path.rsplit("/", 1)[-1].strip()
            if slug:
                self.apps.append(
                    {
                        "slug": slug,
                        "name": self._current.get("name") or slug,
                        "description": self._current.get("description") or "",
                        "tags": self._current.get("tags") or [],
                        "author": self._current.get("author") or "",
                        "stars": int(self._current.get("stars") or 0),
                        "detailUrl": urllib.parse.urljoin(self.site_url, detail_path),
                        "launchUrl": urllib.parse.urljoin(self.site_url, f"/launch/{slug}"),
                        "downloadUrl": urllib.parse.urljoin(self.site_url, f"/downloads/{slug}.zip"),
                    }
                )
            self._current = None
            self._capture_author = False
            self._capture_stars = False
            self._pending_label = ""

    def handle_data(self, data: str) -> None:
        if self._current is None:
            return

        text = normalize_space(data)
        if not text:
            return

        if text == "作者":
            self._capture_author = True
            self._pending_label = "author"
            return
        if text == "星标":
            self._pending_label = "stars"
            return

        if self._capture_author and self._pending_label == "author":
            self._current["author"] = text
            self._capture_author = False
            self._pending_label = ""
            return

        if self._capture_stars or self._pending_label == "stars":
            if text.isdigit():
                self._current["stars"] = int(text)
                self._capture_stars = False
                self._pending_label = ""


def parse_catalog(home_html: str, site_url: str) -> list[dict]:
    parser = AppCardParser(site_url)
    parser.feed(home_html)
    seen = set()
    apps = []
    for app in parser.apps:
      slug = app.get("slug", "")
      if slug and slug not in seen:
        seen.add(slug)
        apps.append(app)
    return apps


def filter_apps(apps: list[dict], query: str) -> list[dict]:
    if not query:
        return apps
    query_tokens = [token for token in normalize_space(query).lower().split(" ") if token]
    filtered = []
    for app in apps:
        haystack = " ".join(
            [
                app.get("slug", ""),
                app.get("name", ""),
                app.get("description", ""),
                " ".join(app.get("tags", [])),
                app.get("author", ""),
            ]
        ).lower()
        if all(token in haystack for token in query_tokens):
            filtered.append(app)
    return filtered


def main() -> None:
    parser = argparse.ArgumentParser(description="Search public apps on CLAWSPACE.")
    parser.add_argument("query", nargs="?", default="", help="Search keywords for app name, description, tags, or author")
    parser.add_argument("--site-url", default=DEFAULT_SITE_URL, help=f"CLAWSPACE website, defaults to {DEFAULT_SITE_URL}")
    parser.add_argument("--limit", type=int, default=12, help="Maximum number of apps to print")
    parser.add_argument("--json", action="store_true", help="Print JSON only")
    args = parser.parse_args()

    site_url = args.site_url.rstrip("/")
    stage("Fetching CLAWSPACE app atlas")
    home_html = fetch_text(f"{site_url}/")
    apps = parse_catalog(home_html, site_url)
    done(f"Catalog loaded: {len(apps)} apps found")

    filtered = filter_apps(apps, args.query)
    filtered = sorted(filtered, key=lambda app: (-app.get("stars", 0), app.get("name", "").lower()))
    if args.limit > 0:
      filtered = filtered[: args.limit]

    result = {
        "success": True,
        "siteUrl": site_url,
        "query": args.query,
        "count": len(filtered),
        "apps": filtered,
    }

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not filtered:
        print("\nNo matching apps found.")
        return

    print("\nSearch results:")
    for index, app in enumerate(filtered, start=1):
        tags = ", ".join(app.get("tags", [])[:4]) or "no tags"
        print(f"{index}. {app['name']} ({app['slug']})")
        print(f"   Author: {app.get('author') or 'unknown'}")
        print(f"   Stars: {app.get('stars', 0)}")
        print(f"   Tags: {tags}")
        print(f"   Detail: {app['detailUrl']}")
        print(f"   Download: {app['downloadUrl']}")


if __name__ == "__main__":
    main()
