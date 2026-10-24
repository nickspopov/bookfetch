import { baseFileName, extensionFor, uniqueFileName } from '../downloads/file-name';

describe('baseFileName', () => {
  it('joins title and first author', () => {
    expect(baseFileName('Pride and Prejudice', ['Jane Austen', 'Someone Else'])).toBe(
      'Pride and Prejudice - Jane Austen',
    );
  });

  it('strips characters file systems reject', () => {
    expect(baseFileName('What/Is: "This"? <A|B>*\\', [])).toBe('What Is This A B');
  });

  it('removes control characters, leading dots and trailing dots', () => {
    expect(baseFileName('..hidden\u0007 title...', [])).toBe('hidden title');
  });

  it('caps the length at 120 characters', () => {
    const name = baseFileName('x'.repeat(300), ['Author']);
    expect(name.length).toBeLessThanOrEqual(120);
  });

  it('never returns an empty name', () => {
    expect(baseFileName('   ', [])).toBe('Untitled');
    expect(baseFileName('???', [])).toBe('Book');
  });
});

describe('extensionFor', () => {
  it('prefers the MIME type', () => {
    expect(extensionFor('application/epub+zip', 'https://x/download')).toBe('epub');
    expect(extensionFor('application/pdf; charset=binary', 'https://x/file.epub')).toBe('pdf');
    expect(extensionFor('application/x-mobipocket-ebook', '')).toBe('mobi');
  });

  it('falls back to the URL', () => {
    expect(extensionFor('', 'https://x/books/12.cbz?token=1')).toBe('cbz');
    expect(extensionFor('application/octet-stream', 'https://www.gutenberg.org/ebooks/1342.epub3.images')).toBe('epub');
    expect(extensionFor('', 'https://www.gutenberg.org/ebooks/1342.kf8.images')).toBe('azw3');
    expect(extensionFor('', 'https://x/book.kepub.epub')).toBe('kepub.epub');
  });

  it.each([
    ['application/x-mobipocket-ebook', 'https://calibre.example.com/get/azw3/12/Library', 'mobi'],
    ['application/x-mobipocket-ebook', 'https://calibre.example.com/download/12/book.azw3', 'azw3'],
    ['application/x-mobipocket-ebook', 'https://x/book.AZW3?token=1', 'azw3'],
    ['application/x-mobipocket-ebook', 'https://x/book.azw', 'azw'],
    ['application/x-mobipocket-ebook', 'https://x/book.mobi', 'mobi'],
    ['application/octet-stream', 'https://x/book.kepub.epub', 'kepub.epub'],
    ['application/octet-stream', 'https://x/book.fb2.zip', 'fb2.zip'],
    ['application/zip', 'https://x/book.fb2.zip', 'fb2.zip'],
    ['application/zip', 'https://x/comic.cbz', 'cbz'],
    ['application/zip', 'https://x/archive.zip', 'zip'],
    ['application/zip', 'https://x/download/5', 'zip'],
    ['application/octet-stream', 'https://x/book.pdf', 'pdf'],
    ['application/octet-stream', 'https://x/book.djvu', 'djvu'],
    ['application/octet-stream', 'https://x/book.fb2', 'fb2'],
    ['application/octet-stream', 'https://x/book.cb7', 'cb7'],
    ['application/octet-stream', 'https://x/book.cbr', 'cbr'],
    ['application/octet-stream', 'https://x/book.txt', 'txt'],
    ['application/octet-stream', 'https://x/book.rtf', 'rtf'],
    ['', 'https://x/book.azw3', 'azw3'],
    ['application/octet-stream; charset=binary', 'https://x/book.epub#top', 'epub'],
    // A specific MIME type still wins over the URL.
    ['application/epub+zip', 'https://x/book.azw3', 'epub'],
    ['application/pdf', 'https://x/book.epub', 'pdf'],
  ])('maps %s at %s to .%s', (mime, url, ext) => {
    expect(extensionFor(mime, url)).toBe(ext);
  });

  it('uses bin when nothing is known', () => {
    expect(extensionFor('', 'https://x/download/5')).toBe('bin');
  });
});

describe('uniqueFileName', () => {
  it('adds a counter when the name is taken', () => {
    const taken = new Set(['Emma.epub', 'Emma (2).epub']);
    expect(uniqueFileName('Emma', 'epub', (n) => taken.has(n))).toBe('Emma (3).epub');
    expect(uniqueFileName('Persuasion', 'epub', (n) => taken.has(n))).toBe('Persuasion.epub');
  });
});
