#!/usr/bin/env python3
"""Generate the icons for the golf mobility app (no image libraries required).

A flagstick and a ball, chalk and bunker gold on deep fairway green: not the
red dumbbell, the blue plate, the green paw or the orange calendar page the
other four apps use, so the five are never confused on a home screen.

Run with: python3 tools/make-golf-icons.py
"""
import struct
import zlib
from pathlib import Path

GREEN = (8, 37, 28)      # #08251C
CHALK = (242, 240, 232)  # #F2F0E8
SAND = (224, 168, 62)    # #E0A83E

OUT = Path(__file__).resolve().parent.parent / "golf" / "public"

# Everything below is a fraction of the canvas, measured from the centre, with
# y running down. The pole and the ball are chalk, the flag is gold, and the
# ground behind all three is the app's own green — no outlines anywhere.
POLE = (-0.035, -0.360, 0.025, 0.300, 0.028)     # x0, y0, x1, y1, corner radius
FLAG = ((0.025, -0.350), (0.330, -0.235), (0.025, -0.120))
BALL = (-0.205, 0.185, 0.115)                     # centre x, centre y, radius


def rounded(dx, dy, rect):
    x0, y0, x1, y1, r = rect
    if dx < x0 or dx > x1 or dy < y0 or dy > y1:
        return False
    cx = min(max(dx, x0 + r), x1 - r)
    cy = min(max(dy, y0 + r), y1 - r)
    return (dx - cx) ** 2 + (dy - cy) ** 2 <= r * r


def in_triangle(dx, dy, tri):
    """Same-sign edge tests — the flag is one triangle and needs nothing more."""
    (ax, ay), (bx, by), (cx, cy) = tri
    d1 = (dx - bx) * (ay - by) - (ax - bx) * (dy - by)
    d2 = (dx - cx) * (by - cy) - (bx - cx) * (dy - cy)
    d3 = (dx - ax) * (cy - ay) - (cx - ax) * (dy - ay)
    neg = d1 < 0 or d2 < 0 or d3 < 0
    pos = d1 > 0 or d2 > 0 or d3 > 0
    return not (neg and pos)


def colour_at(dx, dy, scale):
    """Fairway green ground, chalk pole and ball, a gold flag on the pole."""
    if rounded(dx, dy, tuple(v * scale for v in POLE)):
        return CHALK
    bx, by, br = (v * scale for v in BALL)
    if (dx - bx) ** 2 + (dy - by) ** 2 <= br * br:
        return CHALK
    if in_triangle(dx, dy, tuple((x * scale, y * scale) for x, y in FLAG)):
        return SAND
    return GREEN


def render(size, scale):
    """scale < 1 keeps the mark inside the safe zone for maskable icons."""
    px = [[GREEN] * size for _ in range(size)]
    mid = (size - 1) / 2
    # 4x supersampling, so the pole and the ball read clean at 192px.
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
