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
        login_output = run_curl(
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
                f"{site_url.rstrip('/')}/api/auth/login",
            ]
        )

    payload = json.loads(login_output)
    if not payload.get("success"):
        raise SystemExit(payload.get("error") or "login verification failed")


def register_account(site_url: str, email: str, password: str, display_name: str) -> dict:
    output = run_curl(
        [
            "curl",
            "-sS",
            "-H",
            "Content-Type: application/x-www-form-urlencoded",
            "--data-urlencode",
            f"displayName={display_name}",
            "--data-urlencode",
            f"email={email}",
            "--data-urlencode",
            f"password={password}",
            f"{site_url.rstrip('/')}/api/auth/register",
        ]
    )
    payload = json.loads(output)
    if not payload.get("success"):
        raise SystemExit(
            f"{payload.get('error') or 'registration failed'}\n"
            "If this email already has an account, run setup_upload_config.py instead."
        )
    return payload


def prompt_value(label: str, current: str, *, secret: bool = False) -> str:
    suffix = f" [{current}]" if current and not secret else ""
    prompt = f"{label}{suffix}: "
    value = getpass.getpass(prompt) if secret else input(prompt)
    value = value.strip()
    return value or current


def prompt_validated(label: str, current: str, validator, example: str) -> str:
    while True:
        value = prompt_value(f"{label} (example: {example})", current)
        try:
            return validator(value)
        except ValueError as exc:
            print(f"Invalid {label.lower()}: {exc}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Register a new CLAWSPACE account and optionally save reusable upload credentials."
    )
    parser.add_argument("--config", default=str(DEFAULT_CONFIG_PATH), help="Path to upload-config.json")
    parser.add_argument("--site-url", help=f"Base site URL, defaults to {DEFAULT_SITE_URL}")
    parser.add_argument("--display-name", help="Public display name for the new account")
    parser.add_argument("--email", help="Email for the new account")
    parser.add_argument("--password", help="Password for the new account")
    parser.add_argument("--password-store", choices=["config", "keychain", "both"], help="Where to store the password after registration")
    parser.add_argument("--keychain-service", help="macOS Keychain service name")
    parser.add_argument("--non-interactive", action="store_true", help="Require all values to be passed as flags or already present in config")
    args = parser.parse_args()

    config_path = Path(args.config).expanduser().resolve()
    existing = load_config(config_path)

    site_url = (args.site_url or existing.get("siteUrl") or "").strip()
    display_name = (args.display_name or "").strip()
    email = (args.email or existing.get("email") or "").strip()
    password = (args.password or "").strip()
    keychain_service = (args.keychain_service or existing.get("keychainService") or DEFAULT_KEYCHAIN_SERVICE).strip() or DEFAULT_KEYCHAIN_SERVICE
    password_store = args.password_store or ("keychain" if supports_keychain() else "config")

    if not args.non_interactive:
        print("Create a new CLAWSPACE account, then save the reusable upload config in one step.")
        site_url = prompt_validated("Site URL", site_url, validate_site_url, DEFAULT_SITE_URL)
        display_name = prompt_value("Display name", display_name or "Your Name")
        email = prompt_validated("Email", email, validate_email, "you@example.com")
        while True:
            password = prompt_value("Password (min 8 characters)", password, secret=True)
            if len(password) >= 8:
                break
            print("Password must be at least 8 characters.")
        if supports_keychain():
            current = password_store
            selected = input(f"Password store [config/keychain/both] [{current}]: ").strip().lower()
            if selected:
                password_store = selected

    if not site_url or not display_name or not email or not password:
        raise SystemExit("missing required values: siteUrl, displayName, email, and password are all required")
    try:
        site_url = validate_site_url(site_url)
        email = validate_email(email)
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc

    if len(password) < 8:
        raise SystemExit("Password must be at least 8 characters.")

    if password_store not in {"config", "keychain", "both"}:
        raise SystemExit("password store must be one of: config, keychain, both")
    if password_store in {"keychain", "both"} and not supports_keychain():
        raise SystemExit("macOS Keychain storage is only available on macOS")

    try:
        payload = register_account(site_url, email, password, display_name)
        verify_login(site_url, email, password)
    except SystemExit as exc:
        raise SystemExit(
            f"{exc}\nRegistration failed. If you already created this account on the website, run setup_upload_config.py instead."
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

    print(f"Registered CLAWSPACE account for {payload['user']['email']}.")
    print(f"Saved upload config: {config_path}")
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
    print("Next step: run upload_nima_package.py or setup_upload_config.py if you want to update these credentials later.")


if __name__ == "__main__":
    main()
