#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import socket
import socketserver
import sys
import threading
import time
import urllib.parse
import webbrowser
from http.server import SimpleHTTPRequestHandler
from pathlib import Path


def stage(message: str) -> None:
    print(f"[stage] {message}", file=sys.stderr)


def done(message: str) -> None:
    print(f"[done] {message}", file=sys.stderr)


def fail(message: str) -> None:
    raise SystemExit(message)


def load_manifest(path: Path) -> dict:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise SystemExit(f"manifest not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise SystemExit(f"invalid manifest JSON: {exc}") from exc

    if not isinstance(payload, dict):
        raise SystemExit("manifest must be a JSON object")
    return payload


def resolve_project_root(input_path: Path) -> Path:
    resolved = input_path.expanduser().resolve()
    if resolved.is_file():
        resolved = resolved.parent
    if (resolved / "manifest.json").exists() and (resolved / "app").is_dir():
        return resolved
    if resolved.name == "app" and (resolved.parent / "manifest.json").exists():
        return resolved.parent
    fail("Could not find a CLAWSPACE app root. Pass a project folder containing manifest.json and app/.")


def find_free_port(preferred: int, host: str) -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind((host, preferred))
            return preferred
        except OSError:
            sock.bind((host, 0))
            return int(sock.getsockname()[1])


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A003
        return


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


def main() -> None:
    parser = argparse.ArgumentParser(description="Preview a CLAWSPACE app locally.")
    parser.add_argument("path", help="Project root or app/ directory")
    parser.add_argument("--port", type=int, default=4327, help="Preferred preview port")
    parser.add_argument("--host", default="127.0.0.1", help="Preview host, defaults to 127.0.0.1")
    parser.add_argument("--open", action="store_true", help="Open the preview URL in the default browser")
    args = parser.parse_args()

    project_root = resolve_project_root(Path(args.path))
    manifest_path = project_root / "manifest.json"
    app_dir = project_root / "app"
    manifest = load_manifest(manifest_path)

    entry = str(manifest.get("entry") or "app/index.html").strip()
    if not entry:
        fail("manifest entry is empty")
    if not entry.startswith("app/"):
        fail("manifest entry must stay inside app/, for example app/index.html")

    entry_path = project_root / entry
    if not entry_path.exists():
        fail(f"manifest entry does not exist: {entry_path}")
    if not app_dir.is_dir():
        fail(f"app directory not found: {app_dir}")

    port = find_free_port(args.port, args.host)
    relative_entry = entry_path.relative_to(project_root).as_posix()
    preview_url = f"http://{args.host}:{port}/{urllib.parse.quote(relative_entry, safe='/')}"

    stage("Preparing local preview")
    done(f"Project root: {project_root}")
    done(f"Manifest: {manifest_path}")
    done(f"Entry: {relative_entry}")

    current_dir = Path.cwd()
    os.chdir(project_root)
    server = ReusableTCPServer((args.host, port), QuietHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    if args.open:
        webbrowser.open(preview_url)

    print(
        json.dumps(
            {
                "success": True,
                "projectRoot": str(project_root),
                "manifest": str(manifest_path),
                "entry": relative_entry,
                "previewUrl": preview_url,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    print()
    print(f"Preview URL: {preview_url}")
    print("Press Ctrl+C to stop the local preview server.")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        stage("Stopping local preview")
        server.shutdown()
        server.server_close()
        os.chdir(current_dir)
        done("Preview server stopped")


if __name__ == "__main__":
    main()
