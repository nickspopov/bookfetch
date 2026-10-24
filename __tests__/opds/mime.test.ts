/// <reference types="jest" />
import { decodeEntities, formatLabel, htmlToText, isDrmType } from '../../src/opds';

describe('formatLabel', () => {
  it.each([
    ['application/epub+zip', 'EPUB'],
    ['Application/EPUB+zip; charset=binary', 'EPUB'],
    ['application/kepub+zip', 'Kobo EPUB'],
    ['application/pdf', 'PDF'],
    ['application/x-mobipocket-ebook', 'Kindle (MOBI)'],
    ['application/vnd.amazon.ebook', 'Kindle (AZW3)'],
    ['application/x-mobi8-ebook', 'Kindle (AZW3)'],
    ['application/x-fictionbook+xml', 'FB2'],
    ['text/fb2+xml', 'FB2'],
    ['application/fb2+zip', 'FB2 (zip)'],
    ['application/vnd.comicbook+zip', 'CBZ'],
    ['application/x-cbz', 'CBZ'],
    ['application/x-cbr', 'CBR'],
    ['application/vnd.comicbook-rar', 'CBR'],
    ['image/vnd.djvu', 'DjVu'],
    ['text/plain', 'Text'],
    ['text/plain; charset=utf-8', 'Text'],
    ['text/html', 'HTML'],
    ['application/rtf', 'RTF'],
    ['application/zip', 'ZIP'],
    ['audio/mpeg', 'Audio'],
    ['audio/mp4; codecs=mp4a', 'Audio'],
    ['application/x-chm', 'CHM'],
    ['application/x-something-quite-long', 'SOMETHING-QU'],
    ['application/vnd.example', 'EXAMPLE'],
    ['', 'File'],
    ['garbage', 'File'],
  ])('%j -> %s', (mime, label) => {
    expect(formatLabel(mime)).toBe(label);
  });
});

describe('isDrmType', () => {
  it.each([
    ['application/vnd.adobe.adept+xml', true],
    ['application/vnd.readium.lcp.license.v1.0+json', true],
    ['application/vnd.readium.lcp.license.v1.0+json; charset=utf-8', true],
    ['application/epub+zip', false],
    ['application/pdf', false],
    ['text/html', false],
  ])('%s -> %s', (mime, drm) => {
    expect(isDrmType(mime)).toBe(drm);
  });
});

describe('htmlToText / decodeEntities', () => {
  it('decodes numeric and named entities, leaves unknown ones', () => {
    expect(decodeEntities('&amp; &#233; &#x263A; &rsquo; &unknown; &#0;')).toBe('& é ☺ ’ &unknown; ');
  });

  it('keeps paragraph breaks, line breaks and list items; drops scripts and comments', () => {
    const html = '<div><p>One\n  two</p><!-- x --><p>Three<br>four</p><script>var a = "<p>";</script><ol><li>x</li></ol></div>';
    expect(htmlToText(html)).toBe('One two\n\nThree\nfour\n\n• x');
  });

  it('returns empty text for empty markup', () => {
    expect(htmlToText('<p> </p><div></div>')).toBe('');
  });
});
