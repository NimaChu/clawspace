#!/usr/bin/env python3
from __future__ import annotations

import argparse
import binascii
import json
import math
import re
import shutil
import struct
import zlib
from pathlib import Path

DEFAULT_OPENCLAW_APPS_DIR = Path.home() / ".openclaw" / "workspace" / "projects" / "apps"

TEMPLATES = {
    "orbit-tap": {
        "dir": "starter-mini-game",
        "default_category": "小游戏",
        "default_description": "点击移动中的星球，45 秒内拿到最高分。",
        "default_features": ["轻量、即开即玩的点击得分小游戏"],
        "default_tags": ["Game", "HTML5", "Starter"],
        "default_stack": ["HTML", "CSS", "JavaScript"],
        "default_steps": ["打开应用", "点击开始", "完成一局游戏"],
        "default_model_category": "none",
    },
    "memory-flip": {
        "dir": "starter-memory-flip",
        "default_category": "小游戏",
        "default_description": "翻开卡片配对，在最短时间内完成整局记忆挑战。",
        "default_features": ["经典翻牌配对玩法", "适合二次改造成主题小游戏"],
        "default_tags": ["Game", "Puzzle", "Memory"],
        "default_stack": ["HTML", "CSS", "JavaScript"],
        "default_steps": ["打开应用", "开始翻牌", "完成全部配对"],
        "default_model_category": "none",
    },
    "focus-timer": {
        "dir": "starter-focus-timer",
        "default_category": "工具",
        "default_description": "一个轻量专注计时器，带任务标题、番茄钟和完成记录。",
        "default_features": ["适合上传的静态效率工具", "可快速改造成主题型实用应用"],
        "default_tags": ["Utility", "Timer", "Productivity"],
        "default_stack": ["HTML", "CSS", "JavaScript"],
        "default_steps": ["输入任务标题", "开始专注", "记录完成结果"],
        "default_model_category": "none",
    },
    "ai-rewriter": {
        "dir": "starter-ai-rewriter",
        "default_category": "AI工具",
        "default_description": "输入一句草稿，调用平台模型生成更自然的表达版本。",
        "default_features": ["已接入平台统一模型接口", "适合改造成文案、灵感或对话类应用"],
        "default_tags": ["AI", "Text", "Writing"],
        "default_stack": ["HTML", "CSS", "JavaScript", "Platform LLM API"],
        "default_steps": ["输入原始文本", "点击生成", "查看润色结果"],
        "default_model_category": "text",
    },
    "ocr-tool": {
        "dir": "starter-ocr",
        "default_category": "AI工具",
        "default_description": "上传图片并调用平台多模态模型，识别文字与图像内容。",
        "default_features": ["支持 OCR 与图片内容分析", "已接入平台多模态模型接口"],
        "default_tags": ["AI", "OCR", "Vision"],
        "default_stack": ["HTML", "CSS", "JavaScript", "Platform Multimodal API"],
        "default_steps": ["上传图片", "点击开始分析", "查看识别结果"],
        "default_model_category": "multimodal",
    },
}

TEMPLATE_PALETTES = {
    "orbit-tap": {
        "primary": (108, 140, 255),
        "secondary": (67, 214, 255),
        "accent": (255, 196, 87),
        "background": (12, 18, 44),
    },
    "memory-flip": {
        "primary": (255, 110, 163),
        "secondary": (131, 112, 255),
        "accent": (255, 221, 118),
        "background": (33, 24, 69),
    },
    "focus-timer": {
        "primary": (87, 206, 166),
        "secondary": (86, 169, 255),
        "accent": (255, 209, 102),
        "background": (16, 38, 48),
    },
    "ai-rewriter": {
        "primary": (88, 122, 255),
        "secondary": (130, 83, 255),
        "accent": (118, 255, 214),
        "background": (17, 16, 52),
    },
    "ocr-tool": {
        "primary": (83, 156, 255),
        "secondary": (76, 225, 189),
        "accent": (255, 210, 92),
        "background": (15, 22, 45),
    },
}

COVER_VARIANT_COUNT = 5


def slugify(value: str) -> str:
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9-]+", "-", value.strip().lower().replace("_", "-").replace(" ", "-")))


def stable_string_hash(value: str) -> int:
    total = 0
    for index, char in enumerate(value):
        total = (total * 131 + ord(char) + index) & 0xFFFFFFFF
    return total


def choose_cover_variant(template_name: str, slug: str, motif: str) -> int:
    key = f"{template_name}:{slug}:{motif}"
    return stable_string_hash(key) % COVER_VARIANT_COUNT


def vary_palette(
    palette: dict[str, tuple[int, int, int]],
    variant: int,
) -> dict[str, tuple[int, int, int]]:
    if variant == 0:
        return dict(palette)
    strength = ((variant % COVER_VARIANT_COUNT) - 2) * 0.08
    white = (250, 252, 255)
    black = (8, 12, 24)
    overlay = white if strength > 0 else black
    factor = abs(strength)
    return {
        key: _blend(color, overlay, factor)
        for key, color in palette.items()
    }


