#!/usr/bin/env python3
"""Generate the icons for the weekly task app (no image libraries required).

A white calendar page with an indigo tick through it: not the red dumbbell,
the blue plate or the green paw the other three apps use, so the four are never
confused on a home screen.

Run with: python3 tools/make-weekly-icons.py
"""
import struct
import zlib
from pathlib import Path

INDIGO = (75, 63, 166)   # #4B3FA6
WHITE = (255, 255, 255)

OUT = Path(__file__).resolve().parent.parent / "week" / "public"

# Everything below is a fraction of the canvas, measured from the centre, with
# y running down. The page is the only white shape; the band and the tick are
# indigo cut back out of it, so the mark is two colours and no outlines.
PAGE = (-0.345, -0.325, 0.345, 0.345, 0.085)   # x0, y0, x1, y1, corner radius
# The header strip is inset from the page rather than run to its edge: white
# has to show above it, or the strip merges into the indigo ground and the
# calendar reads as a plain card.
BAND = (-0.250, -0.240, 0.250, -0.150, 0.025)
TICK = [(-0.150, 0.075), (-0.045, 0.180), (0.165, -0.045)]
TICK_HALF = 0.052                               # half the stroke's thickness


def rounded(dx, dy, rect):
    x0, y0, x1, y1, r = rect
    if dx < x0 or dx > x1 or dy < y0 or dy > y1:
        return False
    cx = min(max(dx, x0 + r), x1 - r)
    cy = min(max(dy, y0 + r), y1 - r)
    return (dx - cx) ** 2 + (dy - cy) ** 2 <= r * r


def capsule(dx, dy, a, b, half):
    """A line segment with round ends — the tick is two of these."""
    (ax, ay), (bx, by) = a, b
    vx, vy = bx - ax, by - ay
    span = vx * vx + vy * vy
    t = 0.0 if span == 0 else ((dx - ax) * vx + (dy - ay) * vy) / span
    t = min(max(t, 0.0), 1.0)
    px, py = ax + t * vx, ay + t * vy
    return (dx - px) ** 2 + (dy - py) ** 2 <= half * half


def colour_at(dx, dy, scale):
    """Indigo ground, white page, indigo header strip and tick on top of it."""
    page = tuple(v * scale for v in PAGE)
    if not rounded(dx, dy, page):
        return INDIGO
    if rounded(dx, dy, tuple(v * scale for v in BAND)):
        return INDIGO
    half = TICK_HALF * scale
    pts = [(x * scale, y * scale) for x, y in TICK]
    for a, b in zip(pts, pts[1:]):
        if capsule(dx, dy, a, b, half):
            return INDIGO
    return WHITE


def render(size, scale):
    """scale < 1 keeps the mark inside the safe zone for maskable icons."""
    px = [[INDIGO] * size for _ in range(size)]
    mid = (size - 1) / 2
    # 4x supersampling, so the corners and the tick read clean at 192px.
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
