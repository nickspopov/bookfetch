#!/usr/bin/env python3
"""Compose Bookfetch store screenshots from raw captures.
Usage: compose_bf.py ios <rawdir> <outdir>   -> 1320x2868 (App Store 6.9")
       compose_bf.py android <rawdir> <outdir> -> 1440x2560 (Play phone 9:16)
Raw names expected: see SHOTS (missing files are skipped)."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FONTS = Path(__file__).parent / "fonts"  # Inter_700Bold.ttf, Inter_500Medium.ttf from @expo-google-fonts/inter
LIGHT = dict(top=(236, 243, 255), bottom=(190, 210, 245), title=(20, 33, 56), sub=(70, 86, 112))
DARK = dict(top=(16, 30, 50), bottom=(31, 58, 95), title=(238, 243, 250), sub=(170, 186, 210))

SHOTS = [
    ("libraries", "Your book server,\nin your pocket", "Calibre-Web, Kavita, Komga, any OPDS catalog", LIGHT),
    ("feed", "Browse your\nshelves", "Collections, series and new books", LIGHT),
    ("book", "Every format\nyour server has", "EPUB, PDF, CBZ, MOBI, AZW3 and more", LIGHT),
    ("openin", "Open in the reader\nyou already love", "Apple Books, Kindle, or save to Files", LIGHT),
    ("search", "Search\nyour catalogs", "When your server supports it", LIGHT),
    ("downloads", "All your downloads\nin one place", "No account. No tracking.", LIGHT),
    ("add", "Add a catalog\nin seconds", "Logins stay in secure storage on your phone", LIGHT),
    ("dark", "Easy on the eyes\nat night", "Follows your system theme", DARK),
]

def font(weight, size):
    return ImageFont.truetype(str(FONTS / f"Inter_{weight}.ttf"), size)

def gradient(W, H, top, bottom):
    g = Image.new("RGB", (1, H))
    for y in range(H):
        t = y / (H - 1)
        g.putpixel((0, y), tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)))
    return g.resize((W, H))

def rounded_mask(size, r):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), r, fill=255)
    return m

def compose(raw, title, sub, pal, W, H, sw, r_screen, tsize, ssize, ty):
    canvas = gradient(W, H, pal["top"], pal["bottom"])
    d = ImageDraw.Draw(canvas)
    tf, sf = font("700Bold", tsize), font("500Medium", ssize)
    y = ty
    for line in title.split("\n"):
        w = d.textlength(line, font=tf)
        d.text(((W - w) / 2, y), line, font=tf, fill=pal["title"])
        y += int(tsize * 1.2)
    y += 20
    w = d.textlength(sub, font=sf)
    d.text(((W - w) / 2, y), sub, font=sf, fill=pal["sub"])
    shot = Image.open(raw).convert("RGB")
    sh = round(shot.height * sw / shot.width)
    shot = shot.resize((sw, sh), Image.LANCZOS)
    bezel = 18
    dw, dh = sw + 2 * bezel, sh + 2 * bezel
    dx, dy = (W - dw) // 2, H - dh - 80
    r_dev = r_screen + bezel
    shadow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(shadow).rounded_rectangle((dx, dy + 30, dx + dw, dy + dh + 30), r_dev, fill=110)
    shadow = shadow.filter(ImageFilter.GaussianBlur(50))
    canvas = Image.composite(Image.new("RGB", (W, H), (12, 22, 40)), canvas, shadow)
    device = Image.new("RGB", (dw, dh), (28, 28, 32))
    device.paste(shot, (bezel, bezel), rounded_mask((sw, sh), r_screen))
    canvas.paste(device, (dx, dy), rounded_mask((dw, dh), r_dev))
    ImageDraw.Draw(canvas).rounded_rectangle((dx, dy, dx + dw - 1, dy + dh - 1), r_dev, outline=(70, 70, 80), width=3)
    return canvas

if __name__ == "__main__":
    plat, raw, out = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3])
    out.mkdir(parents=True, exist_ok=True)
    if plat == "ios":
        W, H, sw, rs, ts, ss, ty = 1320, 2868, 1000, 128, 104, 46, 170
    else:
        W, H, sw, rs, ts, ss, ty = 1440, 2560, 840, 66, 96, 44, 100
    i = 0
    for key, title, sub, pal in SHOTS:
        if plat == "android" and key == "openin":
            sub = "KOReader, Moon+ Reader, Kindle and more"
        src = raw / f"{key}.png"
        if not src.exists():
            continue
        i += 1
        img = compose(src, title, sub, pal, W, H, sw, rs, ts, ss, ty)
        assert img.size == (W, H)
        p = out / f"{i:02d}-{key}.png"
        img.save(p, optimize=True)
        print(p)
