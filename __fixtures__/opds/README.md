# OPDS fixtures

Live fixtures were fetched once on 2026-10-24 with `User-Agent: Bookfetch/1.0.0 (+https://bookfetch.nickpopov.com)`;
each XML file names its source URL in the comment after the XML declaration. No credentials are stored here
(the Kavita key is the public demo key published by Kavita).

| File | Source |
| --- | --- |
| `gutenberg-root.xml` | https://www.gutenberg.org/ebooks.opds/ (inline `data:` thumbnails shortened) |
| `gutenberg-search-austen.xml` | https://www.gutenberg.org/ebooks/search.opds/?query=austen (thumbnails shortened) |
| `gutenberg-book-1342.xml` | https://www.gutenberg.org/ebooks/1342.opds |
| `gutenberg-osd.xml` | https://www.gutenberg.org/catalog/osd-books.xml |
| `standardebooks-search-austen.xml` | https://standardebooks.org/feeds/opds/all?query=austen |
| `standardebooks-root-401.html` | https://standardebooks.org/feeds/opds (HTTP 401 body) |
| `kavita-root.xml`, `kavita-libraries.xml`, `kavita-library-1.xml`, `kavita-series-56.xml`, `kavita-search-osd.xml` | https://demo.kavitareader.com/api/opds/9003cf99-9213-4206-a787-af2fe4cc5f1f (+ `/libraries`, `/libraries/1`, `/series/56`, `/search`) |
| `opds2-test-home.json` | https://test.opds.io/2.0/home.json, trimmed (JSON has no comments) |
| `calibre-web-root.xml`, `calibre-web-new.xml` | hand-made from Calibre-Web's feed templates |
| `komga-series.xml` | hand-made from Komga's OPDS 1.2 controller |
| `edge-cases.xml`, `single-entry.xml`, `html-autodiscovery.html` | hand-made edge cases |
