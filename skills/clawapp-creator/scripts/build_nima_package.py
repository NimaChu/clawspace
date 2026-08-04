#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import platform
import re
import subprocess
import sys
import zipfile
from pathlib import Path

MAX_PACKAGE_BYTES = 25 * 1024 * 1024
ALLOWED_MODEL_CATEGORIES = {"none", "text", "multimodal", "code"}
TEXT_SCAN_EXTENSIONS = {".html", ".css", ".js", ".mjs", ".json", ".svg"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
ICON_MAX_BYTES = 1 * 1024 * 1024
THUMBNAIL_MAX_BYTES = 2 * 1024 * 1024
SCREENSHOT_MAX_BYTES = 3 * 1024 * 1024
ICON_MAX_DIMENSION = 1024
THUMBNAIL_MAX_DIMENSION = 1600
SCREENSHOT_MAX_DIMENSION = 2200


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def warn(message: str) -> None:
    print(f"WARNING: {message}", file=sys.stderr)


def get_image_dimensions(path: Path) -> tuple[int, int] | None:
    if platform.system() != "Darwin" or path.suffix.lower() not in IMAGE_EXTENSIONS:
        return None

    result = subprocess.run(
        ["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(path)],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return None

    width_match = re.search(r"pixelWidth:\s*(\d+)", result.stdout)
    height_match = re.search(r"pixelHeight:\s*(\d+)", result.stdout)
    if not width_match or not height_match:
        return None

    return int(width_match.group(1)), int(height_match.group(1))


def load_manifest(path: Path) -> dict:
    try:
      data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
      fail(f"manifest not found: {path}")
    except json.JSONDecodeError as exc:
      fail(f"manifest is not valid JSON: {exc}")
    if not isinstance(data, dict):
      fail("manifest must be a JSON object")
    return data


def ensure_manifest(manifest: dict, app_dir: Path, assets_dir: Path | None) -> None:
    for field in ["id", "name", "description", "version", "entry"]:
        if not manifest.get(field):
            fail(f"manifest missing required field: {field}")

    entry = str(manifest["entry"])
    if not entry.startswith("app/"):
        fail("manifest entry must start with app/")

    entry_relative = entry.removeprefix("app/")
    if not (app_dir / entry_relative).is_file():
        fail(f"entry file not found in app dir: {entry_relative}")

    model_category = manifest.get("modelCategory", "none")
    if model_category not in ALLOWED_MODEL_CATEGORIES:
        fail("modelCategory must be one of: none, text, multimodal, code")

    if assets_dir:
        for field in ["thumbnail", "icon"]:
            value = manifest.get(field)
            if value and not (assets_dir / Path(value).name).exists():
                fail(f"asset referenced by {field} not found in assets dir: {value}")

        for screenshot in manifest.get("screenshots", []):
            if screenshot and not (assets_dir / Path(screenshot).name).exists():
                fail(f"screenshot not found in assets dir: {screenshot}")


def inspect_assets_dir(assets_dir: Path | None) -> None:
    if not assets_dir or not assets_dir.is_dir():
        return

    def inspect(candidate: Path, max_bytes: int, max_dimension: int) -> None:
        size = candidate.stat().st_size
        if size == 0:
            fail(f"asset is empty (0 bytes): {candidate.name}")
        if size > max_bytes:
            warn(f"{candidate.name} is large ({size} bytes). Recommended <= {max_bytes} bytes.")
        dimensions = get_image_dimensions(candidate)
        if dimensions and max(dimensions) > max_dimension:
            warn(
                f"{candidate.name} is {dimensions[0]}x{dimensions[1]}. "
                f"Recommended <= {max_dimension}px on the longest side."
            )

    for name in ["icon.png", "icon.jpg", "icon.jpeg", "icon.webp"]:
        candidate = assets_dir / name
        if candidate.is_file():
            inspect(candidate, ICON_MAX_BYTES, ICON_MAX_DIMENSION)

    for name in ["thumbnail.png", "thumbnail.jpg", "thumbnail.jpeg", "thumbnail.webp"]:
        candidate = assets_dir / name
        if candidate.is_file():
            inspect(candidate, THUMBNAIL_MAX_BYTES, THUMBNAIL_MAX_DIMENSION)

    for candidate in sorted(assets_dir.glob("screenshot*")):
        if candidate.is_file():
            inspect(candidate, SCREENSHOT_MAX_BYTES, SCREENSHOT_MAX_DIMENSION)

    has_svg_thumbnail = (assets_dir / "thumbnail.svg").is_file()
    has_bitmap_thumbnail = any((assets_dir / name).is_file() for name in ["thumbnail.png", "thumbnail.jpg", "thumbnail.jpeg", "thumbnail.webp"])
    if has_svg_thumbnail and not has_bitmap_thumbnail:
        warn(
            "Only thumbnail.svg was found. Web can use it, but mobile shells may fall back to a default PNG cover."
        )


def add_tree(zf: zipfile.ZipFile, source_dir: Path, zip_prefix: str) -> None:
    for path in sorted(source_dir.rglob("*")):
        if path.is_dir():
            continue
        relative = path.relative_to(source_dir).as_posix()
        zf.write(path, f"{zip_prefix}/{relative}")


def scan_for_risky_asset_paths(app_dir: Path) -> None:
    absolute_path_pattern = re.compile(r'(?:"|\'|\()/(?!/)(?:assets|static|images|img|favicon|icons?)/')
    remote_url_pattern = re.compile(r'https?://', re.IGNORECASE)

    for path in sorted(app_dir.rglob("*")):
        if path.is_dir() or path.suffix.lower() not in TEXT_SCAN_EXTENSIONS:
            continue

        try:
            content = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue

        relative_path = path.relative_to(app_dir).as_posix()
        if remote_url_pattern.search(content):
            warn(
                f"{relative_path} contains http/https resource references. "
                "These external files may fail after upload or create unstable runtime dependencies. "
                "Prefer bundling the asset into app/ or using a relative path."
            )
        if absolute_path_pattern.search(content):
            warn(
                f"{relative_path} contains root-absolute asset paths like /assets/... which may break after upload. "
                "Prefer relative paths such as ./assets/... inside the packaged app."
            )


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a Nima Tech Space compliant app package zip.")
    parser.add_argument("--app-dir", required=True, help="Directory containing built static files.")
    parser.add_argument("--manifest", required=True, help="Path to manifest.json.")
    parser.add_argument("--out", required=True, help="Output zip path.")
    parser.add_argument("--readme", help="Optional README.md path.")
    parser.add_argument("--assets-dir", help="Optional assets directory.")
    args = parser.parse_args()

    app_dir = Path(args.app_dir).expanduser().resolve()
    manifest_path = Path(args.manifest).expanduser().resolve()
    out_path = Path(args.out).expanduser().resolve()
    readme_path = Path(args.readme).expanduser().resolve() if args.readme else None
    assets_dir = Path(args.assets_dir).expanduser().resolve() if args.assets_dir else None

    if not app_dir.is_dir():
        fail(f"app dir not found: {app_dir}")

    if readme_path and not readme_path.is_file():
        fail(f"README not found: {readme_path}")

    if assets_dir and not assets_dir.is_dir():
        fail(f"assets dir not found: {assets_dir}")

    manifest = load_manifest(manifest_path)
    ensure_manifest(manifest, app_dir, assets_dir)
    scan_for_risky_asset_paths(app_dir)
    inspect_assets_dir(assets_dir)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    if out_path.exists():
        out_path.unlink()

    with zipfile.ZipFile(out_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
        if readme_path:
            zf.write(readme_path, "README.md")
        add_tree(zf, app_dir, "app")
        if assets_dir:
            add_tree(zf, assets_dir, "assets")

    size = out_path.stat().st_size
    if size > MAX_PACKAGE_BYTES:
        out_path.unlink(missing_ok=True)
        fail("final zip exceeds 25MB limit")

    print(f"Package built: {out_path}")
    print(f"Size: {size} bytes")
    print("Checklist: manifest.json present, app/ present, entry verified, size verified, risky asset paths scanned, asset sizes checked.")


if __name__ == "__main__":
    main()
