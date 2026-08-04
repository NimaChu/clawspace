#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
from pathlib import Path


def note(level: str, message: str) -> None:
    print(f"[{level}] {message}")


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError as exc:
        raise SystemExit(f"file not found: {path}") from exc


def has_any(text: str, patterns: list[str]) -> bool:
    lowered = text.lower()
    return any(pattern.lower() in lowered for pattern in patterns)


def main() -> None:
    parser = argparse.ArgumentParser(description="Check whether a CLAWSPACE game exposes key platform/game readiness features.")
    parser.add_argument("--html", required=True, help="Path to the main HTML file")
    parser.add_argument("--js", required=True, help="Path to the main JS file")
    parser.add_argument("--css", help="Optional path to main CSS file")
    args = parser.parse_args()

    html_path = Path(args.html).expanduser().resolve()
    js_path = Path(args.js).expanduser().resolve()
    css_path = Path(args.css).expanduser().resolve() if args.css else None

    html = read_text(html_path)
    js = read_text(js_path)
    css = read_text(css_path) if css_path else ""
    combined = "\n".join([html, js, css])

    note("stage", "Game readiness check started")

    if has_any(html, ["best-score", "最高分", "本地最高", "账号最高"]):
        note("done", "best-score display detected")
    else:
        note("warning", "no clear local/account best-score display found")

    if has_any(html, ["global-best-score", "全站最高"]) or has_any(js, ["/api/game-scores", "globalBest"]):
        note("done", "platform/global-best score wiring detected")
    else:
        note("warning", "no platform/global-best score display detected")

    if has_any(js, ["/api/game-scores", "fetchRemoteSummary", "syncBestScore"]):
        note("done", "platform score API usage detected")
    else:
        note("warning", "game does not appear to call /api/game-scores")

    if has_any(combined, ["touchstart", "pointerdown", "pointerup", "click"]):
        note("done", "touch or pointer interaction detected")
    else:
        note("warning", "no obvious touch or pointer interaction found")

    if has_any(combined, ["game over", "结束", "失败", "再来一次", "restart", "reset"]):
        note("done", "end-state or replay flow detected")
    else:
        note("warning", "no clear end-state or replay flow detected")

    if has_any(combined, ["score", "得分", "combo", "连击"]):
        note("done", "score or gameplay feedback detected")
    else:
        note("warning", "no obvious gameplay feedback detected")

    if 'name="viewport"' in html.lower():
        note("done", "viewport meta tag detected")
    else:
        note("warning", "viewport meta tag missing")

    if re.search(r"(100dvh|100vh|min-height:\s*100vh|min-height:\s*100dvh)", css.lower()):
        note("done", "mobile-height baseline detected")
    else:
        note("warning", "no obvious viewport-height baseline found for mobile layouts")

    if has_any(js, ["render_game_to_text", "advanceTime"]):
        note("done", "testing hooks detected")
    else:
        note("warning", "testing hooks missing: consider window.render_game_to_text and window.advanceTime(ms)")

    note("next", "Use this check alongside package diagnosis before shipping a score-driven game.")


if __name__ == "__main__":
    main()
