#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import platform
import subprocess
import sys
import tempfile
from pathlib import Path

DEFAULT_CONFIG_PATH = Path(__file__).resolve().parents[1] / "upload-config.json"
DEFAULT_KEYCHAIN_SERVICE = "nima-tech-space-upload"
DEFAULT_SITE_URL = "https://www.nima-tech.space"


def fail(message: str) -> None:
    raise SystemExit(message)


def run_curl_json(command: list[str], error_message: str) -> dict:
    result = subprocess.run(command, check=False, capture_output=True, text=True)
    if result.returncode != 0:
        fail(result.stderr.strip() or error_message)

    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"{error_message}: invalid JSON response") from exc

    if not isinstance(payload, dict):
        fail(f"{error_message}: response must be a JSON object")

    return payload


def supports_keychain() -> bool:
    return platform.system() == "Darwin"


def read_password_from_keychain(service: str, account: str) -> str:
    result = subprocess.run(
        [
            "security",
            "find-generic-password",
            "-a",
            account,
            "-s",
            service,
            "-w",
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return ""
    return result.stdout.strip()


def load_config(path: Path) -> dict:
    if not path.exists():
        return {
            "siteUrl": DEFAULT_SITE_URL,
            "email": "",
            "password": "",
            "useKeychain": False,
            "keychainService": DEFAULT_KEYCHAIN_SERVICE,
        }

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"invalid config JSON: {exc}") from exc

    if not isinstance(data, dict):
        raise SystemExit("config file must contain a JSON object")

    return {
        "siteUrl": str(data.get("siteUrl", DEFAULT_SITE_URL) or DEFAULT_SITE_URL),
        "email": str(data.get("email", "")),
        "password": str(data.get("password", "")),
        "useKeychain": bool(data.get("useKeychain", False)),
        "keychainService": str(data.get("keychainService", DEFAULT_KEYCHAIN_SERVICE) or DEFAULT_KEYCHAIN_SERVICE),
    }


def resolve_credentials(config_path: Path, explicit_site_url: str, explicit_email: str, explicit_password: str) -> tuple[str, str, str, dict]:
    config = load_config(config_path)
    site_url = (explicit_site_url or config.get("siteUrl") or "").strip().rstrip("/")
    email = (explicit_email or config.get("email") or "").strip()
    config_password = (config.get("password") or "").strip()
    keychain_service = str(config.get("keychainService") or DEFAULT_KEYCHAIN_SERVICE).strip() or DEFAULT_KEYCHAIN_SERVICE
    keychain_password = ""
    if not explicit_password and config.get("useKeychain") and supports_keychain() and email:
        keychain_password = read_password_from_keychain(keychain_service, email)
    password = (explicit_password or config_password or keychain_password or "").strip()
    return site_url, email, password, config


def verify_account(site_url: str, email: str, password: str) -> dict:
    with tempfile.TemporaryDirectory() as temp_dir:
        cookie_path = Path(temp_dir) / "cookies.txt"
        payload = run_curl_json(
            [
                "curl",
                "-sS",
                "-c",
                str(cookie_path),
                "-H",
                "Content-Type: application/x-www-form-urlencoded",
                "--data-urlencode",
                f"email={email}",
                "--data-urlencode",
                f"password={password}",
                f"{site_url}/api/auth/login",
            ],
            "account verification failed",
        )
    if not payload.get("success"):
        fail(
            f"{payload.get('error') or 'login failed'}\n"
            "Please refresh your saved credentials with `python3 scripts/setup_upload_config.py`.\n"
            "If you do not have an account yet, run `python3 scripts/register_clawspace_account.py`."
        )
    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description="Show which CLAWSPACE account the current upload config is bound to.")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG_PATH), help="Path to upload-config.json")
    parser.add_argument("--site-url", help=f"Base site URL, defaults to {DEFAULT_SITE_URL}")
    parser.add_argument("--email", help="Override login email")
    parser.add_argument("--password", help="Override login password")
    parser.add_argument("--json", action="store_true", help="Print JSON instead of a human-readable summary")
    args = parser.parse_args()

    config_path = Path(args.config).expanduser().resolve()
    site_url, email, password, config = resolve_credentials(
        config_path,
        args.site_url or "",
        args.email or "",
        args.password or "",
    )

    if not site_url or not email or not password:
        fail(
            "No usable CLAWSPACE account config found.\n"
            f"- Config file: {config_path}\n"
            "- Existing account: run `python3 scripts/setup_upload_config.py`\n"
            "- New account: run `python3 scripts/register_clawspace_account.py`"
        )

    payload = verify_account(site_url, email, password)
    user = payload.get("user") or {}
    result = {
        "success": True,
        "siteUrl": site_url,
        "configPath": str(config_path),
        "email": user.get("email") or email,
        "displayName": user.get("displayName") or "",
        "role": user.get("role") or "member",
        "provider": user.get("provider") or "",
        "githubConnected": bool(user.get("githubConnected")),
        "hasPassword": bool(user.get("hasPassword")),
        "passwordSource": "keychain" if config.get("useKeychain") else ("config" if config.get("password") else "flag"),
    }

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    print("CLAWSPACE account status")
    print(f"Site: {result['siteUrl']}")
    print(f"Config: {result['configPath']}")
    print(f"Display name: {result['displayName'] or '(empty)'}")
    print(f"Email: {result['email']}")
    print(f"Role: {result['role']}")
    print(f"Provider: {result['provider'] or 'password'}")
    print(f"GitHub connected: {'yes' if result['githubConnected'] else 'no'}")
    print(f"Password source: {result['passwordSource']}")
    print("")
    print("This is the account that upload_nima_package.py will use with the current config.")


if __name__ == "__main__":
    main()
