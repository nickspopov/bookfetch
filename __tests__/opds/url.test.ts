/// <reference types="jest" />
import { OpdsError, normalizeCatalogUrl, originOf, resolveUrl } from '../../src/opds';

describe('resolveUrl (RFC 3986)', () => {
  const base = 'http://a/b/c/d;p?q';
  // RFC 3986 section 5.4 reference resolution examples
  it.each([
    ['g:h', 'g:h'],
    ['g', 'http://a/b/c/g'],
    ['./g', 'http://a/b/c/g'],
    ['g/', 'http://a/b/c/g/'],
    ['/g', 'http://a/g'],
    ['//g', 'http://g'],
    ['?y', 'http://a/b/c/d;p?y'],
    ['g?y', 'http://a/b/c/g?y'],
    ['#s', 'http://a/b/c/d;p?q#s'],
    ['g#s', 'http://a/b/c/g#s'],
    [';x', 'http://a/b/c/;x'],
    ['', 'http://a/b/c/d;p?q'],
    ['.', 'http://a/b/c/'],
    ['./', 'http://a/b/c/'],
    ['..', 'http://a/b/'],
    ['../', 'http://a/b/'],
    ['../g', 'http://a/b/g'],
    ['../..', 'http://a/'],
    ['../../g', 'http://a/g'],
    ['../../../g', 'http://a/g'],
    ['/./g', 'http://a/g'],
    ['/../g', 'http://a/g'],
    ['g.', 'http://a/b/c/g.'],
    ['..g', 'http://a/b/c/..g'],
    ['./../g', 'http://a/b/g'],
    ['g/./h', 'http://a/b/c/g/h'],
    ['g/../h', 'http://a/b/c/h'],
    ['g;x=1/../y', 'http://a/b/c/y'],
  ])('%s -> %s', (ref, expected) => {
    expect(resolveUrl(ref, base)).toBe(expected);
  });

  it('keeps http (no upgrade), ports and query strings', () => {
    expect(resolveUrl('/opds/download/5/epub/?x=1&y=2', 'http://192.168.1.10:8083/opds')).toBe(
      'http://192.168.1.10:8083/opds/download/5/epub/?x=1&y=2',
    );
  });

  it('percent-encodes spaces and non-ASCII characters but keeps existing escapes', () => {
    expect(resolveUrl('My Book.epub', 'https://x.example/files/')).toBe('https://x.example/files/My%20Book.epub');
    expect(resolveUrl('Bücher/%20a.epub', 'https://x.example/')).toBe('https://x.example/B%C3%BCcher/%20a.epub');
  });

  it('passes data: URIs through and returns undefined without a usable base', () => {
    expect(resolveUrl('data:image/png;base64,AAA=', 'https://x.example/')).toBe('data:image/png;base64,AAA=');
    expect(resolveUrl('relative', undefined)).toBeUndefined();
    expect(resolveUrl(undefined, 'https://x.example/')).toBeUndefined();
  });
});

describe('originOf', () => {
  it.each([
    ['https://Example.org/opds?x', 'https://example.org'],
    ['https://example.org:443/a', 'https://example.org'],
    ['http://example.org:80/a', 'http://example.org'],
    ['http://user:pw@192.168.1.10:8083/opds', 'http://192.168.1.10:8083'],
    ['http://[::1]:8080/', 'http://[::1]:8080'],
    ['data:text/plain,x', ''],
    ['not a url', ''],
  ])('%s -> %j', (url, origin) => {
    expect(originOf(url)).toBe(origin);
  });
});

describe('normalizeCatalogUrl', () => {
  it.each([
    ['  books.example.org/opds  ', 'https://books.example.org/opds'],
    ['books.example.org', 'https://books.example.org/'],
    ['HTTP://Books.Example.org/OPDS?Key=A', 'http://books.example.org/OPDS?Key=A'],
    ['http://192.168.1.10:8083/opds', 'http://192.168.1.10:8083/opds'],
    ['192.168.1.10:8083/opds', 'https://192.168.1.10:8083/opds'],
    ['localhost:5000/api/opds/abc', 'https://localhost:5000/api/opds/abc'],
    ['localhost', 'https://localhost/'],
    ['opds://books.example.org/catalog', 'https://books.example.org/catalog'],
    ['opds+https://books.example.org/catalog', 'https://books.example.org/catalog'],
    ['opds+http://books.example.org/catalog', 'http://books.example.org/catalog'],
    ['https://demo.kavitareader.com/api/opds/9003cf99-9213-4206-a787-af2fe4cc5f1f', 'https://demo.kavitareader.com/api/opds/9003cf99-9213-4206-a787-af2fe4cc5f1f'],
    ['https://www.gutenberg.org/ebooks.opds/', 'https://www.gutenberg.org/ebooks.opds/'],
  ])('%j -> %s', (input, expected) => {
    expect(normalizeCatalogUrl(input)).toBe(expected);
  });

  it.each([
    [''],
    ['   '],
    ['books example.org'],
    ['javascript:alert(1)'],
    ['file:///etc/passwd'],
    ['data:text/html,hi'],
    ['ftp://books.example.org/'],
    ['mailto:someone@example.org'],
    ['https://'],
    ['https://exa mple.org'],
    ['https://example.org:99999/'],
    ['/relative/path'],
  ])('rejects %j with invalid-url', (input) => {
    let error: unknown;
    try {
      normalizeCatalogUrl(input);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(OpdsError);
    expect((error as OpdsError).code).toBe('invalid-url');
  });
});
