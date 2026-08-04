#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

DEFAULT_SITE_URL = "https://www.nima-tech.space"


def fail(message: str) -> None:
    raise SystemExit(message)


def stage(message: str) -> None:
    print(f"[stage] {message}", file=sys.stderr)


def done(message: str) -> None:
    print(f"[done] {message}", file=sys.stderr)


def normalize_slug_or_url(value: str) -> str:
    value = value.strip()
    if not value:
        fail("Please provide a slug or a CLAWSPACE detail/download URL.")

    if value.startswith("http://") or value.startswith("https://"):
        parsed = urllib.parse.urlparse(value)
        if parsed.path.startswith("/apps/"):
            return parsed.path.rsplit("/", 1)[-1]
        if parsed.path.startswith("/downloads/") and parsed.path.endswith(".zip"):
            return parsed.path.rsplit("/", 1)[-1][:-4]
        fail("Unsupported URL. Use an app detail URL like /apps/<slug> or a download URL like /downloads/<slug>.zip.")

    slug = re.sub(r"[^a-z0-9-]+", "-", value.lower().replace("_", "-").replace(" ", "-")).strip("-")
    if not slug:
        fail("Could not derive a valid slug from the provided value.")
    return slug


def download_file(url: str, target_path: Path) -> None:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "clawapp-creator-download/1.0",
            "Accept": "application/zip,*/*",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        if response.status != 200:
            fail(f"Download failed: HTTP {response.status}")
        target_path.write_bytes(response.read())


def main() -> None:
    parser = argparse.ArgumentParser(description="Download an app package from CLAWSPACE.")
    parser.add_argument("app", help="App slug, detail URL, or download URL")
    parser.add_argument("--site-url", default=DEFAULT_SITE_URL, help=f"CLAWSPACE website, defaults to {DEFAULT_SITE_URL}")
    parser.add_argument("--out-dir", default=".", help="Directory where the zip should be saved")
    parser.add_argument("--json", action="store_true", help="Print JSON only")
    args = parser.parse_args()

    site_url = args.site_url.rstrip("/")
    slug = normalize_slug_or_url(args.app)
    out_dir = Path(args.out_dir).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    target_path = out_dir / f"{slug}.zip"
    download_url = f"{site_url}/downloads/{slug}.zip"
    detail_url = f"{site_url}/apps/{slug}"
    launch_url = f"{site_url}/launch/{slug}"

    stage("Downloading app package from CLAWSPACE")
    download_file(download_url, target_path)
    done(f"Saved package: {target_path}")

    result = {
        "success": True,
        "slug": slug,
        "savedTo": str(target_path),
        "detailUrl": detail_url,
        "launchUrl": launch_url,
        "downloadUrl": download_url,
    }

    print(json.dumps(result, ensure_ascii=False, indent=2))
    if args.json:
        return

    print("\nDownload complete.")
    print(f"Saved to: {target_path}")
    print(f"Detail page: {detail_url}")
    print(f"Launch page: {launch_url}")
    print(f"Download URL: {download_url}")


if __name__ == "__main__":
    main()
