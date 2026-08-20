#!/usr/bin/env python3
"""Generate the app icons (no image libraries required).

Draws a flat dumbbell mark in the app's own palette and writes plain PNGs.
Run with: python3 tools/make-icons.py
"""
import struct
import zlib
from pathlib import Path

PUSH = (168, 20, 25)   # #A81419
WHITE = (255, 255, 255)

OUT = Path(__file__).resolve().parent.parent / "public"

# Dumbbell geometry, as fractions of the canvas measured from the centre.
BARS = [
    (0.26, 0.36, 0.23),   # outer plates
    (0.19, 0.26, 0.15),   # inner collars
    (0.00, 0.20, 0.07),   # bar
]


def render(size, scale):
    """scale < 1 keeps the mark inside the safe zone for maskable icons."""
    px = [[PUSH] * size for _ in range(size)]
    mid = size / 2

    def fill(x0, x1, y0, y1):
        for y in range(max(0, int(y0)), min(size, int(round(y1)))):
            row = px[y]
            for x in range(max(0, int(x0)), min(size, int(round(x1)))):
                row[x] = WHITE

    for x_in, x_out, half_h in BARS:
        y0 = mid - half_h * size * scale
        y1 = mid + half_h * size * scale
        for sign in (1, -1):
            a = mid + sign * x_in * size * scale
            b = mid + sign * x_out * size * scale
            fill(min(a, b), max(a, b), y0, y1)
    return px


def write_png(path, px):
    size = len(px)
    raw = bytearray()
    for row in px:
        raw.append(0)  # filter: none
        for r, g, b in row:
            raw += bytes((r, g, b))

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)
    print(f"{path.name}: {len(png)} bytes")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    write_png(OUT / "icon-192.png", render(192, 1.0))
    write_png(OUT / "icon-512.png", render(512, 1.0))
    write_png(OUT / "icon-maskable-512.png", render(512, 0.66))
    write_png(OUT / "apple-touch-icon.png", render(180, 1.0))
