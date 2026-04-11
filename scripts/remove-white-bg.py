"""Remove near-white background from a PNG (transparency). Run once when replacing logos."""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image


def luminance(rgb: tuple[int, ...]) -> float:
    r, g, b = rgb[0], rgb[1], rgb[2]
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0


def saturation(rgb: tuple[int, ...]) -> float:
    r, g, b = rgb[0] / 255.0, rgb[1] / 255.0, rgb[2] / 255.0
    mx, mn = max(r, g, b), min(r, g, b)
    if mx == 0:
        return 0.0
    return (mx - mn) / mx


def should_be_transparent(r: int, g: int, b: int, a: int) -> bool:
    if a == 0:
        return True
    # Strong white / light gray plate (low color, high brightness)
    sat = saturation((r, g, b))
    lum = luminance((r, g, b))
    if lum > 0.92 and sat < 0.12:
        return True
    # Extra catch for solid white
    if r >= 250 and g >= 250 and b >= 250:
        return True
    return False


def process(src: Path, *dests: Path) -> None:
    im = Image.open(src).convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if should_be_transparent(r, g, b, a):
                px[x, y] = (r, g, b, 0)
    for dest in dests:
        im.save(dest, format="PNG", optimize=True)
        print(f"Wrote {dest}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: remove-white-bg.py <source.png> <out1.png> [out2.png ...]")
        sys.exit(1)
    source = Path(sys.argv[1])
    outs = [Path(p) for p in sys.argv[2:]]
    process(source, *outs)
