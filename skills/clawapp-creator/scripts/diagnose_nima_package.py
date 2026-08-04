#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
import subprocess
from pathlib import Path

TEXT_SCAN_EXTENSIONS = {".html", ".css", ".js", ".mjs", ".json", ".svg", ".ts", ".tsx", ".jsx"}
MODEL_CATEGORIES = {"none", "text", "multimodal", "code"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
ICON_MAX_BYTES = 1 * 1024 * 1024
THUMBNAIL_MAX_BYTES = 2 * 1024 * 1024
SCREENSHOT_MAX_BYTES = 3 * 1024 * 1024
ICON_MAX_DIMENSION = 1024
THUMBNAIL_MAX_DIMENSION = 1600
SCREENSHOT_MAX_DIMENSION = 2200


def note(level: str, message: str) -> None:
    print(f"[{level}] {message}")


def load_manifest(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise SystemExit(f"manifest not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise SystemExit(f"manifest is not valid JSON: {exc}") from exc
    if not isinstance(data, dict):
        raise SystemExit("manifest must be a JSON object")
    return data


def normalize_slug(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9-]+", "-", value.strip().lower().replace("_", "-").replace(" ", "-"))
    return re.sub(r"^-+|-+$", "", normalized)


def get_image_dimensions(path: Path) -> tuple[int, int] | None:
    if sys.platform != "darwin" or path.suffix.lower() not in IMAGE_EXTENSIONS:
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


def scan_files(root: Path) -> tuple[list[str], list[str], list[str]]:
    remote_refs: list[str] = []
    absolute_asset_refs: list[str] = []
    external_keys: list[str] = []
    remote_url_pattern = re.compile(r"https?://", re.IGNORECASE)
    absolute_path_pattern = re.compile(r'(?:"|\'|\()/(?!/)(?:assets|static|images|img|favicon|icons?)/')
    key_pattern = re.compile(r"(api[_-]?key|openrouter|dashscope|sk-[a-zA-Z0-9]+)", re.IGNORECASE)

    for path in sorted(root.rglob("*")):
        if path.is_dir() or path.suffix.lower() not in TEXT_SCAN_EXTENSIONS:
            continue
        try:
            content = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        rel = path.relative_to(root).as_posix()
        if remote_url_pattern.search(content):
            remote_refs.append(rel)
        if absolute_path_pattern.search(content):
            absolute_asset_refs.append(rel)
        if key_pattern.search(content):
            external_keys.append(rel)

    return remote_refs, absolute_asset_refs, external_keys


def suggest_model_category(root: Path, manifest: dict) -> str:
    declared = str(manifest.get("modelCategory") or "none")
    combined = ""
    for path in sorted(root.rglob("*")):
        if path.is_dir() or path.suffix.lower() not in TEXT_SCAN_EXTENSIONS:
            continue
        try:
            combined += "\n" + path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue

    lowered = combined.lower()
    if "/api/llm/chat" in lowered:
        if any(token in lowered for token in ["image", "vision", "screenshot", "multimodal"]):
            return "multimodal"
        if any(token in lowered for token in ["code", "snippet", "programming", "developer"]):
            return "code"
        return "text"
    return declared if declared in MODEL_CATEGORIES else "none"


def main() -> None:
    parser = argparse.ArgumentParser(description="Diagnose a CLAWSPACE app project before packaging.")
    parser.add_argument("--app-dir", required=True, help="Built app directory or source directory to inspect")
    parser.add_argument("--manifest", required=True, help="Path to manifest.json")
    args = parser.parse_args()

    app_dir = Path(args.app_dir).expanduser().resolve()
    manifest_path = Path(args.manifest).expanduser().resolve()
    if not app_dir.exists():
        raise SystemExit(f"app dir not found: {app_dir}")

    manifest = load_manifest(manifest_path)
    slug = str(manifest.get("slug") or manifest.get("id") or "")
    normalized_slug = normalize_slug(slug)
    declared_model_category = str(manifest.get("modelCategory") or "none")
    suggested_model_category = suggest_model_category(app_dir, manifest)
    remote_refs, absolute_asset_refs, external_keys = scan_files(app_dir)
    assets_dir = manifest_path.parent / "assets"

    note("stage", "Diagnosis started")
    note("done", f"Manifest loaded: {manifest_path}")
    note("done", f"App directory scanned: {app_dir}")

    if not slug:
        note("error", "manifest is missing slug/id")
    elif slug != normalized_slug:
        note("warning", f"slug '{slug}' will normalize better as '{normalized_slug}'")
    else:
        note("done", f"slug looks good: {slug}")

    if declared_model_category not in MODEL_CATEGORIES:
        note("error", f"declared modelCategory '{declared_model_category}' is invalid")
    else:
        note("done", f"declared modelCategory: {declared_model_category}")

    if declared_model_category != suggested_model_category:
        note("warning", f"modelCategory may be a better fit as '{suggested_model_category}'")
    else:
        note("done", f"modelCategory looks aligned: {declared_model_category}")

    if remote_refs:
        note("warning", f"external resource references found in {len(remote_refs)} file(s): {', '.join(remote_refs[:5])}")
    else:
        note("done", "no external http/https resource references found")

    if absolute_asset_refs:
        note("warning", f"root-absolute asset paths found in {len(absolute_asset_refs)} file(s): {', '.join(absolute_asset_refs[:5])}")
    else:
        note("done", "no risky root-absolute asset paths found")

    if external_keys:
        note("warning", f"possible external model key usage found in {len(external_keys)} file(s): {', '.join(external_keys[:5])}")
    else:
        note("done", "no obvious external model key references found")

    if assets_dir.is_dir():
        for candidate_name, max_bytes, max_dimension in [
            ("thumbnail.png", THUMBNAIL_MAX_BYTES, THUMBNAIL_MAX_DIMENSION),
            ("thumbnail.jpg", THUMBNAIL_MAX_BYTES, THUMBNAIL_MAX_DIMENSION),
            ("thumbnail.jpeg", THUMBNAIL_MAX_BYTES, THUMBNAIL_MAX_DIMENSION),
            ("thumbnail.webp", THUMBNAIL_MAX_BYTES, THUMBNAIL_MAX_DIMENSION),
            ("icon.png", ICON_MAX_BYTES, ICON_MAX_DIMENSION),
            ("icon.jpg", ICON_MAX_BYTES, ICON_MAX_DIMENSION),
            ("icon.jpeg", ICON_MAX_BYTES, ICON_MAX_DIMENSION),
            ("icon.webp", ICON_MAX_BYTES, ICON_MAX_DIMENSION),
        ]:
            candidate = assets_dir / candidate_name
            if not candidate.is_file():
                continue
            size = candidate.stat().st_size
            if size > max_bytes:
                note("warning", f"{candidate.name} is large ({size} bytes). Recommended <= {max_bytes} bytes.")
            dimensions = get_image_dimensions(candidate)
            if dimensions and max(dimensions) > max_dimension:
                note("warning", f"{candidate.name} is {dimensions[0]}x{dimensions[1]}. Recommended <= {max_dimension}px on the longest side.")

        for screenshot in sorted(assets_dir.glob("screenshot*")):
            if not screenshot.is_file():
                continue
            size = screenshot.stat().st_size
            if size == 0:
                note("error", f"{screenshot.name} is empty (0 bytes)")
                continue
            if screenshot.suffix.lower() in IMAGE_EXTENSIONS:
                if size > SCREENSHOT_MAX_BYTES:
                    note("warning", f"{screenshot.name} is large ({size} bytes). Recommended <= {SCREENSHOT_MAX_BYTES} bytes.")
                dimensions = get_image_dimensions(screenshot)
                if dimensions and max(dimensions) > SCREENSHOT_MAX_DIMENSION:
                    note("warning", f"{screenshot.name} is {dimensions[0]}x{dimensions[1]}. Recommended <= {SCREENSHOT_MAX_DIMENSION}px on the longest side.")

        if (assets_dir / "thumbnail.svg").is_file() and not any((assets_dir / name).is_file() for name in ["thumbnail.png", "thumbnail.jpg", "thumbnail.jpeg", "thumbnail.webp"]):
            note("warning", "only thumbnail.svg was found. Web can use it, but mobile shells may fall back to a default PNG cover.")

    note("next", "If warnings remain, fix them before packaging or upload with --dry-run first.")


if __name__ == "__main__":
    main()
