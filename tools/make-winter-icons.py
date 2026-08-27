#!/usr/bin/env python3
"""Generate the icons for the Winter Arc app (no image libraries required).

A barbell — bar, collars and two plates a side — in bone white on black. It is
the same mark the app sets beside its wordmark, so the home screen and the
front page agree, and nothing on that screen is blacker.

Run with: python3 tools/make-winter-icons.py
"""
import struct
import zlib
from pathlib import Path

BLACK = (8, 9, 10)      # #08090A, the app's own background
BONE = (233, 234, 238)  # #E9EAEE

OUT = Path(__file__).resolve().parent.parent / "winter" / "public"

# Everything is a fraction of the canvas, measured from the centre, y down, and
# mirrored about x = 0: half a barbell describes the whole of it. Each entry is
# (outer edge, inner edge, half-height, corner radius).
BAR = (0.330, 0.0, 0.032, 0.020)      # the shaft, straight through the middle
COLLAR = (0.246, 0.190, 0.098, 0.022)  # the small plate outside the big one
PLATE = (0.170, 0.088, 0.190, 0.026)   # the big plate


def rounded(dx, dy, part, scale):
    """A rounded bar, mirrored: |dx| does both ends at once."""
    outer, inner, half, r = (v * scale for v in part)
    ax, ay = abs(dx), abs(dy)
    if ax > outer or ax < inner or ay > half:
        return False
    # the corner radius applies at the outer end and top/bottom only
    cx = min(ax, outer - r) if outer - r > inner else ax
    cy = min(ay, half - r)
    return (ax - cx) ** 2 + (ay - cy) ** 2 <= r * r or (ax <= outer - r and ay <= half - r)


def colour_at(dx, dy, scale):
    for part in (BAR, COLLAR, PLATE):
        if rounded(dx, dy, part, scale):
            return BONE
    return BLACK


def render(size, scale):
    """scale < 1 keeps the mark inside the safe zone for maskable icons."""
    px = [[BLACK] * size for _ in range(size)]
    mid = (size - 1) / 2
    # 4x supersampling, so the plate corners read clean at 192px.
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
