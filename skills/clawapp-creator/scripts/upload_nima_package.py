#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import platform
import re
import subprocess
import sys
import tempfile
import urllib.parse
from pathlib import Path

ALLOWED_MODEL_CATEGORIES = {"none", "text", "multimodal", "code"}
DEFAULT_CONFIG_PATH = Path(__file__).resolve().parents[1] / "upload-config.json"
DIRECT_UPLOAD_THRESHOLD_BYTES = int(4.5 * 1024 * 1024)
BLOB_API_URL = "https://vercel.com/api/blob"
BLOB_API_VERSION = "12"
DEFAULT_KEYCHAIN_SERVICE = "nima-tech-space-upload"
DEFAULT_SITE_URL = "https://www.nima-tech.space"


def fail(message: str) -> None:
    raise SystemExit(message)


def stage(message: str) -> None:
    print(f"[stage] {message}", file=sys.stderr)


def done(message: str) -> None:
    print(f"[done] {message}", file=sys.stderr)


def next_step(message: str) -> None:
    print(f"[next] {message}", file=sys.stderr)


def run_curl(command: list[str]) -> str:
    result = subprocess.run(command, check=False, capture_output=True, text=True)
    if result.returncode != 0:
        raise SystemExit(result.stderr.strip() or "curl request failed")
    return result.stdout


def run_curl_json(command: list[str], error_message: str) -> dict:
    output = run_curl(command)
    try:
        payload = json.loads(output)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"{error_message}: {output.strip() or 'invalid JSON response'}") from exc

    if not isinstance(payload, dict):
        raise SystemExit(f"{error_message}: response must be a JSON object")

    return payload


def try_curl_json(command: list[str]) -> tuple[dict | None, str]:
    result = subprocess.run(command, check=False, capture_output=True, text=True)
    if result.returncode != 0:
        return None, result.stderr.strip() or "curl request failed"

    output = result.stdout
    try:
        payload = json.loads(output)
    except json.JSONDecodeError:
        return None, output.strip() or "invalid JSON response"

    if not isinstance(payload, dict):
        return None, "response must be a JSON object"

    return payload, ""


def sanitize_blob_pathname(filename: str) -> str:
    safe_name = re.sub(r"[^a-zA-Z0-9._-]+", "-", filename)
    return f"package-uploads/{safe_name}"


def normalize_slug(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9-]+", "-", value.strip().lower().replace("_", "-").replace(" ", "-"))
    return re.sub(r"^-+|-+$", "", normalized)


def load_manifest_from_zip(package_path: Path) -> dict:
    import zipfile

    try:
        with zipfile.ZipFile(package_path) as zf:
            with zf.open("manifest.json") as manifest_file:
                manifest = json.load(manifest_file)
    except KeyError as exc:
        raise SystemExit("package missing manifest.json") from exc
    except json.JSONDecodeError as exc:
        raise SystemExit(f"manifest.json is not valid JSON: {exc}") from exc

    if not isinstance(manifest, dict):
        raise SystemExit("manifest.json must be a JSON object")

    return manifest


def load_manifest_slug_from_zip(package_path: Path) -> str:
    manifest = load_manifest_from_zip(package_path)

    slug = normalize_slug(str(manifest.get("slug") or manifest.get("id") or ""))
    if not slug:
        raise SystemExit("manifest.json must contain a valid slug or id")

    return slug


def resolve_model_category(cli_value: str, manifest: dict) -> str:
    normalized_cli = str(cli_value or "").strip().lower()
    if normalized_cli:
      if normalized_cli not in ALLOWED_MODEL_CATEGORIES:
          raise SystemExit("model category must be one of: none, text, multimodal, code")
      return normalized_cli

    manifest_value = str(manifest.get("modelCategory") or "").strip().lower()
    if manifest_value in ALLOWED_MODEL_CATEGORIES:
        return manifest_value

    return "none"


def check_slug(site_url: str, cookie_path: Path, slug: str) -> dict:
    payload = run_curl_json([
        "curl",
        "-sS",
        "-b",
        str(cookie_path),
        f"{site_url}/api/app-slug-check?slug={urllib.parse.quote(slug)}",
    ], "slug check failed")

    if not payload.get("success"):
        raise SystemExit(payload.get("error") or "slug check failed")

    return payload


def summarize_slug_check(slug_check: dict) -> str:
    slug = slug_check.get("slug") or ""
    if slug_check.get("exists") and not slug_check.get("canOverwrite"):
        owner_name = slug_check.get("ownerName") or "unknown user"
        return f"slug '{slug}' is owned by {owner_name} and cannot be uploaded by this account"
    if slug_check.get("exists") and slug_check.get("canOverwrite"):
        return f"slug '{slug}' already exists and will be overwritten by this account"
    return f"slug '{slug}' is available"


