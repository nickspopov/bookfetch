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
