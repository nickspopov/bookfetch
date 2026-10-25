#!/usr/bin/env python3
"""Render Bookfetch icon set from SVG via headless Chrome. Usage: make_icons.py <outdir>"""
import os, subprocess, sys, tempfile
from PIL import Image

OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Glyph: an open book seen from the front, with a download arrow dropping into it. Drawn on a 1024 grid, centred.
def glyph(color="#FFFFFF", page="#FFFFFF", page_op=1.0, arrow="#FFFFFF", scale=1.0):
    return f"""
  <g transform="translate(512 512) scale({scale}) translate(-512 -512)">
    <!-- left page -->
    <path d="M512 430 C 440 380, 330 360, 232 372 L 232 712 C 330 700, 440 718, 512 768 Z" fill="{page}" fill-opacity="{page_op}"/>
    <!-- right page -->
    <path d="M512 430 C 584 380, 694 360, 792 372 L 792 712 C 694 700, 584 718, 512 768 Z" fill="{page}" fill-opacity="{page_op*0.86}"/>
    <!-- arrow -->
    <rect x="482" y="196" width="60" height="196" rx="30" fill="{arrow}"/>
    <path d="M412 330 L 512 432 L 612 330" fill="none" stroke="{arrow}" stroke-width="60" stroke-linecap="round" stroke-linejoin="round"/>
  </g>"""

BG = """<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#3B7BE8"/><stop offset="1" stop-color="#1F3A5F"/></linearGradient></defs>
  <rect width="1024" height="1024" fill="url(#g)"/>"""

def svg(body, bg=True):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">{BG if bg else ""}{body}</svg>'

variants = {
    "icon.png": (svg(glyph(page="#FFFFFF", arrow="#FFD66B")), False),
    "android-icon-foreground.png": (svg(glyph(page="#FFFFFF", arrow="#FFD66B", scale=0.62), bg=False), True),
    "android-icon-monochrome.png": (svg(glyph(page="#FFFFFF", arrow="#FFFFFF", scale=0.62), bg=False), True),
    "splash-icon.png": (svg(glyph(page="#FFFFFF", arrow="#FFD66B"), bg=False), True),
}
with tempfile.TemporaryDirectory() as td:
    for name, (s, alpha) in variants.items():
        hp = os.path.join(td, name + ".html")
        bgcss = "transparent" if alpha else "#000"
        open(hp, "w").write(f'<html><body style="margin:0;background:{bgcss}">{s}</body></html>')
        png = os.path.join(td, name)
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", f"--user-data-dir={td}/c",
                        "--default-background-color=00000000", "--window-size=1024,1024", f"--screenshot={png}", "file://" + hp],
                       check=True, capture_output=True)
        im = Image.open(png)
        im = im.convert("RGBA") if alpha else im.convert("RGB")
        im.save(os.path.join(OUT, name))
    ic = Image.open(os.path.join(OUT, "icon.png"))
    ic.resize((180, 180), Image.LANCZOS).save(os.path.join(OUT, "icon-180.png"))
    ic.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, "icon-512.png"))
print(sorted(os.listdir(OUT)))
