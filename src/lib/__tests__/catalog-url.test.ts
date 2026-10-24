import { REDACTED, hashString, redactUrl, splitUserInfo } from '../catalog-url';
import { cleanText, formatBytes } from '../text';

describe('redactUrl', () => {
  it('hides a Kavita API key in the path', () => {
    const url = 'https://demo.kavitareader.com/api/opds/9003cf99-9213-4206-a787-af2fe4cc5f1f';
    expect(redactUrl(url)).toEqual({ redacted: `https://demo.kavitareader.com/api/opds/${REDACTED}`, secret: true });
  });

  it('hides key-like query parameters', () => {
    expect(redactUrl('http://lan:8080/opds?apikey=abc123&x=1')).toEqual({
      redacted: `http://lan:8080/opds?apikey=${REDACTED}&x=1`,
      secret: true,
    });
  });

  it('leaves ordinary URLs alone', () => {
    for (const url of [
      'https://www.gutenberg.org/ebooks.opds/',
      'https://komga.example.com/opds/v1.2/catalog',
      'https://bookfetch.nickpopov.com/opds/catalog.xml',
    ]) {
      expect(redactUrl(url)).toEqual({ redacted: url, secret: false });
    }
  });
});

describe('splitUserInfo', () => {
  it('moves a login out of the URL', () => {
    expect(splitUserInfo('https://me:p%40ss@books.example.com/opds')).toEqual({
      url: 'https://books.example.com/opds',
      username: 'me',
      password: 'p@ss',
    });
  });

  it('keeps URLs without a login', () => {
    expect(splitUserInfo('books.example.com/opds')).toEqual({ url: 'books.example.com/opds' });
  });
});

describe('hashString', () => {
  it('is stable and distinguishes links', () => {
    expect(hashString('https://a/1.epub')).toBe(hashString('https://a/1.epub'));
    expect(hashString('https://a/1.epub')).not.toBe(hashString('https://a/2.epub'));
  });
});

describe('cleanText', () => {
  it('strips HTML, entities and odd whitespace', () => {
    expect(cleanText('<p>Hello&nbsp;&amp;\n\n  <b>world</b>&#8217;s</p>')).toBe('Hello & world’s');
    expect(cleanText(undefined)).toBe('');
  });

  it('keeps paragraphs when asked', () => {
    expect(cleanText('<p>One</p><p>Two</p>', true)).toBe('One\nTwo');
  });
});

describe('formatBytes', () => {
  it('formats sizes', () => {
    expect(formatBytes(0)).toBe('');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});
