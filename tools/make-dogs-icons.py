#!/usr/bin/env python3
"""Generate the icons for the dog training app (no image libraries required).

A white paw print on green: nothing like the red dumbbell or the blue plate the
other two apps use, so the three are never confused on a home screen.

Run with: python3 tools/make-dogs-icons.py
"""
import struct
import zlib
from pathlib import Path

GREEN = (31, 106, 74)   # #1F6A4A
WHITE = (255, 255, 255)

OUT = Path(__file__).resolve().parent.parent / "dogs" / "public"

# Pad and four toes, as fractions of the canvas: (x, y, half-width, half-height).
# y is measured down from the centre, so the toes sit above the pad.
PAD = (0.0, 0.115, 0.225, 0.175)
TOES = [
    (-0.245, -0.070, 0.082, 0.105),
    (-0.088, -0.190, 0.089, 0.115),
    (0.088, -0.190, 0.089, 0.115),
    (0.245, -0.070, 0.082, 0.105),
]


def render(size, scale):
    """scale < 1 keeps the mark inside the safe zone for maskable icons."""
    px = [[GREEN] * size for _ in range(size)]
    mid = (size - 1) / 2
    shapes = [
        (x * size * scale, y * size * scale, a * size * scale, b * size * scale)
        for x, y, a, b in [PAD, *TOES]
    ]
    # 4x supersampling on the edges, so the curves read clean at 192px.
    ss = 4
    for y in range(size):
        row = px[y]
        for x in range(size):
            hits = 0
            for sy in range(ss):
                dy = y + (sy + 0.5) / ss - 0.5 - mid
                for sx in range(ss):
                    dx = x + (sx + 0.5) / ss - 0.5 - mid
                    for cx, cy, a, b in shapes:
                        u = (dx - cx) / a
                        v = (dy - cy) / b
                        if u * u + v * v <= 1:
                            hits += 1
                            break
            if hits:
                f = hits / (ss * ss)
                row[x] = tuple(
                    round(GREEN[i] + (WHITE[i] - GREEN[i]) * f) for i in range(3)
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
