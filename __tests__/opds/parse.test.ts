/// <reference types="jest" />
import { OpdsError, parseFeed } from '../../src/opds';
import { KAVITA_BASE, fixture } from './helpers';

describe('Project Gutenberg', () => {
  it('parses the root navigation feed', () => {
    const feed = parseFeed(fixture('gutenberg-root.xml'), 'https://www.gutenberg.org/ebooks.opds/');
    expect(feed.kind).toBe('navigation');
    expect(feed.title).toBe('Project Gutenberg');
    expect(feed.subtitle).toBe('Free eBooks since 1971.');
    expect(feed.iconUrl).toBe('https://www.gutenberg.org/gutenberg/favicon.ico');
    expect(feed.start).toBe('https://www.gutenberg.org/ebooks.opds/');
    expect(feed.search).toEqual({ kind: 'description', url: 'https://www.gutenberg.org/catalog/osd-books.xml' });
    expect(feed.entries.map((e) => e.title)).toEqual(['Popular', 'Latest', 'Random']);
    const popular = feed.entries[0];
    expect(popular.navigation).toEqual({
      href: 'https://www.gutenberg.org/ebooks/search.opds/?sort_order=downloads',
      rel: 'subsection',
      type: 'application/atom+xml;profile=opds-catalog',
    });
    expect(popular.summary).toBe('Our most popular books.');
    expect(popular.acquisitions).toEqual([]);
    expect(popular.thumbnailUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('parses search results with pagination and book entries as navigation', () => {
    const url = 'https://www.gutenberg.org/ebooks/search.opds/?query=austen';
    const feed = parseFeed(fixture('gutenberg-search-austen.xml'), url);
    expect(feed.title).toBe('Books: austen');
    expect(feed.next).toBe('https://www.gutenberg.org/ebooks/search.opds/?query=austen&start_index=26');
    expect(feed.kind).toBe('navigation');
    const pride = feed.entries.find((e) => e.id === 'https://www.gutenberg.org/ebooks/1342.opds');
    expect(pride?.title).toBe('Pride and Prejudice');
    expect(pride?.summary).toBe('Jane Austen');
    expect(pride?.navigation?.href).toBe('https://www.gutenberg.org/ebooks/1342.opds');
    expect(feed.entries.length).toBeLessThanOrEqual(30);
  });

  it('parses a book feed with acquisitions, covers, xhtml content and categories', () => {
    const feed = parseFeed(fixture('gutenberg-book-1342.xml'), 'https://www.gutenberg.org/ebooks/1342.opds');
    expect(feed.kind).toBe('acquisition');
    const book = feed.entries[0];
    expect(book.id).toBe('urn:gutenberg:1342:2');
    expect(book.authors).toEqual(['Austen, Jane']);
    expect(book.language).toBe('en');
    expect(book.issued).toBe('1998-06-01T00:00:00+00:00');
    expect(book.coverUrl).toBe('https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg');
    expect(book.thumbnailUrl).toBe('https://www.gutenberg.org/cache/epub/1342/pg1342.cover.small.jpg');
    expect(book.categories).toContain('Love stories');
    expect(book.categories).toContain('Language and Literatures: English literature'); // label wins over term
    expect(book.summary?.startsWith('This edition had all images removed.\n\nTitle: Pride and Prejudice\n\n')).toBe(
      true,
    );
    expect(book.summary).toContain('Reading ease score: 69.2 (8th & 9th grade).');
    expect(book.summary).not.toMatch(/<|&amp;/);
    expect(book.acquisitions).toEqual([
      {
        href: 'https://www.gutenberg.org/ebooks/1342.epub.noimages',
        type: 'application/epub+zip',
        kind: 'generic',
        title: 'EPUB (older e-readers, no images)',
        indirectTypes: [],
        size: 561102,
        formatLabel: 'EPUB',
        downloadable: true,
      },
      {
        href: 'https://www.gutenberg.org/ebooks/1342.kindle.noimages',
        type: 'application/x-mobipocket-ebook',
        kind: 'generic',
        title: 'Kindle (no images)',
        indirectTypes: [],
        size: 540013,
        formatLabel: 'Kindle (MOBI)',
        downloadable: true,
      },
    ]);
    // related links (author, subjects) do not make a book a navigation entry
    expect(book.navigation).toBeUndefined();
  });
});

describe('Standard Ebooks', () => {
  const feed = parseFeed(
    fixture('standardebooks-search-austen.xml'),
    'https://standardebooks.org/feeds/opds/all?query=austen',
  );

  it('reads feed metadata despite the stylesheet PI and the embedded xhtml script element', () => {
    expect(feed.title).toBe('Search Results');
    expect(feed.subtitle).toBe('Results for “austen”');
    expect(feed.totalResults).toBe(7);
    expect(feed.first).toBe('https://standardebooks.org/feeds/opds/all?query=austen&page=1&per-page=12');
    expect(feed.start).toBe('https://standardebooks.org/feeds/opds');
    expect(feed.search).toEqual({ kind: 'description', url: 'https://standardebooks.org/opensearch' });
    expect(feed.kind).toBe('acquisition');
    expect(feed.entries).toHaveLength(7);
  });

  it('reads dc: metadata, html content and open-access acquisitions', () => {
    const book = feed.entries.find((e) => e.id === 'https://standardebooks.org/ebooks/jane-austen/northanger-abbey');
    expect(book).toBeDefined();
    expect(book?.authors).toEqual(['Jane Austen']);
    expect(book?.publisher).toBe('Standard Ebooks');
    expect(book?.language).toBe('en-GB');
    expect(book?.issued).toBe('2022-05-16T17:07:12Z');
    expect(book?.alternateHref).toBe('https://standardebooks.org/ebooks/jane-austen/northanger-abbey');
    expect(book?.summary).toMatch(/^Northanger Abbey is the coming-of-age story/);
    expect(book?.summary).not.toMatch(/<|&lt;|&quot;/);
    const labels = book?.acquisitions.map((a) => a.formatLabel);
    expect(labels).toEqual(['EPUB', 'EPUB', 'Kobo EPUB', 'Kindle (AZW3)', 'HTML']);
    expect(book?.acquisitions.every((a) => a.kind === 'open-access' && a.downloadable)).toBe(true);
  });

  it('keeps paragraph breaks from html content', () => {
    const lardner = feed.entries.find((e) => e.id.endsWith('ring-lardner/short-fiction'));
    expect(lardner?.summary?.split('\n\n').length).toBeGreaterThanOrEqual(3);
  });
});

describe('Kavita (key in URL)', () => {
  it('parses the root navigation feed and keeps the key in every URL', () => {
    const feed = parseFeed(fixture('kavita-root.xml'), KAVITA_BASE);
    expect(feed.kind).toBe('navigation');
    expect(feed.title).toBe('Kavita');
    expect(feed.iconUrl).toBe(`${KAVITA_BASE}/favicon`);
    expect(feed.search).toEqual({ kind: 'description', url: `${KAVITA_BASE}/search` });
    expect(feed.entries[0]).toMatchObject({
      id: 'recentlyAdded',
      title: 'Recently Added',
      navigation: { href: `${KAVITA_BASE}/recently-added`, rel: 'subsection' },
    });
  });

  it('parses a sub feed with covers whose query strings carry the key', () => {
    const feed = parseFeed(fixture('kavita-libraries.xml'), `${KAVITA_BASE}/libraries`);
    expect(feed.entries.map((e) => e.title)).toEqual(['Books', 'Comics', 'Manga']);
    expect(feed.entries[0].coverUrl).toBe(
      'https://demo.kavitareader.com/api/image/library-cover?libraryId=1&apiKey=9003cf99-9213-4206-a787-af2fe4cc5f1f',
    );
    expect(feed.kind).toBe('navigation');
  });

  it('reads totalResults declared with an inline default namespace and the next page', () => {
    const feed = parseFeed(fixture('kavita-library-1.xml'), `${KAVITA_BASE}/libraries/1`);
    expect(feed.totalResults).toBe(57);
    expect(feed.next).toBe(`${KAVITA_BASE}/libraries/1?pageNumber=2`);
    expect(feed.entries).toHaveLength(20);
    expect(feed.entries[0].categories).toEqual(['canada -- biography', 'canada -- biography -- dictionaries']);
  });

  it('parses a series acquisition feed, de-duplicates entry ids and decodes link titles', () => {
    const feed = parseFeed(fixture('kavita-series-56.xml'), `${KAVITA_BASE}/series/56`);
    expect(feed.kind).toBe('acquisition');
    expect(feed.entries.map((e) => e.id)).toEqual(['79', '79#2']);
    const acq = feed.entries[0].acquisitions[0];
    expect(acq.kind).toBe('open-access');
    expect(acq.downloadable).toBe(true);
    expect(acq.formatLabel).toBe('EPUB');
    expect(acq.href.startsWith(`${KAVITA_BASE}/series/56/volume/78/chapter/79/download/`)).toBe(true);
    expect(acq.href).toContain('%20'); // already-encoded path kept as is
    expect(acq.title).toMatch(/^Cyclopaedia of Canadian Biography - Being/);
    expect(feed.entries[0].summary).toBe('File Type: epub+zip - 1.75 MB');
  });
});

describe('Komga (hand-made from docs)', () => {
  const feed = parseFeed(fixture('komga-series.xml'), 'https://komga.example.org/opds/v1.2/series/0FHPVA3SH5GKD');

  it('reads acquisitions and ignores page-streaming links', () => {
    expect(feed.kind).toBe('acquisition');
    expect(feed.totalResults).toBe(3);
    expect(feed.next).toBe('https://komga.example.org/opds/v1.2/series/0FHPVA3SH5GKD?page=1');
    const [vol1, vol2] = feed.entries;
    expect(vol1.acquisitions).toHaveLength(1);
    expect(vol1.acquisitions[0]).toMatchObject({ kind: 'generic', formatLabel: 'ZIP', downloadable: true });
    expect(vol1.thumbnailUrl).toBe('https://komga.example.org/opds/v1.2/books/0FHPVA3T15D1X/thumbnail/small');
    expect(vol2.coverUrl).toBeUndefined(); // the PSE stream link is not a cover
    expect(vol2.acquisitions[0].formatLabel).toBe('EPUB');
  });
});

describe('Calibre-Web (hand-made from docs)', () => {
  it('treats entries with a typed link and no rel as navigation', () => {
    const feed = parseFeed(fixture('calibre-web-root.xml'), 'http://192.168.1.10:8083/opds');
    expect(feed.kind).toBe('navigation');
    expect(feed.entries[0].navigation).toEqual({
      href: 'http://192.168.1.10:8083/opds/books',
      rel: 'alternate',
      type: 'application/atom+xml;profile=opds-catalog',
    });
    // the Atom template wins over the OpenSearch description; braces in the path survive resolution
    expect(feed.search).toEqual({ kind: 'template', template: 'http://192.168.1.10:8083/opds/search/{searchTerms}' });
  });

  it('reads books, keeps http, de-duplicates identical acquisitions', () => {
    const feed = parseFeed(fixture('calibre-web-new.xml'), 'http://192.168.1.10:8083/opds/new');
    expect(feed.kind).toBe('acquisition');
    expect(feed.next).toBe('http://192.168.1.10:8083/opds/new?offset=30');
    expect(feed.up).toBe('http://192.168.1.10:8083/opds');
    const [pride, timeMachine] = feed.entries;
    expect(pride.publisher).toBe('Standard Ebooks');
    expect(pride.language).toBe('eng');
    expect(pride.summary).toBe('Elizabeth Bennet meets Mr. Darcy.\n\nFirst impressions & second thoughts.');
    expect(pride.acquisitions.map((a) => a.formatLabel)).toEqual(['EPUB', 'Kobo EPUB', 'Kindle (AZW3)']);
    expect(pride.acquisitions[0].href).toBe('http://192.168.1.10:8083/opds/download/5/epub/');
    expect(timeMachine.acquisitions).toHaveLength(1);
  });
});

describe('edge cases (hand-made)', () => {
  const feedUrl = 'https://books.example.org/opds/index.xml';
  const feed = parseFeed(fixture('edge-cases.xml'), feedUrl);
  const book = feed.entries[0];

  it('reads atom:-prefixed elements and html titles', () => {
    expect(feed.title).toBe('Edge Cases');
    expect(feed.id).toBe('urn:edge');
    expect(feed.totalResults).toBe(42);
  });

  it('resolves links against feed and entry xml:base', () => {
    expect(feed.next).toBe('https://books.example.org/catalog/edge.xml?page=2'); // IANA rel URI
    expect(feed.previous).toBe('https://books.example.org/catalog/edge.xml?page=0'); // rel="prev"
    expect(feed.up).toBe('https://books.example.org/');
    expect(book.acquisitions[0].href).toBe('https://books.example.org/catalog/books/1.epub');
    expect(book.coverUrl).toBe('https://books.example.org/covers/1.jpg');
    expect(feed.search).toEqual({
      kind: 'template',
      template: 'https://books.example.org/catalog/search?q={searchTerms}&page={startPage?}',
    });
  });

  it('reads CDATA, entities, whitespace, DOCTYPE entities and xhtml content', () => {
    expect(book.title).toBe('Fish & Chips <Cookbook>');
    expect(book.authors).toEqual(['Ann Author', 'Bob Writer']);
    expect(book.publisher).toBe('Example House');
    expect(book.categories).toEqual(['cooking', 'Food & Drink']);
    expect(book.summary).toBe('First paragraph & more.\n\nSecond\nline.');
    expect(book.issued).toBe('1999');
  });

  it('classifies acquisitions: de-duplicates, hides buy/borrow and DRM from downloads', () => {
    const summary = book.acquisitions.map((a) => [a.kind, a.formatLabel, a.downloadable]);
    expect(summary).toEqual([
      ['open-access', 'EPUB', true],
      ['sample', 'PDF', true],
      ['buy', 'HTML', false],
      ['borrow', 'EPUB', false],
      ['generic', 'EPUB', false],
    ]);
    expect(book.acquisitions[0].size).toBe(1000);
    expect(book.acquisitions[3].indirectTypes).toEqual(['application/vnd.adobe.adept+xml', 'application/epub+zip']);
    expect(book.acquisitions[4].indirectTypes).toEqual(['application/epub+zip']);
  });

  it('reads facets', () => {
    expect(feed.facets).toEqual([
      {
        title: 'Newest',
        href: 'https://books.example.org/catalog/edge.xml?sort=new',
        group: 'Sort',
        active: true,
        count: 12,
      },
      {
        title: 'French',
        href: 'https://books.example.org/catalog/edge.xml?lang=fr',
        group: 'Language',
        active: false,
        count: 3,
      },
    ]);
  });

  it('never fails on missing fields', () => {
    const untitled = feed.entries[1];
    expect(untitled.title).toBe('Untitled');
    expect(untitled.id).toBe('https://books.example.org/catalog/untitled.epub');
    expect(untitled.authors).toEqual([]);
    expect(untitled.summary).toBeUndefined();
  });

  it('treats sort links as navigation and uses stanza thumbnails', () => {
    const sort = feed.entries[2];
    expect(sort.navigation?.href).toBe('https://books.example.org/catalog/popular.xml');
    expect(sort.thumbnailUrl).toBe('https://books.example.org/catalog/thumb.png');
    expect(feed.kind).toBe('acquisition'); // mixed feed
  });

  it('labels an HTML or Atom landing-page acquisition by its indirect format but does not download it', () => {
    const link = (type: string, href: string) =>
      `<link rel="http://opds-spec.org/acquisition/open-access" href="${href}" type="${type}">
         <opds:indirectAcquisition type="application/epub+zip"/></link>`;
    const xml = `<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opds="http://opds-spec.org/2010/catalog">
      <title>Landing</title><entry><title>Book</title><id>b</id>
      ${link('text/html', '/book/page')}${link('application/atom+xml;type=entry;profile=opds-catalog', '/book/entry')}
      <link rel="http://opds-spec.org/acquisition/open-access" href="/book.epub" type="application/epub+zip"/>
      </entry></feed>`;
    const [book] = parseFeed(xml, 'https://books.example.org/landing.xml').entries;
    expect(book.acquisitions.map((a) => [a.formatLabel, a.downloadable])).toEqual([
      ['EPUB', false],
      ['EPUB', false],
      ['EPUB', true],
    ]);
  });

  it('repairs duplicate ids without colliding with an original id', () => {
    const entry = (id: string) => `<entry><title>${id}</title><id>${id}</id></entry>`;
    const entries = ['x', 'x', 'x#2'].map(entry).join('');
    const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><title>Dupes</title>${entries}</feed>`;
    const ids = parseFeed(xml, 'https://books.example.org/dupes.xml').entries.map((e) => e.id);
    expect(ids).toEqual(['x', 'x#3', 'x#2']);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('documents and input errors', () => {
  it('wraps a single entry document into a one-entry acquisition feed', () => {
    const feed = parseFeed(fixture('single-entry.xml'), 'https://books.example.org/entries/single.xml');
    expect(feed.kind).toBe('acquisition');
    expect(feed.title).toBe('A Single Entry');
    expect(feed.entries).toHaveLength(1);
    expect(feed.entries[0].acquisitions[0].href).toBe('https://books.example.org/entries/single.epub');
  });

  it('accepts a feed without the Atom namespace declaration', () => {
    const feed = parseFeed('<feed><title>Bare</title><entry><title>A</title></entry></feed>', 'https://x.example/');
    expect(feed.title).toBe('Bare');
    expect(feed.entries[0].title).toBe('A');
    expect(feed.entries[0].id).toBe('entry-0');
  });

  it('accepts a byte order mark and leading whitespace', () => {
    const feed = parseFeed(
      '﻿\n  <?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>T</title></feed>',
      'https://x.example/',
    );
    expect(feed.title).toBe('T');
    expect(feed.entries).toEqual([]);
    expect(feed.kind).toBe('acquisition');
  });

  it.each([[''], ['   '], ['not xml at all'], ['{"metadata":{}}']])('throws parse for %j', (input) => {
    expect(() => parseFeed(input, 'https://x.example/')).toThrow(OpdsError);
    try {
      parseFeed(input, 'https://x.example/');
    } catch (e) {
      expect((e as OpdsError).code).toBe('parse');
    }
  });

  it('does not expand nested DOCTYPE entities (billion laughs)', () => {
    let entities = '<!ENTITY a0 "lollollollollollollollollollol">';
    for (let i = 1; i < 10; i += 1) entities += `<!ENTITY a${i} "${`&a${i - 1};`.repeat(10)}">`;
    const xml = `<?xml version="1.0"?><!DOCTYPE feed [${entities}]><feed xmlns="http://www.w3.org/2005/Atom"><title>&a9;</title></feed>`;
    expect(parseFeed(xml, 'https://x.example/').title.length).toBeLessThan(1000);
  });

  it('throws not-opds for XML that is not Atom', () => {
    expect(() => parseFeed(fixture('gutenberg-osd.xml'), 'https://x.example/')).toThrow(
      expect.objectContaining({ code: 'not-opds' }),
    );
  });

  it('turns html summaries into clamped-friendly plain text', () => {
    const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>  Lots \n of   space  </title>
      <summary type="html"><![CDATA[<p>One&nbsp;<b>bold</b></p><script>alert(1)</script><ul><li>a</li><li>b</li></ul>]]></summary>
      <link rel="http://opds-spec.org/acquisition" href="a.epub" type="application/epub+zip"/></entry></feed>`;
    const entry = parseFeed(xml, 'https://x.example/f').entries[0];
    expect(entry.title).toBe('Lots of space');
    expect(entry.summary).toBe('One bold\n\n• a\n• b');
  });
});