def upload_via_blob(site_url: str, cookie_path: Path, package_path: Path) -> dict:
    pathname = sanitize_blob_pathname(package_path.name)
    token_payload = run_curl_json([
        "curl",
        "-sS",
        "-b",
        str(cookie_path),
        "-H",
        "Content-Type: application/json",
        "-d",
        json.dumps({
            "type": "blob.generate-client-token",
            "payload": {
                "pathname": pathname,
                "clientPayload": None,
                "multipart": False,
            },
        }),
        f"{site_url}/api/upload-package-token",
    ], "failed to get Blob client token")

    client_token = str(token_payload.get("clientToken") or "").strip()
    if not client_token:
        raise SystemExit("failed to get Blob client token")

    pathname_query = urllib.parse.urlencode({"pathname": pathname})
    upload_payload = run_curl_json([
        "curl",
        "-sS",
        "-X",
        "PUT",
        "-H",
        f"authorization: Bearer {client_token}",
        "-H",
        f"x-api-version: {BLOB_API_VERSION}",
        "-H",
        "x-vercel-blob-access: public",
        "-H",
        "x-content-type: application/zip",
        "-H",
        f"x-content-length: {package_path.stat().st_size}",
        "--data-binary",
        f"@{package_path}",
        f"{BLOB_API_URL}/?{pathname_query}",
    ], "failed to upload package to Blob")

    if not upload_payload.get("url") or not upload_payload.get("pathname"):
        raise SystemExit("Blob upload did not return url/pathname")

    return upload_payload


def finalize_blob_import(site_url: str, cookie_path: Path, blob_upload: dict, model_category: str) -> dict:
    return run_curl_json([
        "curl",
        "-sS",
        "-b",
        str(cookie_path),
        "-H",
        "Content-Type: application/json",
        "-d",
        json.dumps({
            "blobUrl": blob_upload["url"],
            "blobPathname": blob_upload["pathname"],
            "modelCategory": model_category,
        }),
        f"{site_url}/api/import-app",
    ], "upload finalize failed")


def upload_direct(site_url: str, cookie_path: Path, package_path: Path, model_category: str) -> tuple[dict | None, str]:
    return try_curl_json([
        "curl",
        "-sS",
        "-b",
        str(cookie_path),
        "-F",
        f"package=@{package_path}",
        "-F",
        f"modelCategory={model_category}",
        f"{site_url}/api/import-app",
    ])


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


