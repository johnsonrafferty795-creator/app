#!/usr/bin/env python3
"""Generate the icons for the Gotham tracker (no image libraries required).

Matte black, and one hard strip of cold light bent across it - the ceiling of
every room in the reference. No emblem: the light is the whole idea.

Run with: python3 tools/make-gotham-icons.py
"""
import struct
import zlib
from pathlib import Path

BLACK = (7, 8, 9)        # #070809, the ground
LIGHT = (233, 240, 250)  # #E9F0FA, cold white
HALO = (36, 44, 56)      # the spill either side of the strip

OUT = Path(__file__).resolve().parent.parent / "ppl" / "public"


def render(size, scale):
    """scale < 1 keeps the mark inside the safe zone for maskable icons."""
    px = [[BLACK] * size for _ in range(size)]
    mid = (size - 1) / 2
    half = 0.30 * size * scale     # how far the strip reaches either side
    bend = 0.12 * size * scale     # how far the ends drop below the elbow
    thick = 0.035 * size * scale   # half-thickness of the strip
    spill = thick * 4.5

    def dist(x, y):
        """distance to the bent line: two arms meeting at the middle."""
        dx, dy = x - mid, y - mid
        if abs(dx) > half:
            return 1e9
        # the arm rises from the ends towards the elbow at the centre
        line_y = -bend + (bend / half) * abs(dx) if half else 0
        return abs(dy - line_y)

    ss = 3
    for y in range(size):
        row = px[y]
        for x in range(size):
            lit = 0
            near = 0.0
            for sy in range(ss):
                for sx in range(ss):
                    d = dist(x + (sx + 0.5) / ss - 0.5, y + (sy + 0.5) / ss - 0.5)
                    if d <= thick:
                        lit += 1
                    elif d <= spill:
                        near = max(near, 1 - (d - thick) / (spill - thick))
            if lit:
                f = lit / (ss * ss)
                row[x] = tuple(round(BLACK[i] + (LIGHT[i] - BLACK[i]) * f) for i in range(3))
            elif near > 0:
                g = near * near * 0.75
                row[x] = tuple(round(BLACK[i] + (HALO[i] - BLACK[i]) * g) for i in range(3))
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
