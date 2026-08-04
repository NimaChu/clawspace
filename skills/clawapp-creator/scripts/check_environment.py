from __future__ import annotations

import argparse
import json
import platform
import shutil
import subprocess
import sys
import urllib.request
import webbrowser
from pathlib import Path


DEFAULT_SITE_URL = "https://www.nima-tech.space"


def check_python() -> dict:
    version = sys.version_info
    ok = version >= (3, 9)
    return {
        "name": "python",
        "ok": ok,
        "summary": f"Python {version.major}.{version.minor}.{version.micro}",
        "hint": "" if ok else "Python 3.9+ is recommended.",
    }


def check_site(site_url: str) -> dict:
    url = site_url.rstrip("/") + "/api/health"
    try:
        with urllib.request.urlopen(url, timeout=8) as response:
            ok = 200 <= response.status < 400
            return {
                "name": "network",
                "ok": ok,
                "summary": f"Reached {url} ({response.status})",
                "hint": "" if ok else "The site responded unexpectedly.",
            }
    except Exception as error:  # noqa: BLE001
        return {
            "name": "network",
            "ok": False,
            "summary": f"Could not reach {url}",
            "hint": str(error),
        }


def check_keychain() -> dict:
    if platform.system() != "Darwin":
        return {
            "name": "keychain",
            "ok": True,
            "summary": "macOS Keychain is optional on non-macOS systems.",
            "hint": "Use config-based password storage if you are not on macOS.",
        }

    security_path = shutil.which("security")
    return {
        "name": "keychain",
        "ok": bool(security_path),
        "summary": "macOS Keychain command is available." if security_path else "macOS Keychain command is missing.",
        "hint": "" if security_path else "The `security` command is normally present on macOS.",
    }


def check_browser() -> dict:
    try:
        controller = webbrowser.get()
        return {
            "name": "browser",
            "ok": True,
            "summary": f"Browser handler available: {controller.name}",
            "hint": "",
        }
    except webbrowser.Error as error:
        return {
            "name": "browser",
            "ok": False,
            "summary": "No browser handler detected.",
            "hint": str(error),
        }


def check_git() -> dict:
    git_path = shutil.which("git")
    return {
        "name": "git",
        "ok": bool(git_path),
        "summary": "Git is available." if git_path else "Git is not available.",
        "hint": "" if git_path else "Git is recommended for installing the skill from GitHub.",
    }


def check_skill_files(base_dir: Path) -> dict:
    required = [
        base_dir / "SKILL.md",
        base_dir / "upload-config.json",
        base_dir / "scripts" / "build_nima_package.py",
        base_dir / "scripts" / "upload_nima_package.py",
    ]
    missing = [str(path.relative_to(base_dir)) for path in required if not path.exists()]
    return {
        "name": "skill-files",
        "ok": not missing,
        "summary": "Required skill files are present." if not missing else "Some required skill files are missing.",
        "hint": "" if not missing else f"Missing: {', '.join(missing)}",
    }


def print_human_report(results: list[dict], site_url: str) -> None:
    print("ClawApp Creator Environment Check")
    print(f"Target site: {site_url}")
    print("")

    for item in results:
        icon = "OK" if item["ok"] else "WARN"
        print(f"[{icon}] {item['name']}: {item['summary']}")
        if item["hint"]:
            print(f"      {item['hint']}")

    failures = [item for item in results if not item["ok"]]
    print("")
    if failures:
        print("Result: usable with caveats")
        print("Next step: fix the WARN items above, then run this check again.")
    else:
        print("Result: ready to use")
        print("Next step: register or configure your CLAWSPACE account, then package and upload.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Check whether this machine is ready to use ClawApp Creator.")
    parser.add_argument("--site-url", default=DEFAULT_SITE_URL, help="CLAWSPACE base URL. Default: production site.")
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON instead of human-readable output.")
    args = parser.parse_args()

    base_dir = Path(__file__).resolve().parents[1]
    results = [
        check_python(),
        check_site(args.site_url),
        check_keychain(),
        check_browser(),
        check_git(),
        check_skill_files(base_dir),
    ]

    if args.json:
        print(json.dumps({"siteUrl": args.site_url, "checks": results}, indent=2))
    else:
        print_human_report(results, args.site_url)

    return 0 if all(item["ok"] for item in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