def replace_in_file(path: Path, replacements: dict[str, str]) -> None:
    content = path.read_text(encoding="utf-8")
    for source, target in replacements.items():
        content = content.replace(source, target)
    path.write_text(content, encoding="utf-8")


def _blend(a: tuple[int, int, int], b: tuple[int, int, int], factor: float) -> tuple[int, int, int]:
    clamped = max(0.0, min(1.0, factor))
    return tuple(int(a[index] + (b[index] - a[index]) * clamped) for index in range(3))


def _clamp(value: int) -> int:
    return max(0, min(255, value))


def _rgba(color: tuple[int, int, int], alpha: int = 255) -> bytes:
    return bytes((_clamp(color[0]), _clamp(color[1]), _clamp(color[2]), _clamp(alpha)))


def _mix(base: tuple[int, int, int], overlay: tuple[int, int, int], strength: float) -> tuple[int, int, int]:
    return _blend(base, overlay, max(0.0, min(1.0, strength)))


def _rect(x: int, y: int, left: float, top: float, right: float, bottom: float) -> bool:
    return left <= x <= right and top <= y <= bottom


def _circle(x: int, y: int, cx: float, cy: float, radius: float) -> bool:
    dx = x - cx
    dy = y - cy
    return dx * dx + dy * dy <= radius * radius


def _ellipse(x: int, y: int, cx: float, cy: float, rx: float, ry: float) -> bool:
    if rx == 0 or ry == 0:
        return False
    dx = (x - cx) / rx
    dy = (y - cy) / ry
    return dx * dx + dy * dy <= 1.0


def _ring(x: int, y: int, cx: float, cy: float, radius: float, thickness: float) -> bool:
    distance = math.hypot(x - cx, y - cy)
    return radius - thickness <= distance <= radius + thickness


def _distance_to_segment(x: int, y: int, ax: float, ay: float, bx: float, by: float) -> float:
    abx = bx - ax
    aby = by - ay
    apx = x - ax
    apy = y - ay
    ab2 = abx * abx + aby * aby
    if ab2 == 0:
        return math.hypot(x - ax, y - ay)
    t = max(0.0, min(1.0, (apx * abx + apy * aby) / ab2))
    closest_x = ax + abx * t
    closest_y = ay + aby * t
    return math.hypot(x - closest_x, y - closest_y)


def infer_art_direction(template_name: str, slug: str) -> str:
    slug_text = slug.lower()
    template_text = template_name.lower()
    keyword_map = [
        ("ocr", "ocr"),
        ("scan", "ocr"),
        ("tetris", "tetris"),
        ("quest", "pixel-rpg"),
        ("pixel", "pixel-rpg"),
        ("murder", "mystery"),
        ("detective", "mystery"),
        ("factory", "factory"),
        ("heist", "space-heist"),
        ("orbit", "space-heist"),
        ("comeback", "chat"),
        ("chat", "chat"),
        ("rewriter", "ai"),
        ("focus", "timer"),
        ("timer", "timer"),
        ("memory", "cards"),
        ("flip", "cards"),
    ]
    for keyword, motif in keyword_map:
        if keyword in slug_text:
            return motif

    template_map = {
        "orbit-tap": "space-heist",
        "memory-flip": "cards",
        "focus-timer": "timer",
        "ai-rewriter": "ai",
        "ocr-tool": "ocr",
    }
    for keyword, motif in keyword_map:
        if keyword in template_text:
            return motif
    return template_map.get(template_name, "generic")


