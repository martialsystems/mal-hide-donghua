#!/usr/bin/env python3
"""Write 16 / 48 / 128 PNG icons: dark tile, cream poster, gold slash."""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "icons"
BG = (22, 48, 40, 255)
CREAM = (243, 234, 211, 255)
GOLD = (196, 163, 90, 255)
CLEAR = (0, 0, 0, 0)


def png_rgba(width: int, height: int, pixels: list[tuple[int, int, int, int]]) -> bytes:
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        for x in range(width):
            raw.extend(pixels[y * width + x])

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    return b"".join(
        [
            b"\x89PNG\r\n\x1a\n",
            chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)),
            chunk(b"IDAT", zlib.compress(bytes(raw), 9)),
            chunk(b"IEND", b""),
        ]
    )


def fill_rect(px, w, x0, y0, x1, y1, color):
    for y in range(max(0, y0), min(w, y1)):
        for x in range(max(0, x0), min(w, x1)):
            px[y * w + x] = color


def rounded_square(size: int, radius: int) -> list[tuple[int, int, int, int]]:
    px = [CLEAR] * (size * size)
    r2 = radius * radius
    for y in range(size):
        for x in range(size):
            dx = 0
            dy = 0
            if x < radius:
                dx = radius - x
            elif x >= size - radius:
                dx = x - (size - radius - 1)
            if y < radius:
                dy = radius - y
            elif y >= size - radius:
                dy = y - (size - radius - 1)
            if dx and dy and dx * dx + dy * dy > r2:
                continue
            px[y * size + x] = BG
    return px


def fill_line(px, size, x0, y0, x1, y1, thickness, color):
    steps = max(abs(x1 - x0), abs(y1 - y0), 1)
    half = max(1, thickness // 2)
    for i in range(steps + 1):
        x = x0 + (x1 - x0) * i // steps
        y = y0 + (y1 - y0) * i // steps
        fill_rect(px, size, x - half, y - half, x + half + 1, y + half + 1, color)


def draw_icon(size: int) -> bytes:
    radius = max(2, size // 5)
    px = rounded_square(size, radius)
    inset = max(2, size // 5)
    poster_w = max(4, size // 3)
    x0 = (size - poster_w) // 2
    y0 = inset
    y1 = size - inset
    fill_rect(px, size, x0, y0, x0 + poster_w, y1, CREAM)
    fill_line(
        px,
        size,
        inset,
        size - inset - 1,
        size - inset - 1,
        inset,
        max(2, size // 8),
        GOLD,
    )
    return png_rgba(size, size, px)


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    for size in (16, 48, 128):
        path = ROOT / f"icon{size}.png"
        path.write_bytes(draw_icon(size))
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
