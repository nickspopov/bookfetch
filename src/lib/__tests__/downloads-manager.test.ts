import type { Acquisition, Entry } from '@/opds';

import type { Catalog } from '../catalogs';
import { downloadIndex } from '../downloads/index-store';
import { activeDownloadFor, isUnexpectedHtml, startDownload } from '../downloads/manager';
import { memory } from './mmkv-mock';

jest.mock('react-native-mmkv', () => jest.requireActual('./mmkv-mock').mmkvMock);

jest.mock('../client', () => ({
  sessionFor: async () => ({ client: { headersFor: () => ({}) }, rootUrl: '', sentCredentials: false }),
}));

// In-memory stand-in for expo-file-system's File/Directory API. Like the native module, `move` settles later.
const mockFiles = new Map<string, Uint8Array>();
const mockNextBody = { bytes: new Uint8Array() };
jest.mock('expo-file-system', () => {
  const join = (parts: unknown[]) =>
    parts.map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri)).join('/');
  class MockDirectory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    exists = true;
    create() {}
    delete() {}
  }
  class MockFile {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    get size() {
      return mockFiles.get(this.uri)?.length ?? 0;
    }
    delete() {
      mockFiles.delete(this.uri);
    }
    async move(destination: MockFile) {
      await Promise.resolve();
      const bytes = mockFiles.get(this.uri);
      if (!bytes) throw new Error('Source file is missing');
      mockFiles.delete(this.uri);
      mockFiles.set(destination.uri, bytes);
      this.uri = destination.uri;
    }
    open() {
      const bytes = mockFiles.get(this.uri) ?? new Uint8Array();
      return { readBytes: (n: number) => bytes.slice(0, n), close() {} };
    }
    static async downloadFileAsync(_url: string, destination: MockFile) {
      mockFiles.set(destination.uri, mockNextBody.bytes);
      return destination;
    }
  }
  return { File: MockFile, Directory: MockDirectory, Paths: { document: 'doc', cache: 'cache' } };
});

const bytes = (text: string) => Uint8Array.from(text, (c) => c.charCodeAt(0));

const catalog: Catalog = {
  id: 'c1',
  url: 'https://books.example.com/opds',
  urlInKeychain: false,
  title: 'Books',
  hasCredentials: false,
  sessionRevision: 1,
  addedAt: 1,
};

const acquisition = (href: string, type = 'application/epub+zip'): Acquisition => ({
  href,
  type,
  kind: 'open-access',
  indirectTypes: [],
  formatLabel: 'EPUB',
  downloadable: true,
});

const entry = (a: Acquisition): Entry => ({
  id: 'urn:1',
  title: 'Emma',
  authors: ['Jane Austen'],
  categories: [],
  acquisitions: [a],
});

const downloadedFiles = () => [...mockFiles.keys()].filter((uri) => uri.startsWith('doc/'));

beforeEach(() => {
  memory.clear();
  mockFiles.clear();
  downloadIndex.reset();
  mockNextBody.bytes = bytes('PK\u0003\u0004 epub');
});

describe('startDownload index write', () => {
  it('indexes the book only once its file is in place', async () => {
    const a = acquisition('https://books.example.com/emma.epub');
    const add = jest.spyOn(downloadIndex, 'add');
    add.mockImplementation(() => {
      expect(downloadedFiles()).toEqual(['doc/Bookfetch/Emma - Jane Austen.epub']);
    });
    await startDownload(catalog, entry(a), a);
    expect(add).toHaveBeenCalledTimes(1);
    expect(activeDownloadFor(a.href)).toBeUndefined();
    add.mockRestore();
  });

  it('deletes the moved file and reports a failure when the index write throws', async () => {
    const a = acquisition('https://books.example.com/persuasion.epub');
    const add = jest.spyOn(downloadIndex, 'add').mockImplementation(() => {
      throw new Error('MMKV write failed');
    });
    await startDownload(catalog, entry(a), a);
    expect(downloadedFiles()).toEqual([]);
    expect(activeDownloadFor(a.href)).toMatchObject({ status: 'failed' });
    add.mockRestore();
  });
});

describe('startDownload HTML check', () => {
  it.each([
    '<!-- served by nginx -->\n<!DOCTYPE html><html></html>',
    '<?xml version="1.0"?>\n<html xmlns="http://www.w3.org/1999/xhtml">',
    '\xEF\xBB\xBF  <head><title>Login</title></head>',
    '\n\n<BODY>Sign in</BODY>',
  ])('rejects a web page served for a book: %j', async (body) => {
    const a = acquisition(`https://books.example.com/${encodeURIComponent(body.slice(0, 12))}.epub`);
    mockNextBody.bytes = bytes(body);
    await startDownload(catalog, entry(a), a);
    expect(activeDownloadFor(a.href)).toEqual({
      status: 'failed',
      message: 'The server sent a web page instead of the book. It may need a login.',
      needsLogin: false,
    });
    expect(downloadedFiles()).toEqual([]);
  });

  it('keeps an XML book such as FB2', async () => {
    const a = acquisition('https://books.example.com/emma.fb2', 'application/x-fictionbook+xml');
    mockNextBody.bytes = bytes('<?xml version="1.0" encoding="utf-8"?>\n<FictionBook>');
    await startDownload(catalog, entry(a), a);
    expect(downloadedFiles()).toEqual(['doc/Bookfetch/Emma - Jane Austen.fb2']);
  });

  it('keeps an HTML book when HTML was expected', async () => {
    const a = acquisition('https://books.example.com/emma.html', 'text/html; charset=utf-8');
    mockNextBody.bytes = bytes('<!doctype html><html>');
    await startDownload(catalog, entry(a), a);
    expect(downloadedFiles()).toEqual(['doc/Bookfetch/Emma - Jane Austen.html']);
  });
});

describe('isUnexpectedHtml', () => {
  it.each([
    ['<!doctype html>', true],
    ['<!DOCTYPE  HTML PUBLIC "-//W3C//DTD HTML 4.01//EN">', true],
    ['<html>', true],
    ['<html lang="en">', true],
    ['<head>', true],
    ['<body class="x">', true],
    ['\xEF\xBB\xBF<html>', true],
    [' \t\r\n<html>', true],
    ['<?xml version="1.0"?><!-- a --> <!-- b --><html>', true],
    ['<?XML version="1.0"?>\n<!DOCTYPE html>', true],
    ['<header>', false],
    ['<htmlish>', false],
    ['<?xml version="1.0"?><FictionBook>', false],
    ['<!-- never closed <html>', false],
    ['<?xml never closed <html>', false],
    ['PK\u0003\u0004', false],
    ['%PDF-1.7', false],
    ['', false],
  ])('%j -> %s', (head, expected) => {
    expect(isUnexpectedHtml(bytes(head), 'application/epub+zip')).toBe(expected);
  });

  it('never rejects acquisitions that are meant to be HTML', () => {
    expect(isUnexpectedHtml(bytes('<html>'), 'text/html')).toBe(false);
    expect(isUnexpectedHtml(bytes('<html>'), 'application/xhtml+xml; charset=utf-8')).toBe(false);
  });

  it('checks HTML for other types that merely mention html', () => {
    expect(isUnexpectedHtml(bytes('<html>'), 'application/x-not-html-book')).toBe(true);
  });
});
