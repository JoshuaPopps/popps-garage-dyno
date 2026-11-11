#!/usr/bin/env python3
"""Render the Garage Dyno app icons (192/512 PNG) from the same gauge
design as icon.svg, using Pillow only (no SVG renderer needed).

Run from the project root:  python3 make_icons.py
"""
import math
from PIL import Image, ImageDraw, ImageFont

BG = (28, 26, 23)        # #1c1a17
PAPER = (244, 239, 228)  # #f4efe4
INK = (33, 29, 24)       # #211d18
AMBER = (217, 142, 31)   # #d98e1f
RED = (179, 38, 30)      # #b3261e


def font(size):
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def draw_icon(size):
    img = Image.new("RGB", (size, size), BG)
    d = ImageDraw.Draw(img)
    # Rounded background.
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=size // 5, fill=BG)
    cx = cy = size // 2
    r = int(size * 0.383)
    # Gauge face.
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=PAPER)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=AMBER, width=max(4, size // 36))
    d.ellipse([cx - int(r * 0.82), cy - int(r * 0.82),
               cx + int(r * 0.82), cy + int(r * 0.82)],
              outline=INK, width=max(2, size // 128))
    # Tick marks (5 across the top arc).
    for deg in (-120, -60, 0, 60, 120):
        a = math.radians(deg - 90)
        x1 = cx + int(r * 0.86 * math.cos(a))
        y1 = cy + int(r * 0.86 * math.sin(a))
        x2 = cx + int(r * 0.70 * math.cos(a))
        y2 = cy + int(r * 0.70 * math.sin(a))
        d.line([x1, y1, x2, y2], fill=INK, width=max(4, size // 50))
    # Needle pointing up-right (toward the redline).
    a = math.radians(-45)
    nx = cx + int(r * 0.62 * math.cos(a))
    ny = cy + int(r * 0.62 * math.sin(a))
    d.line([cx, cy, nx, ny], fill=RED, width=max(6, size // 32))
    hr = max(8, size // 20)
    d.ellipse([cx - hr, cy - hr, cx + hr, cy + hr], fill=INK)
    d.ellipse([cx - hr, cy - hr, cx + hr, cy + hr], outline=AMBER, width=max(2, size // 100))
    # Labels.
    f_small = font(max(14, size // 12))
    f_big = font(max(18, size // 10))
    d.text((cx, cy - int(r * 0.42)), "0", font=f_small, fill=INK, anchor="mm")
    d.text((cx + int(r * 0.52), cy + int(r * 0.18)), "HP", font=f_small,
           fill=INK, anchor="mm")
    d.text((cx, cy + int(r * 0.68)), "DYNO", font=f_big, fill=AMBER, anchor="mm")
    return img


if __name__ == "__main__":
    for size in (192, 512):
        draw_icon(size).save(f"icons/icon-{size}.png")
        print(f"icons/icon-{size}.png written")
