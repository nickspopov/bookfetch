/// <reference types="jest" />
import { buildSearchUrl, parseOpenSearchDescription } from '../../src/opds';
import { KAVITA_BASE, fixture } from './helpers';

describe('parseOpenSearchDescription', () => {
  it('picks the Atom template from the Gutenberg description (keeping http as given)', () => {
    expect(
      parseOpenSearchDescription(fixture('gutenberg-osd.xml'), 'https://www.gutenberg.org/catalog/osd-books.xml'),
    ).toEqual({
      kind: 'template',
      template: 'http://m.gutenberg.org/ebooks/search.opds/?query={searchTerms}',
    });
  });

  it('resolves the relative Kavita template against the description URL', () => {
    expect(parseOpenSearchDescription(fixture('kavita-search-osd.xml'), `${KAVITA_BASE}/search`)).toEqual({
      kind: 'template',
      template: `${KAVITA_BASE}/series?query={searchTerms}`,
    });
  });

  it('prefers profile=opds-catalog and kind=acquisition, skips suggestions, reads offsets', () => {
    const xml = `<?xml version="1.0"?>
      <os:OpenSearchDescription xmlns:os="http://a9.com/-/spec/opensearch/1.1/">
        <os:Url type="application/atom+xml" rel="suggestions" template="/suggest?q={searchTerms}"/>
        <os:Url type="application/atom+xml" template="/plain?q={searchTerms}"/>
        <os:Url type="application/atom+xml;profile=opds-catalog;kind=acquisition" indexOffset="1" template="/opds/{searchTerms}/{startPage?}"/>
        <os:Url type="text/html" template="/html?q={searchTerms}"/>
      </os:OpenSearchDescription>`;
    expect(parseOpenSearchDescription(xml, 'https://books.example.org/opds/osd')).toEqual({
      kind: 'template',
      template: 'https://books.example.org/opds/{searchTerms}/{startPage?}',
      indexOffset: 1,
    });
  });

  it('returns undefined for documents without an Atom template or for non-XML', () => {
    const htmlOnly = `<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
      <Url type="text/html" template="https://x.example/?q={searchTerms}"/></OpenSearchDescription>`;
    expect(parseOpenSearchDescription(htmlOnly, 'https://x.example/')).toBeUndefined();
    expect(parseOpenSearchDescription('<html><body>nope</body></html>', 'https://x.example/')).toBeUndefined();
    expect(parseOpenSearchDescription('', 'https://x.example/')).toBeUndefined();
  });
});

describe('buildSearchUrl', () => {
  it.each([
    ['https://x.example/s?q={searchTerms}', 'jane austen', 'https://x.example/s?q=jane%20austen'],
    ['https://x.example/s?q={searchTerms}', 'tom & jerry/1?', 'https://x.example/s?q=tom%20%26%20jerry%2F1%3F'],
    [
      'https://x.example/s?q={searchTerms}',
      'Достоевский',
      'https://x.example/s?q=%D0%94%D0%BE%D1%81%D1%82%D0%BE%D0%B5%D0%B2%D1%81%D0%BA%D0%B8%D0%B9',
    ],
    ['http://192.168.1.10:8083/opds/search/{searchTerms}', 'dune', 'http://192.168.1.10:8083/opds/search/dune'],
    ['https://x.example/s?q={searchTerms}&page={startPage?}', 'a', 'https://x.example/s?q=a'],
    ['https://x.example/s?page={startPage?}&q={searchTerms}&n={count?}', 'a', 'https://x.example/s?q=a'],
    ['https://x.example/s?q={searchTerms}&p={startPage}', 'a', 'https://x.example/s?q=a&p=1'],
    ['https://x.example/s?q={searchTerms}&i={startIndex}', 'a', 'https://x.example/s?q=a&i=0'],
    ['https://x.example/s?q={searchTerms}&n={count}&l={language}', 'a', 'https://x.example/s?q=a&n=20&l=*'],
    ['https://x.example/s?q={searchTerms}&a={atom:author?}&x={custom}', 'a', 'https://x.example/s?q=a'],
    ['https://x.example/s/{searchTerms}/{startPage?}', 'a', 'https://x.example/s/a/'],
    ['https://x.example/s?q={searchTerms}#frag', 'a', 'https://x.example/s?q=a#frag'],
    ['https://x.example/s?key=abc&q={searchTerms}', '  padded  ', 'https://x.example/s?key=abc&q=padded'],
  ])('%s + %j -> %s', (template, query, expected) => {
    expect(buildSearchUrl(template, query)).toBe(expected);
  });

  it('uses the description offsets for required index and page parameters', () => {
    expect(
      buildSearchUrl('https://x.example/s?q={searchTerms}&i={startIndex}&p={startPage}', 'a', {
        indexOffset: 1,
        pageOffset: 0,
      }),
    ).toBe('https://x.example/s?q=a&i=1&p=0');
  });
});
