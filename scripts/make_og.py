#!/usr/bin/env python3
"""Generate Open Graph share banners (1200x630) for the Heavenly universe.

Deterministic, no network needed. Run:  python3 scripts/make_og.py
Requires: pillow  (pip install pillow)
"""
import math
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_DIR = "/usr/share/fonts/truetype/dejavu"
SERIF = os.path.join(FONT_DIR, "DejaVuSerif-Bold.ttf")
SANS = os.path.join(FONT_DIR, "DejaVuSans.ttf")

W, H = 1200, 630
BG_TOP = (10, 10, 15)
BG_BOT = (16, 15, 24)
GOLD = (212, 175, 55)
GOLD_LIGHT = (244, 228, 188)

SITES = [
    ("", "THE HEAVENLY UNIVERSE", "Every repo. Rebuilt."),
    ("sites/heavenly", "HEAVENLY", "You're already inside it."),
    ("sites/heavenly-site", "HEAVENLY — DOSSIER", "Pressure. Control. Fluid adaptation."),
    ("sites/thatminecraft", "THATMINECRAFT", "The realm lobby — voxel overworld."),
    ("sites/maxxing", "HEAVENLY — ANALYZER", "On-device aesthetic scan. For fun."),
    ("sites/aioutfit", "AI OUTFIT FINDER", "Fit, palette and budget — tuned to you."),
    ("sites/legagme", "LEGAGME", "The legacy board. Log every win."),
]


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def draw_spaced(draw, cx, y, text, font, fill, spacing):
    widths = [draw.textlength(ch, font=font) for ch in text]
    total = sum(widths) + spacing * (len(text) - 1)
    x = cx - total / 2
    for ch, w in zip(text, widths):
        draw.text((x, y), ch, font=font, fill=fill)
        x += w + spacing
    return total


def banner(subtitle, tagline):
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    for y in range(H):
        d.line([(0, y), (W, y)], fill=lerp(BG_TOP, BG_BOT, y / H))

    # Radial gold halo glow
    glow = Image.new("L", (W, H), 0)
    gd = ImageDraw.Draw(glow)
    cx, cy = W // 2, int(H * 0.42)
    for r in range(420, 0, -4):
        alpha = int(46 * (1 - r / 420) ** 2)
        gd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=alpha)
    glow = glow.filter(ImageFilter.GaussianBlur(30))
    gold_layer = Image.new("RGB", (W, H), GOLD)
    img = Image.composite(gold_layer, img, glow.point(lambda a: min(255, a * 2)))
    d = ImageDraw.Draw(img)

    # Halo ring
    ring_r = 190
    for wdt, col in [(2, (212, 175, 55))]:
        d.ellipse([cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r],
                  outline=col, width=wdt)
    d.ellipse([cx - ring_r - 14, cy - ring_r - 14, cx + ring_r + 14, cy + ring_r + 14],
              outline=(70, 60, 30), width=1)

    # Star dust
    import random
    rnd = random.Random(777)
    for _ in range(140):
        x, y = rnd.randrange(W), rnd.randrange(H)
        dist = math.hypot(x - cx, y - cy)
        if dist < ring_r - 10:
            continue
        s = rnd.choice([1, 1, 1, 2])
        a = rnd.randrange(40, 130)
        d.rectangle([x, y, x + s, y + s], fill=lerp(BG_TOP, GOLD_LIGHT, a / 255))

    # Title
    title_font = ImageFont.truetype(SERIF, 92)
    draw_spaced(d, W / 2, H * 0.30, "HEAVENLY", title_font, GOLD_LIGHT, 22)

    # Subtitle
    sub_font = ImageFont.truetype(SANS, 30)
    draw_spaced(d, W / 2, H * 0.55, subtitle, sub_font, GOLD, 6)

    # Tagline
    tag_font = ImageFont.truetype(SANS, 24)
    draw_spaced(d, W / 2, H * 0.66, tagline, tag_font, (170, 173, 181), 1)

    # Footer rule + handle
    d.line([(W * 0.30, H * 0.82), (W * 0.70, H * 0.82)], fill=(60, 52, 28), width=1)
    foot = ImageFont.truetype(SANS, 19)
    draw_spaced(d, W / 2, H * 0.86, "github.com/kbugga230209-png", foot, (120, 122, 130), 2)
    return img


def main():
    for folder, subtitle, tagline in SITES:
        out_dir = os.path.join(ROOT, folder) if folder else ROOT
        os.makedirs(out_dir, exist_ok=True)
        path = os.path.join(out_dir, "og.jpg")
        banner(subtitle, tagline).save(path, "JPEG", quality=82, optimize=True)
        print("wrote", os.path.relpath(path, ROOT), os.path.getsize(path), "bytes")


if __name__ == "__main__":
    main()