def save_config(path: Path, site_url: str, email: str, password: str) -> None:
    path.write_text(
        json.dumps({
            "siteUrl": site_url,
            "email": email,
            "password": password,
        }, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    os.chmod(path, 0o600)


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


def main() -> None:
    parser = argparse.ArgumentParser(description="Upload a packaged app to Nima Tech Space.")
    parser.add_argument("--site-url", help=f"Base site URL, defaults to {DEFAULT_SITE_URL}")
    parser.add_argument("--email", help="Login email")
    parser.add_argument("--password", help="Login password")
    parser.add_argument("--package", required=True, help="Path to package zip")
    parser.add_argument("--model-category", default="", help="none, text, multimodal, or code (defaults to manifest.json value when present)")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG_PATH), help="Path to reusable upload config JSON")
    parser.add_argument("--save-config", action="store_true", help="Save provided credentials back into the config file")
    parser.add_argument("--dry-run", action="store_true", help="Validate login, manifest, package size, and slug ownership without uploading")
    args = parser.parse_args()

    package_path = Path(args.package).expanduser().resolve()
    if not package_path.is_file():
        raise SystemExit(f"package not found: {package_path}")
    stage("Starting CLAWSPACE publish mode")
    done(f"Package located: {package_path}")

    config_path = Path(args.config).expanduser().resolve()
    config = load_config(config_path)

    site_url = (args.site_url or config.get("siteUrl") or "").strip()
    email = (args.email or config.get("email") or "").strip()
    keychain_service = str(config.get("keychainService") or DEFAULT_KEYCHAIN_SERVICE).strip() or DEFAULT_KEYCHAIN_SERVICE
    config_password = (config.get("password") or "").strip()
    keychain_password = ""
    if not args.password and config.get("useKeychain") and supports_keychain() and email:
        keychain_password = read_password_from_keychain(keychain_service, email)
    password = (args.password or config_password or keychain_password or "").strip()

    if not site_url or not email or not password:
        fail(
            "Missing upload credentials.\n"
            f"- Current config file: {config_path}\n"
            f"- Expected fields: siteUrl, email, password (or Keychain password)\n"
            "- Quick fix: run `python3 scripts/setup_upload_config.py`\n"
            f"- Production site: {DEFAULT_SITE_URL}"
        )

    base_url = site_url.rstrip("/")

    with tempfile.TemporaryDirectory() as temp_dir:
        cookie_path = Path(temp_dir) / "cookies.txt"

        stage("Verifying account credentials")
        login_payload = run_curl_json([
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
            f"{base_url}/api/auth/login",
        ], "login failed")
        if not login_payload.get("success"):
            fail(
                f"{login_payload.get('error') or 'login failed'}\n"
                "Please check your saved credentials or run `python3 scripts/setup_upload_config.py` again."
            )
        done(f"Logged in as: {email}")

        stage("Reading manifest and checking slug ownership")
        manifest = load_manifest_from_zip(package_path)
        slug = normalize_slug(str(manifest.get("slug") or manifest.get("id") or ""))
        if not slug:
            fail("manifest.json must contain a valid slug or id")
        resolved_model_category = resolve_model_category(args.model_category, manifest)
        done(f"Model category: {resolved_model_category}")
        slug_check = check_slug(base_url, cookie_path, slug)
        done(summarize_slug_check(slug_check))
        if slug_check.get("exists") and not slug_check.get("canOverwrite"):
            owner_name = slug_check.get("ownerName") or "unknown user"
            raise SystemExit(
                f"slug conflict: '{slug}' is already owned by {owner_name}. Change the slug before uploading."
            )

        if slug_check.get("exists") and slug_check.get("canOverwrite"):
            print(f"Notice: '{slug}' already exists and will be overwritten by this account.", file=sys.stderr)

        if args.dry_run:
            next_step("Dry run complete. If everything looks good, run the same command without --dry-run.")
            print(json.dumps({
                "success": True,
                "dryRun": True,
                "package": str(package_path),
                "packageSizeBytes": package_path.stat().st_size,
                "uploadStrategy": "blob-client-upload" if package_path.stat().st_size > DIRECT_UPLOAD_THRESHOLD_BYTES else "direct-form-upload",
                "slug": slug,
                "modelCategory": resolved_model_category,
                "slugCheck": slug_check,
                "summary": summarize_slug_check(slug_check),
            }, ensure_ascii=False, indent=2))
            return

        if package_path.stat().st_size > DIRECT_UPLOAD_THRESHOLD_BYTES:
            stage("Uploading large package via Blob")
            blob_upload = upload_via_blob(base_url, cookie_path, package_path)
            done("Blob upload finished")
            stage("Finalizing import")
            upload_payload = finalize_blob_import(base_url, cookie_path, blob_upload, resolved_model_category)
        else:
            stage("Uploading package directly")
            upload_payload, direct_error = upload_direct(base_url, cookie_path, package_path, resolved_model_category)
            if upload_payload is None:
                print(
                    "Notice: direct upload failed or returned a non-JSON response. "
                    "Falling back to Blob upload automatically.",
                    file=sys.stderr,
                )
                print(f"Direct upload detail: {direct_error}", file=sys.stderr)
                stage("Uploading fallback package via Blob")
                blob_upload = upload_via_blob(base_url, cookie_path, package_path)
                done("Blob upload finished")
                stage("Finalizing import")
                upload_payload = finalize_blob_import(base_url, cookie_path, blob_upload, resolved_model_category)
        done("Upload finished")

        if not upload_payload.get("success"):
            raise SystemExit(upload_payload.get("error") or "upload failed")

    if args.save_config:
        config_path.parent.mkdir(parents=True, exist_ok=True)
        save_config(config_path, base_url, email, password)

    app = upload_payload["app"]
    result = {
        "success": True,
        "slug": app.get("slug"),
        "detailUrl": f"{base_url}/apps/{app.get('slug')}",
        "launchUrl": f"{base_url}{app.get('launchUrl', '')}",
        "downloadUrl": f"{base_url}{app.get('downloadUrl', '')}",
        "overwritten": upload_payload.get("overwritten", False),
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print("\nUpload complete.")
    print(f"App detail page: {result['detailUrl']}")
    print(f"App launch page: {result['launchUrl']}")
    if result.get("downloadUrl"):
        print(f"App download link: {result['downloadUrl']}")
    print("\nShare summary:")
    print(f"- App: {app.get('name') or result['slug']}")
    print(f"- Detail: {result['detailUrl']}")
    print(f"- Launch: {result['launchUrl']}")
    if result.get("downloadUrl"):
        print(f"- Download: {result['downloadUrl']}")
    share_text_lines = [
        f"我刚刚发布了一个 CLAWSPACE 应用：{app.get('name') or result['slug']}",
        f"详情页：{result['detailUrl']}",
        f"体验页：{result['launchUrl']}",
    ]
    if result.get("downloadUrl"):
        share_text_lines.append(f"下载页：{result['downloadUrl']}")
    print("\nReady-to-copy share text:")
    print("\n".join(share_text_lines))


if __name__ == "__main__":
    main()
