#!/usr/bin/env python3
"""Builds the sample OPDS 1.2 catalog served at https://nickpopov.com/bookfetch/opds/catalog.xml.

Usage: python3 build_catalog.py <epub-and-cover-dir> <out dir>   -> <out dir>/opds/...
Input: <slug>.epub + <slug>.jpg pairs. Books are Standard Ebooks editions (CC0 public-domain
dedication) with Standard Ebooks covers. Serve *.xml as
application/atom+xml;profile=opds-catalog with Access-Control-Allow-Origin: *.
"""
import glob, html, os, re, shutil, sys, zipfile, datetime
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
SITE = "https://nickpopov.com/bookfetch"
P = "/bookfetch"
NOW = "2026-10-25T00:00:00Z"

os.makedirs(OUT, exist_ok=True)

def esc(s):
    return html.escape(s or "", quote=True)

# ---------- sample catalog ----------
books = []
for f in sorted(glob.glob(os.path.join(SRC, "*.epub"))):
    slug = os.path.basename(f)[:-5]
    z = zipfile.ZipFile(f)
    opf = [n for n in z.namelist() if n.endswith(".opf")][0]
    x = z.read(opf).decode()
    def g(tag):
        return [html.unescape(re.sub(r"\s+", " ", m).strip()) for m in re.findall(r"<dc:%s[^>]*>(.*?)</dc:%s>" % (tag, tag), x, re.S)]
    desc_html = g("description")[0] if g("description") else ""
    desc_html = re.sub(r"<a [^>]*>(.*?)</a>", r"\1", desc_html)  # drop links back to SE pages
    first_p = re.sub(r"<[^>]+>", "", re.split(r"</p>", desc_html)[0]).strip()
    books.append(dict(
        slug=slug, title=g("title")[0], authors=g("creator"), lang=g("language")[0] if g("language") else "en",
        subjects=[s.split("--")[0].strip() for s in g("subject")][:3], source=g("identifier")[0],
        summary=first_p, content=desc_html, size=os.path.getsize(f)))

od = os.path.join(OUT, "opds")
for d in ("books", "covers"):
    os.makedirs(os.path.join(od, d), exist_ok=True)
for b in books:
    shutil.copy(os.path.join(SRC, b["slug"] + ".epub"), os.path.join(od, "books", b["slug"] + ".epub"))
    im = Image.open(os.path.join(SRC, b["slug"] + ".jpg")).convert("RGB")
    full = im.copy(); full.thumbnail((700, 1050)); full.save(os.path.join(od, "covers", b["slug"] + ".jpg"), quality=82, optimize=True, progressive=True)
    th = im.copy(); th.thumbnail((200, 300)); th.save(os.path.join(od, "covers", b["slug"] + "-thumb.jpg"), quality=80, optimize=True)

NS = ('xmlns="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/terms/" '
      'xmlns:opds="http://opds-spec.org/2010/catalog"')
NAV = "application/atom+xml;profile=opds-catalog;kind=navigation"
ACQ = "application/atom+xml;profile=opds-catalog;kind=acquisition"

def feed(fid, title, self_href, kind, entries, subtitle=None):
    sub = f"\n  <subtitle>{esc(subtitle)}</subtitle>" if subtitle else ""
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<feed {NS}>
  <id>{SITE}/opds/{fid}</id>
  <title>{esc(title)}</title>{sub}
  <updated>{NOW}</updated>
  <icon>{SITE}/icon-180.png</icon>
  <author><name>Bookfetch</name><uri>{SITE}</uri></author>
  <link rel="self" href="{self_href}" type="{kind}"/>
  <link rel="start" href="catalog.xml" type="{NAV}"/>
{''.join(entries)}</feed>
"""

def book_entry(b):
    authors = "".join(f"\n    <author><name>{esc(a)}</name></author>" for a in b["authors"])
    cats = "".join(f'\n    <category term="{esc(s)}" label="{esc(s)}"/>' for s in b["subjects"])
    return f"""  <entry>
    <id>{esc(b['source'])}</id>
    <title>{esc(b['title'])}</title>{authors}
    <updated>{NOW}</updated>
    <dc:language>{esc(b['lang'])}</dc:language>
    <dc:publisher>Standard Ebooks</dc:publisher>{cats}
    <summary>{esc(b['summary'])}</summary>
    <content type="html">{esc(b['content'])}</content>
    <link rel="http://opds-spec.org/image" href="covers/{b['slug']}.jpg" type="image/jpeg"/>
    <link rel="http://opds-spec.org/image/thumbnail" href="covers/{b['slug']}-thumb.jpg" type="image/jpeg"/>
    <link rel="http://opds-spec.org/acquisition/open-access" href="books/{b['slug']}.epub" type="application/epub+zip" length="{b['size']}"/>
    <link rel="alternate" href="{esc(b['source'])}" type="text/html" title="Standard Ebooks page"/>
  </entry>
"""

def nav_entry(eid, title, href, summary):
    return f"""  <entry>
    <id>{SITE}/opds/{eid}</id>
    <title>{esc(title)}</title>
    <updated>{NOW}</updated>
    <content type="text">{esc(summary)}</content>
    <link rel="subsection" href="{href}" type="{ACQ}"/>
  </entry>
"""

adventure = [b for b in books if any(k in b["slug"] for k in ("verne", "wells", "shelley"))]
classics = [b for b in books if b not in adventure]
with open(os.path.join(od, "catalog.xml"), "w") as fh:
    fh.write(feed("catalog", "Bookfetch Sample Library", "catalog.xml", NAV, [
        nav_entry("all", "All books", "all.xml", f"{len(books)} public-domain classics from Standard Ebooks"),
        nav_entry("adventure", "Adventure & science fiction", "adventure.xml", "Verne, Wells, Shelley"),
        nav_entry("classics", "Novels & stories", "classics.xml", "Austen, Conan Doyle, Wilde"),
    ], subtitle="A few public-domain classics to try Bookfetch. Editions by Standard Ebooks (CC0)."))
for name, title, lst in (("all", "All books", books), ("adventure", "Adventure & science fiction", adventure), ("classics", "Novels & stories", classics)):
    with open(os.path.join(od, name + ".xml"), "w") as fh:
        fh.write(feed(name, title, name + ".xml", ACQ, [book_entry(b) for b in lst]))
with open(os.path.join(od, "README.txt"), "w") as fh:
    fh.write("Sample OPDS 1.2 catalog for Bookfetch. The books are Standard Ebooks editions (https://standardebooks.org),\n"
             "released into the public domain under CC0 1.0. Covers are Standard Ebooks cover art (CC0).\n"
             "Bookfetch is not affiliated with or endorsed by Standard Ebooks.\n")
