#!/usr/bin/env python3
"""Generate the icons for the PPL app (no image libraries required).

A weight plate — a solid disc with a square centre hole — in blue, so it can
never be mistaken on a home screen for the other app's red dumbbell.

Run with: python3 tools/make-ppl-icons.py
"""
import struct
import zlib
from pathlib import Path

BLUE = (29, 78, 216)   # #1D4ED8
WHITE = (255, 255, 255)

OUT = Path(__file__).resolve().parent.parent / "ppl" / "public"

R_OUTER = 0.38   # plate radius, as a fraction of the canvas
R_INNER = 0.115  # centre hole, half-width of the square


def render(size, scale):
    """scale < 1 keeps the mark inside the safe zone for maskable icons."""
    px = [[BLUE] * size for _ in range(size)]
    mid = (size - 1) / 2
    r_out = R_OUTER * size * scale
    r_in = R_INNER * size * scale
    # 4x supersampling on the disc edge, so the circle reads clean at 192px.
    ss = 4
    for y in range(size):
        row = px[y]
        for x in range(size):
            hits = 0
            for sy in range(ss):
                dy = y + (sy + 0.5) / ss - 0.5 - mid
                for sx in range(ss):
                    dx = x + (sx + 0.5) / ss - 0.5 - mid
                    if dx * dx + dy * dy <= r_out * r_out and not (
                        abs(dx) <= r_in and abs(dy) <= r_in
                    ):
                        hits += 1
            if hits:
                f = hits / (ss * ss)
                row[x] = tuple(
                    round(BLUE[i] + (WHITE[i] - BLUE[i]) * f) for i in range(3)
                )
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