def _png_chunk(chunk_type: bytes, data: bytes) -> bytes:
    crc = binascii.crc32(chunk_type + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", crc)


def write_png(path: Path, width: int, height: int, pixel_at) -> None:
    rows = []
    for y in range(height):
        row = bytearray(b"\x00")
        for x in range(width):
            row.extend(pixel_at(x, y))
        rows.append(bytes(row))

    compressed = zlib.compress(b"".join(rows), level=9)
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png = b"".join(
        [
            b"\x89PNG\r\n\x1a\n",
            _png_chunk(b"IHDR", ihdr),
            _png_chunk(b"IDAT", compressed),
            _png_chunk(b"IEND", b""),
        ]
    )
    path.write_bytes(png)


def create_thumbnail_png(path: Path, palette: dict[str, tuple[int, int, int]], motif: str, variant: int = 0) -> None:
    width, height = 1024, 576
    background = palette["background"]
    primary = palette["primary"]
    secondary = palette["secondary"]
    accent = palette["accent"]
    white = (250, 252, 255)
    lobster_shell = (255, 111, 83)
    lobster_cream = (255, 236, 222)
    lobster_gold = (255, 198, 103)

    orbit_shift = (variant - 2) * width * 0.035
    vertical_shift = (variant - 2) * height * 0.018
    ring_shift = (variant - 2) * width * 0.01

    def pixel_at(x: int, y: int) -> bytes:
        vertical = y / max(1, height - 1)
        horizontal = x / max(1, width - 1)
        base = _blend(background, primary, vertical * 0.42)
        base = _blend(base, secondary, horizontal * 0.24)

        dx1 = x - (width * 0.28 + orbit_shift)
        dy1 = y - (height * 0.34 + vertical_shift)
        d1 = (dx1 * dx1 + dy1 * dy1) ** 0.5
        glow1 = max(0.0, 1.0 - d1 / (width * 0.22))
        if glow1 > 0:
            base = _blend(base, accent, glow1 * 0.72)

        dx2 = x - (width * 0.78 - orbit_shift * 0.55)
        dy2 = y - (height * 0.72 - vertical_shift * 0.7)
        d2 = (dx2 * dx2 + dy2 * dy2) ** 0.5
        glow2 = max(0.0, 1.0 - d2 / (width * 0.18))
        if glow2 > 0:
            base = _blend(base, white, glow2 * 0.38)

        if motif == "space-heist":
            if _ring(x, y, width * 0.55, height * 0.58, width * 0.21 + ring_shift, 3.0):
                base = _mix(base, white, 0.75)
            if _circle(x, y, width * 0.28 + orbit_shift, height * 0.34 + vertical_shift, width * 0.075):
                glow = max(0.0, 1.0 - math.hypot(x - (width * 0.28 + orbit_shift), y - (height * 0.34 + vertical_shift)) / (width * 0.075))
                base = _mix(_blend(accent, white, 0.5), white, glow * 0.25)
            if _circle(x, y, width * 0.68 - orbit_shift * 0.5, height * 0.49 - vertical_shift * 0.4, width * 0.09):
                distance = math.hypot(x - (width * 0.68 - orbit_shift * 0.5), y - (height * 0.49 - vertical_shift * 0.4))
                shade = 1.0 - distance / (width * 0.09)
                base = _mix(_blend(primary, secondary, 0.45), white, shade * 0.22)
            if _distance_to_segment(x, y, width * 0.48, height * 0.67, width * 0.58, height * 0.62) < 7 or _distance_to_segment(x, y, width * 0.58, height * 0.62, width * 0.55, height * 0.72) < 7:
                base = _mix(base, accent, 0.82)
        elif motif == "cards":
            cards = [
                (width * 0.22 + orbit_shift * 0.35, height * 0.22, width * 0.42 + orbit_shift * 0.35, height * 0.56, primary),
                (width * 0.40, height * 0.28 + vertical_shift * 0.6, width * 0.60, height * 0.62 + vertical_shift * 0.6, secondary),
                (width * 0.58 - orbit_shift * 0.35, height * 0.22, width * 0.78 - orbit_shift * 0.35, height * 0.56, accent),
            ]
            for left, top, right, bottom, color in cards:
                if _rect(x, y, left, top, right, bottom):
                    inset = min(x - left, right - x, y - top, bottom - y)
                    base = _mix(color, white, max(0.0, min(1.0, inset / 28)) * 0.18)
                elif _rect(x, y, left - 4, top - 4, right + 4, bottom + 4):
                    base = _mix(base, white, 0.25)
        elif motif == "timer":
            if _ring(x, y, width * 0.5, height * 0.48, width * 0.15 + ring_shift * 0.5, 12):
                base = _mix(base, white, 0.72)
            if _distance_to_segment(x, y, width * 0.5, height * 0.48, width * 0.5, height * 0.37) < 8:
                base = _mix(base, accent, 0.85)
            if _distance_to_segment(x, y, width * 0.5, height * 0.48, width * 0.59, height * 0.53) < 8:
                base = _mix(base, secondary, 0.88)
            if _rect(x, y, width * 0.34, height * 0.7, width * 0.66, height * 0.77):
                base = _mix(_blend(primary, secondary, horizontal), white, 0.16)
        elif motif == "ai":
            for ax, ay, bx, by in [
                (width * 0.32, height * 0.32, width * 0.62, height * 0.26),
                (width * 0.62, height * 0.26, width * 0.72, height * 0.56),
                (width * 0.32, height * 0.32, width * 0.42, height * 0.62),
                (width * 0.42, height * 0.62, width * 0.72, height * 0.56),
            ]:
                if _distance_to_segment(x, y, ax, ay, bx, by) < 5:
                    base = _mix(base, white, 0.55)
            for cx, cy, color in [
                (width * 0.32, height * 0.32, primary),
                (width * 0.62, height * 0.26, secondary),
                (width * 0.72, height * 0.56, accent),
                (width * 0.42, height * 0.62, white),
            ]:
                if _circle(x, y, cx, cy, 24):
                    base = _mix(color, white, 0.16)
        elif motif == "ocr":
            if _rect(x, y, width * 0.27 + orbit_shift * 0.2, height * 0.18, width * 0.73 + orbit_shift * 0.2, height * 0.78):
                base = _mix((242, 246, 255), white, 0.15)
            if _rect(x, y, width * 0.31, height * 0.28, width * 0.69, height * 0.31) or _rect(x, y, width * 0.31, height * 0.39, width * 0.63, height * 0.42):
                base = _mix(base, primary, 0.65)
            if _ring(x, y, width * 0.5, height * 0.52, width * 0.2, 4):
                base = _mix(base, accent, 0.82)
            if _rect(x, y, width * 0.34, height * 0.36, width * 0.66, height * 0.68):
                border = abs(x - width * 0.34) < 4 or abs(x - width * 0.66) < 4 or abs(y - height * 0.36) < 4 or abs(y - height * 0.68) < 4
                if border:
                    base = _mix(base, accent, 0.85)
            if _rect(x, y, width * 0.36, height * 0.5, width * 0.64, height * 0.515):
                base = _mix(base, secondary, 0.9)
        elif motif == "tetris":
            for left, top, right, bottom, color in [
                (width * 0.26, height * 0.26, width * 0.36, height * 0.36, primary),
                (width * 0.36, height * 0.26, width * 0.46, height * 0.36, primary),
                (width * 0.46, height * 0.26, width * 0.56, height * 0.36, primary),
                (width * 0.46, height * 0.36, width * 0.56, height * 0.46, primary),
                (width * 0.60, height * 0.42, width * 0.70, height * 0.52, accent),
                (width * 0.70, height * 0.42, width * 0.80, height * 0.52, accent),
                (width * 0.60, height * 0.52, width * 0.70, height * 0.62, accent),
                (width * 0.70, height * 0.52, width * 0.80, height * 0.62, accent),
            ]:
                if _rect(x, y, left, top, right, bottom):
                    base = _mix(color, white, 0.14)
                elif _rect(x, y, left - 3, top - 3, right + 3, bottom + 3):
                    base = _mix(base, white, 0.28)
        elif motif == "chat":
            if _rect(x, y, width * 0.20, height * 0.26, width * 0.56, height * 0.52):
                base = _mix(primary, white, 0.2)
            if _rect(x, y, width * 0.44, height * 0.40, width * 0.78, height * 0.66):
                base = _mix(secondary, white, 0.18)
            if _distance_to_segment(x, y, width * 0.38, height * 0.52, width * 0.31, height * 0.60) < 8 or _distance_to_segment(x, y, width * 0.64, height * 0.66, width * 0.71, height * 0.74) < 8:
                base = _mix(base, accent, 0.7)
            if _rect(x, y, width * 0.26, height * 0.34, width * 0.48, height * 0.355) or _rect(x, y, width * 0.50, height * 0.48, width * 0.70, height * 0.495):
                base = _mix(base, white, 0.78)
        elif motif == "factory":
            if _rect(x, y, width * 0.14, height * 0.62, width * 0.86, height * 0.72):
                base = _mix(_blend(primary, secondary, horizontal), white, 0.16)
            for left in [0.20, 0.38, 0.56]:
                if _rect(x, y, width * left, height * 0.44, width * (left + 0.12), height * 0.58):
                    base = _mix(accent, white, 0.12)
                elif _rect(x, y, width * left - 4, height * 0.44 - 4, width * (left + 0.12) + 4, height * 0.58 + 4):
                    base = _mix(base, white, 0.3)
            if _ring(x, y, width * 0.76, height * 0.36, width * 0.08, 8):
                base = _mix(base, white, 0.7)
            if _distance_to_segment(x, y, width * 0.76, height * 0.36, width * 0.76, height * 0.56) < 8:
                base = _mix(base, white, 0.65)
            if _ellipse(x, y, width * 0.26, height * 0.50, width * 0.09, height * 0.13):
                base = _mix(base, lobster_shell, 0.92)
            if _ellipse(x, y, width * 0.26, height * 0.41, width * 0.065, height * 0.08):
                base = _mix(base, lobster_shell, 0.98)
            if _distance_to_segment(x, y, width * 0.23, height * 0.34, width * 0.21, height * 0.23) < 6 or _distance_to_segment(x, y, width * 0.29, height * 0.34, width * 0.31, height * 0.23) < 6:
                base = _mix(base, lobster_cream, 0.85)
            if _circle(x, y, width * 0.21, height * 0.23, 11) or _circle(x, y, width * 0.31, height * 0.23, 11):
                base = _mix(base, lobster_cream, 0.92)
            if _ellipse(x, y, width * 0.18, height * 0.49, width * 0.05, height * 0.035) or _ellipse(x, y, width * 0.34, height * 0.49, width * 0.05, height * 0.035):
                base = _mix(base, lobster_gold, 0.84)
            if _rect(x, y, width * 0.20, height * 0.39, width * 0.32, height * 0.43):
                base = _mix(base, white, 0.55)
        elif motif == "mystery":
            if _rect(x, y, width * 0.26, height * 0.30, width * 0.68, height * 0.62):
                base = _mix(primary, white, 0.1)
            if _circle(x, y, width * 0.58, height * 0.44, width * 0.1) and not _circle(x, y, width * 0.58, height * 0.44, width * 0.065):
                base = _mix(accent, white, 0.12)
            if _distance_to_segment(x, y, width * 0.65, height * 0.52, width * 0.75, height * 0.64) < 9:
                base = _mix(base, accent, 0.78)
            if _rect(x, y, width * 0.32, height * 0.38, width * 0.60, height * 0.395) or _rect(x, y, width * 0.32, height * 0.48, width * 0.55, height * 0.495):
                base = _mix(base, white, 0.72)
        elif motif == "pixel-rpg":
            tile = 26
            gx = int((x - width * 0.26) // tile)
            gy = int((y - height * 0.24) // tile)
            if _rect(x, y, width * 0.22, height * 0.20, width * 0.78, height * 0.76):
                checker = (gx + gy) % 2
                base = _mix(base, _blend(primary, secondary, checker * 0.35), 0.28)
            if _distance_to_segment(x, y, width * 0.36, height * 0.64, width * 0.58, height * 0.38) < 9:
                base = _mix(base, white, 0.8)
            if _distance_to_segment(x, y, width * 0.55, height * 0.41, width * 0.63, height * 0.33) < 10:
                base = _mix(base, accent, 0.84)
            if _circle(x, y, width * 0.67, height * 0.58, 30):
                base = _mix(base, accent, 0.82)
            px = 30
            lobster_blocks = [
                (11, 11, 3, 2, lobster_shell),
                (10, 9, 5, 2, lobster_shell),
                (9, 7, 2, 2, lobster_shell),
                (14, 7, 2, 2, lobster_shell),
                (10, 13, 1, 2, lobster_gold),
                (13, 13, 1, 2, lobster_gold),
                (11, 8, 1, 1, white),
                (14, 8, 1, 1, white),
            ]
            origin_x = width * 0.30
            origin_y = height * 0.12
            for gx0, gy0, gw, gh, color in lobster_blocks:
                left = origin_x + gx0 * px
                top = origin_y + gy0 * px
                right = left + gw * px
                bottom = top + gh * px
                if _rect(x, y, left, top, right, bottom):
                    base = _mix(base, color, 0.95)
        else:
            if _ring(x, y, width * 0.5, height * 0.52, width * 0.18, 5):
                base = _mix(base, white, 0.7)
            if _circle(x, y, width * 0.5, height * 0.52, width * 0.08):
                base = _mix(accent, white, 0.2)

        if motif == "space-heist":
            if _ellipse(x, y, width * 0.32, height * 0.63, width * 0.11, height * 0.15):
                base = _mix(base, lobster_shell, 0.92)
            if _ellipse(x, y, width * 0.32, height * 0.49, width * 0.09, height * 0.10):
                base = _mix(base, lobster_shell, 0.96)
            if _ellipse(x, y, width * 0.32, height * 0.49, width * 0.11, height * 0.12) and not _ellipse(x, y, width * 0.32, height * 0.49, width * 0.08, height * 0.09):
                base = _mix(base, white, 0.78)
            if _distance_to_segment(x, y, width * 0.28, height * 0.40, width * 0.25, height * 0.29) < 7 or _distance_to_segment(x, y, width * 0.36, height * 0.40, width * 0.39, height * 0.29) < 7:
                base = _mix(base, lobster_cream, 0.85)
            if _circle(x, y, width * 0.25, height * 0.29, 13) or _circle(x, y, width * 0.39, height * 0.29, 13):
                base = _mix(base, lobster_cream, 0.92)
            if _ellipse(x, y, width * 0.20, height * 0.64, width * 0.06, height * 0.04) or _ellipse(x, y, width * 0.44, height * 0.64, width * 0.06, height * 0.04):
                base = _mix(base, lobster_gold, 0.82)
            if _rect(x, y, width * 0.26, height * 0.47, width * 0.38, height * 0.50):
                base = _mix(base, white, 0.58)
        elif motif == "tetris":
            if _ellipse(x, y, width * 0.26, height * 0.54, width * 0.085, height * 0.12):
                base = _mix(base, lobster_shell, 0.94)
            if _ellipse(x, y, width * 0.26, height * 0.43, width * 0.06, height * 0.075):
                base = _mix(base, lobster_shell, 0.98)
            if _distance_to_segment(x, y, width * 0.23, height * 0.37, width * 0.21, height * 0.28) < 6 or _distance_to_segment(x, y, width * 0.29, height * 0.37, width * 0.31, height * 0.28) < 6:
                base = _mix(base, lobster_cream, 0.82)
            if _circle(x, y, width * 0.21, height * 0.28, 10) or _circle(x, y, width * 0.31, height * 0.28, 10):
                base = _mix(base, lobster_cream, 0.9)
            if _distance_to_segment(x, y, width * 0.34, height * 0.52, width * 0.48, height * 0.40) < 10 or _distance_to_segment(x, y, width * 0.48, height * 0.40, width * 0.56, height * 0.45) < 10:
                base = _mix(base, lobster_gold, 0.9)

        return _rgba(base)

    write_png(path, width, height, pixel_at)


def create_icon_png(path: Path, palette: dict[str, tuple[int, int, int]], motif: str, variant: int = 0) -> None:
    size = 384
    background = palette["background"]
    primary = palette["primary"]
    secondary = palette["secondary"]
    accent = palette["accent"]
    white = (250, 252, 255)
    lobster_shell = (255, 111, 83)
    lobster_cream = (255, 236, 222)
    lobster_gold = (255, 198, 103)

    orbit_shift = (variant - 2) * size * 0.026
    ring_shift = (variant - 2) * size * 0.008

    def pixel_at(x: int, y: int) -> bytes:
        horizontal = x / max(1, size - 1)
        vertical = y / max(1, size - 1)
        base = _blend(background, primary, vertical * 0.44)
        base = _blend(base, secondary, horizontal * 0.22)

        center_x = size * 0.5
        center_y = size * 0.5
        dx = x - center_x
        dy = y - center_y
        distance = (dx * dx + dy * dy) ** 0.5

        if motif == "space-heist":
            if _ring(x, y, center_x, center_y, size * 0.26 + ring_shift, 8):
                base = _mix(base, white, 0.68)
            if _circle(x, y, size * 0.36 + orbit_shift, size * 0.36, size * 0.08):
                base = _mix(accent, white, 0.22)
            if _distance_to_segment(x, y, size * 0.48, size * 0.64, size * 0.62, size * 0.54) < 9 or _distance_to_segment(x, y, size * 0.62, size * 0.54, size * 0.59, size * 0.68) < 9:
                base = _mix(base, accent, 0.86)
        elif motif == "cards":
            for left, top, right, bottom, color in [
                (size * 0.18 + orbit_shift * 0.45, size * 0.18, size * 0.42 + orbit_shift * 0.45, size * 0.54, primary),
                (size * 0.36, size * 0.24, size * 0.60, size * 0.60, secondary),
                (size * 0.54 - orbit_shift * 0.45, size * 0.18, size * 0.78 - orbit_shift * 0.45, size * 0.54, accent),
            ]:
                if _rect(x, y, left, top, right, bottom):
                    base = _mix(color, white, 0.16)
        elif motif == "timer":
            if _ring(x, y, center_x, center_y, size * 0.18, 10):
                base = _mix(base, white, 0.74)
            if _distance_to_segment(x, y, center_x, center_y, center_x, size * 0.28) < 8 or _distance_to_segment(x, y, center_x, center_y, size * 0.63, size * 0.56) < 8:
                base = _mix(base, accent, 0.84)
        elif motif == "ai":
            for ax, ay, bx, by in [
                (size * 0.28, size * 0.34, size * 0.56, size * 0.26),
                (size * 0.56, size * 0.26, size * 0.72, size * 0.52),
                (size * 0.28, size * 0.34, size * 0.42, size * 0.66),
            ]:
                if _distance_to_segment(x, y, ax, ay, bx, by) < 6:
                    base = _mix(base, white, 0.62)
            for cx, cy, color in [
                (size * 0.28, size * 0.34, primary),
                (size * 0.56, size * 0.26, secondary),
                (size * 0.72, size * 0.52, accent),
                (size * 0.42, size * 0.66, white),
            ]:
                if _circle(x, y, cx, cy, 20):
                    base = _mix(color, white, 0.14)
        elif motif == "ocr":
            if _rect(x, y, size * 0.22, size * 0.16, size * 0.78, size * 0.82):
                base = _mix((242, 246, 255), white, 0.15)
            if _rect(x, y, size * 0.30, size * 0.30, size * 0.70, size * 0.32):
                base = _mix(base, primary, 0.8)
            if _rect(x, y, size * 0.32, size * 0.42, size * 0.68, size * 0.66):
                border = min(abs(x - size * 0.32), abs(x - size * 0.68), abs(y - size * 0.42), abs(y - size * 0.66)) < 5
                if border:
                    base = _mix(base, accent, 0.86)
            if _rect(x, y, size * 0.35, size * 0.53, size * 0.65, size * 0.545):
                base = _mix(base, secondary, 0.88)
        elif motif == "tetris":
            for left, top, right, bottom, color in [
                (size * 0.22, size * 0.22, size * 0.38, size * 0.38, primary),
                (size * 0.38, size * 0.22, size * 0.54, size * 0.38, primary),
                (size * 0.54, size * 0.22, size * 0.70, size * 0.38, primary),
                (size * 0.54, size * 0.38, size * 0.70, size * 0.54, primary),
            ]:
                if _rect(x, y, left, top, right, bottom):
                    base = _mix(color, white, 0.14)
        elif motif == "chat":
            if _rect(x, y, size * 0.18, size * 0.24, size * 0.56, size * 0.50):
                base = _mix(primary, white, 0.18)
            if _rect(x, y, size * 0.42, size * 0.42, size * 0.80, size * 0.68):
                base = _mix(secondary, white, 0.16)
        elif motif == "factory":
            if _rect(x, y, size * 0.16, size * 0.64, size * 0.84, size * 0.74):
                base = _mix(primary, white, 0.18)
            if _rect(x, y, size * 0.24, size * 0.38, size * 0.42, size * 0.56) or _rect(x, y, size * 0.46, size * 0.38, size * 0.64, size * 0.56):
                base = _mix(accent, white, 0.14)
            if _ring(x, y, size * 0.74, size * 0.30, size * 0.08, 8):
                base = _mix(base, white, 0.7)
            if _ellipse(x, y, size * 0.26, size * 0.54, size * 0.09, size * 0.13):
                base = _mix(base, lobster_shell, 0.94)
            if _ellipse(x, y, size * 0.26, size * 0.42, size * 0.07, size * 0.08):
                base = _mix(base, lobster_shell, 0.98)
            if _circle(x, y, size * 0.22, size * 0.27, 12) or _circle(x, y, size * 0.30, size * 0.27, 12):
                base = _mix(base, lobster_cream, 0.92)
            if _ellipse(x, y, size * 0.18, size * 0.53, size * 0.05, size * 0.03) or _ellipse(x, y, size * 0.34, size * 0.53, size * 0.05, size * 0.03):
                base = _mix(base, lobster_gold, 0.84)
        elif motif == "mystery":
            if _circle(x, y, size * 0.50, size * 0.42, size * 0.14) and not _circle(x, y, size * 0.50, size * 0.42, size * 0.09):
                base = _mix(accent, white, 0.18)
            if _distance_to_segment(x, y, size * 0.58, size * 0.52, size * 0.72, size * 0.66) < 9:
                base = _mix(base, accent, 0.84)
        elif motif == "pixel-rpg":
            if _distance_to_segment(x, y, size * 0.28, size * 0.70, size * 0.58, size * 0.34) < 10:
                base = _mix(base, white, 0.8)
            if _distance_to_segment(x, y, size * 0.54, size * 0.38, size * 0.66, size * 0.26) < 12:
                base = _mix(base, accent, 0.84)
            if _circle(x, y, size * 0.72, size * 0.62, 24):
                base = _mix(base, accent, 0.82)
            px = 16
            blocks = [
                (7, 8, 2, 2, lobster_shell),
                (6, 6, 4, 2, lobster_shell),
                (5, 5, 1, 1, lobster_gold),
                (10, 5, 1, 1, lobster_gold),
                (7, 5, 1, 1, white),
                (9, 5, 1, 1, white),
            ]
            ox = size * 0.18
            oy = size * 0.18
            for gx0, gy0, gw, gh, color in blocks:
                left = ox + gx0 * px
                top = oy + gy0 * px
                right = left + gw * px
                bottom = top + gh * px
                if _rect(x, y, left, top, right, bottom):
                    base = _mix(base, color, 0.95)
        else:
            core_radius = size * 0.22
            if distance < core_radius:
                base = _blend(accent, white, max(0.0, 1.0 - distance / core_radius) * 0.35)
            ring_distance = abs(distance - size * 0.32)
            if ring_distance < 6:
                base = _blend(base, white, 0.62)
            elif ring_distance < 12:
                base = _blend(base, secondary, 0.35)

        if motif == "space-heist":
            if _ellipse(x, y, size * 0.34, size * 0.58, size * 0.11, size * 0.14):
                base = _mix(base, lobster_shell, 0.94)
            if _ellipse(x, y, size * 0.34, size * 0.44, size * 0.08, size * 0.09):
                base = _mix(base, lobster_shell, 0.98)
            if _ellipse(x, y, size * 0.34, size * 0.44, size * 0.10, size * 0.11) and not _ellipse(x, y, size * 0.34, size * 0.44, size * 0.07, size * 0.08):
                base = _mix(base, white, 0.74)
            if _circle(x, y, size * 0.28, size * 0.28, 11) or _circle(x, y, size * 0.40, size * 0.28, 11):
                base = _mix(base, lobster_cream, 0.9)
            if _ellipse(x, y, size * 0.22, size * 0.58, size * 0.05, size * 0.03) or _ellipse(x, y, size * 0.46, size * 0.58, size * 0.05, size * 0.03):
                base = _mix(base, lobster_gold, 0.82)
        elif motif == "tetris":
            if _ellipse(x, y, size * 0.28, size * 0.58, size * 0.085, size * 0.12):
                base = _mix(base, lobster_shell, 0.94)
            if _ellipse(x, y, size * 0.28, size * 0.46, size * 0.06, size * 0.07):
                base = _mix(base, lobster_shell, 0.98)
            if _circle(x, y, size * 0.23, size * 0.33, 10) or _circle(x, y, size * 0.33, size * 0.33, 10):
                base = _mix(base, lobster_cream, 0.9)
            if _distance_to_segment(x, y, size * 0.38, size * 0.54, size * 0.56, size * 0.42) < 8:
                base = _mix(base, lobster_gold, 0.9)

        return _rgba(base)

    write_png(path, size, size, pixel_at)


def create_default_assets(assets_dir: Path, template_name: str, slug: str = "") -> tuple[str, str]:
    from cover_engine import create_default_assets as build_default_assets

    return build_default_assets(assets_dir, template_name, slug)


def resolve_output_dir(out_arg: str | None, slug: str) -> Path:
    if out_arg:
        return Path(out_arg).expanduser().resolve()
    return (DEFAULT_OPENCLAW_APPS_DIR / slug).resolve()


def main() -> None:
    parser = argparse.ArgumentParser(description="Scaffold a starter static mini-game for Nima Tech Space.")
    parser.add_argument(
        "--out",
        help=f"Output project directory. Defaults to {DEFAULT_OPENCLAW_APPS_DIR}/<slug>",
    )
    parser.add_argument("--name", required=True, help="App name")
    parser.add_argument("--slug", help="App slug, defaults to slugified name")
    parser.add_argument("--description", required=True, help="One-line app description")
    parser.add_argument("--author", default="Your Name", help="Author name")
    parser.add_argument("--category", help="Category label")
    parser.add_argument("--template", choices=sorted(TEMPLATES.keys()), default="orbit-tap", help="Starter template")
    args = parser.parse_args()

    skill_dir = Path(__file__).resolve().parents[1]
    template = TEMPLATES[args.template]
    template_dir = skill_dir / "assets" / template["dir"]
    manifest_template_path = skill_dir / "assets" / "manifest.example.json"
    readme_template_path = skill_dir / "assets" / "README.template.md"
    game_storage_helper_path = skill_dir / "assets" / "clawspace-game-storage.js"

    slug = slugify(args.slug or args.name)
    out_dir = resolve_output_dir(args.out, slug)
    app_dir = out_dir / "app"
    assets_dir = out_dir / "assets"

    out_dir.mkdir(parents=True, exist_ok=True)
    if any(out_dir.iterdir()):
      raise SystemExit(f"output directory is not empty: {out_dir}")

    shutil.copytree(template_dir, app_dir)
    helper_target_dir = app_dir / "lib"
    helper_target_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(game_storage_helper_path, helper_target_dir / "clawspace-game-storage.js")
    assets_dir.mkdir(parents=True, exist_ok=True)
    thumbnail_asset, icon_asset = create_default_assets(assets_dir, args.template, slug)

    replacements = {
        "__APP_NAME__": args.name,
        "__APP_DESCRIPTION__": args.description,
        "__APP_SLUG__": slug,
    }

    for path in app_dir.rglob("*"):
        if path.is_file() and path.suffix.lower() in {".html", ".css", ".js", ".json", ".md"}:
            replace_in_file(path, replacements)

    manifest = json.loads(manifest_template_path.read_text(encoding="utf-8"))
    manifest.update({
        "id": slug,
        "slug": slug,
        "name": args.name,
        "description": args.description,
        "category": args.category or template["default_category"],
        "author": {
            "name": args.author,
            "url": "",
        },
        "links": {
            "github": "",
            "homepage": "",
        },
        "thumbnail": thumbnail_asset,
        "icon": icon_asset,
        "screenshots": [],
        "features": template["default_features"],
        "tags": template["default_tags"],
        "techStack": template["default_stack"],
        "usageSteps": template["default_steps"],
        "modelCategory": template["default_model_category"],
    })

    (out_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    readme = readme_template_path.read_text(encoding="utf-8")
    readme = readme.replace("{{APP_NAME}}", args.name)
    readme = readme.replace("{{ONE_LINE_DESCRIPTION}}", args.description)
    readme = readme.replace("{{TEMPLATE_NAME}}", args.template)
    (out_dir / "README.md").write_text(readme, encoding="utf-8")

    print(f"Scaffolded project: {out_dir}")
    print(f"Package slug: {slug}")
    print(f"Starter template: {args.template}")
    if not args.out:
        print(f"Default OpenClaw apps directory: {DEFAULT_OPENCLAW_APPS_DIR}")
    print("Generated default cover assets: assets/thumbnail.png and assets/icon.png")
    print("You can replace them with custom PNG/JPG/WebP artwork later for a stronger store listing.")
    print("Reusable local score storage helper added at: app/lib/clawspace-game-storage.js")
    print("Next step: build or customize the app under app/, then package it with build_nima_package.py")


if __name__ == "__main__":
    main()
