#!/usr/bin/env python3
from __future__ import annotations

import argparse
import getpass
import json
import os
import platform
import re
import subprocess
import tempfile
import urllib.parse
from pathlib import Path

DEFAULT_CONFIG_PATH = Path(__file__).resolve().parents[1] / "upload-config.json"
DEFAULT_KEYCHAIN_SERVICE = "nima-tech-space-upload"
DEFAULT_SITE_URL = "https://www.nima-tech.space"


def validate_site_url(value: str) -> str:
    parsed = urllib.parse.urlparse(value.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Site URL must start with http:// or https:// and include a valid host.")
    return value.rstrip("/")


def validate_email(value: str) -> str:
    email = value.strip()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise ValueError("Email must look like name@example.com.")
    return email


def load_config(path: Path) -> dict:
    if not path.exists():
        return {"siteUrl": DEFAULT_SITE_URL, "email": "", "password": "", "useKeychain": False, "keychainService": DEFAULT_KEYCHAIN_SERVICE}

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


def save_config(
    path: Path,
    site_url: str,
    email: str,
    password: str,
    *,
    use_keychain: bool,
    keychain_service: str,
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            {
                "siteUrl": site_url,
                "email": email,
                "password": password,
                "useKeychain": use_keychain,
                "keychainService": keychain_service,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    os.chmod(path, 0o600)


def run_curl(command: list[str]) -> str:
    result = subprocess.run(command, check=False, capture_output=True, text=True)
    if result.returncode != 0:
        raise SystemExit(result.stderr.strip() or "curl request failed")
    return result.stdout


def supports_keychain() -> bool:
    return platform.system() == "Darwin"


def save_password_to_keychain(service: str, account: str, password: str) -> None:
    result = subprocess.run(
        [
            "security",
            "add-generic-password",
            "-U",
            "-a",
            account,
            "-s",
            service,
            "-w",
            password,
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise SystemExit(result.stderr.strip() or "failed to save password to macOS Keychain")


def verify_login(site_url: str, email: str, password: str) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        cookie_path = Path(temp_dir) / "cookies.txt"
        login_output = run_curl([
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
            f"{site_url.rstrip('/')}/api/auth/login",
        ])

    payload = json.loads(login_output)
    if not payload.get("success"):
        raise SystemExit(payload.get("error") or "login verification failed")


def prompt_value(label: str, current: str, secret: bool = False) -> str:
    suffix = f" [{current}]" if current and not secret else ""
    prompt = f"{label}{suffix}: "
    value = getpass.getpass(prompt) if secret else input(prompt)
    value = value.strip()
    return value or current


def prompt_validated(label: str, current: str, validator, example: str, secret: bool = False) -> str:
    while True:
        shown_label = f"{label} (example: {example})"
        value = prompt_value(shown_label, current, secret=secret)
        try:
            return validator(value) if not secret else value
        except ValueError as exc:
            print(f"Invalid {label.lower()}: {exc}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Create or update the reusable upload config for Nima Tech Space.")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG_PATH), help="Path to upload-config.json")
    parser.add_argument("--site-url", help=f"Base site URL, defaults to {DEFAULT_SITE_URL}")
    parser.add_argument("--email", help="Login email")
    parser.add_argument("--password", help="Login password")
    parser.add_argument("--password-store", choices=["config", "keychain", "both"], help="Where to store the password after verification")
    parser.add_argument("--keychain-service", help="macOS Keychain service name")
    parser.add_argument("--non-interactive", action="store_true", help="Require all values to be passed as flags or already present in config")
    args = parser.parse_args()

    config_path = Path(args.config).expanduser().resolve()
    existing = load_config(config_path)

    site_url = (args.site_url or existing.get("siteUrl") or "").strip()
    email = (args.email or existing.get("email") or "").strip()
    password = (args.password or existing.get("password") or "").strip()
    keychain_service = (args.keychain_service or existing.get("keychainService") or DEFAULT_KEYCHAIN_SERVICE).strip() or DEFAULT_KEYCHAIN_SERVICE
    password_store = args.password_store or ("keychain" if existing.get("useKeychain") else "config")

    if not args.non_interactive:
        site_url = prompt_validated("Site URL", site_url, validate_site_url, DEFAULT_SITE_URL)
        email = prompt_validated("Email", email, validate_email, "you@example.com")
        password = prompt_value("Password", password, secret=True)
        if supports_keychain():
            current = password_store
            selected = input(f"Password store [config/keychain/both] [{current}]: ").strip().lower()
            if selected:
                password_store = selected

    if not site_url or not email or not password:
        raise SystemExit("missing required values: siteUrl, email, and password are all required")
    try:
        site_url = validate_site_url(site_url)
        email = validate_email(email)
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc

    if password_store not in {"config", "keychain", "both"}:
        raise SystemExit("password store must be one of: config, keychain, both")

    if password_store in {"keychain", "both"} and not supports_keychain():
        raise SystemExit("macOS Keychain storage is only available on macOS")

    try:
        verify_login(site_url, email, password)
    except SystemExit as exc:
        raise SystemExit(
            f"{exc}\nCredential verification failed. Please re-run this command and check the site URL, email, and password."
        ) from exc
    if password_store in {"keychain", "both"}:
        save_password_to_keychain(keychain_service, email, password)

    save_config(
        config_path,
        site_url.rstrip("/"),
        email,
        password if password_store in {"config", "both"} else "",
        use_keychain=password_store in {"keychain", "both"},
        keychain_service=keychain_service,
    )
    print(f"Saved upload config: {config_path}")
    print("Credentials verified by login.")
    if password_store in {"keychain", "both"}:
        print(f"Password saved to macOS Keychain service: {keychain_service}")
    if password_store == "config":
        print("Password stored in upload-config.json.")
        print("Security note: plaintext config storage is the compatibility option. Prefer `keychain` on macOS when possible.")
    elif password_store == "both":
        print("Password stored in both upload-config.json and macOS Keychain.")
        print("Security note: the config file still contains a plaintext password. Use `keychain` only for the safest local setup.")
    else:
        print("Password stored in macOS Keychain; upload-config.json keeps only site metadata.")
    print("Permissions set to 600.")


if __name__ == "__main__":
    main()
