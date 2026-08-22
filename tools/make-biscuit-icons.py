#!/usr/bin/env python3
"""Generate the icons for the biscuit game (no image libraries required).

A chocolate-chip biscuit on dark cocoa: not the red dumbbell, the blue plate,
the green paw, the orange calendar page or the fairway flagstick the other five
apps use, so the six are never confused on a home screen.

Run with: python3 tools/make-biscuit-icons.py
"""
import struct
import zlib
from pathlib import Path

COCOA = (26, 15, 10)   # #1A0F0A, the app's own ground
DOUGH = (217, 160, 91)  # #D9A05B
RIM = (179, 126, 62)    # #B37E3E
CHIP = (74, 44, 26)     # #4A2C1A

OUT = Path(__file__).resolve().parent.parent / "biscuit" / "public"

# Fractions of the canvas, measured from the centre, y running down. The chips
# are the same five the app draws on the big biscuit, so the icon and the thing
# it opens are recognisably the same object.
BODY = 0.360
FACE = 0.336
CHIPS = [
    (-0.088, -0.120, 0.040),
    (0.096, -0.088, 0.046),
    (-0.152, 0.024, 0.034),
    (0.024, 0.008, 0.050),
    (0.160, 0.064, 0.038),
    (-0.064, 0.144, 0.042),
    (0.088, 0.176, 0.032),
]


def colour_at(dx, dy, scale):
    """Cocoa ground, a rim, a dough face, and chips sunk into it."""
    r2 = dx * dx + dy * dy
    if r2 > (BODY * scale) ** 2:
        return COCOA
    for cx, cy, cr in CHIPS:
        cx, cy, cr = cx * scale, cy * scale, cr * scale
        if (dx - cx) ** 2 + (dy - cy) ** 2 <= cr * cr:
            return CHIP
    # the face sits a touch high, which reads as a rim along the bottom edge
    if dx * dx + (dy + 0.012 * scale) ** 2 <= (FACE * scale) ** 2:
        return DOUGH
    return RIM


def render(size, scale):
    """scale < 1 keeps the mark inside the safe zone for maskable icons."""
    px = [[COCOA] * size for _ in range(size)]
    mid = (size - 1) / 2
    # 4x supersampling, so the chips read clean at 192px.
    ss = 4
    for y in range(size):
        row = px[y]
        for x in range(size):
            r = g = b = 0
            for sy in range(ss):
                dy = (y + (sy + 0.5) / ss - 0.5 - mid) / size
                for sx in range(ss):
                    dx = (x + (sx + 0.5) / ss - 0.5 - mid) / size
                    c = colour_at(dx, dy, scale)
                    r += c[0]
                    g += c[1]
                    b += c[2]
            n = ss * ss
            row[x] = (round(r / n), round(g / n), round(b / n))
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
