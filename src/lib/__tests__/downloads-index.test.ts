import { downloadIndex, hrefKeyOf, parseDownloads, type DownloadRecord } from '../downloads/index-store';
import { memory } from './mmkv-mock';

jest.mock('react-native-mmkv', () => jest.requireActual('./mmkv-mock').mmkvMock);

const record = (id: string, extra: Partial<DownloadRecord> = {}): DownloadRecord => ({
  id,
  fileName: `Book ${id}.epub`,
  title: `Book ${id}`,
  authors: ['Jane Austen'],
  mimeType: 'application/epub+zip',
  formatLabel: 'EPUB',
  size: 1000,
  catalogId: 'c1',
  catalogTitle: 'Gutenberg',
  hrefKey: hrefKeyOf(`https://example.com/${id}.epub`),
  downloadedAt: 1,
  ...extra,
});

beforeEach(() => {
  memory.clear();
  downloadIndex.reset();
});

describe('downloadIndex', () => {
  it('adds newest first and finds records by link', () => {
    downloadIndex.add(record('1'));
    downloadIndex.add(record('2'));
    expect(downloadIndex.all().map((r) => r.id)).toEqual(['2', '1']);
    expect(downloadIndex.findByHref('https://example.com/1.epub')?.id).toBe('1');
    expect(downloadIndex.findByHref('https://example.com/3.epub')).toBeUndefined();
  });

  it('removes records and persists the change', () => {
    downloadIndex.add(record('1'));
    downloadIndex.add(record('2'));
    downloadIndex.remove('1');
    downloadIndex.reset();
    expect(downloadIndex.all().map((r) => r.id)).toEqual(['2']);
    downloadIndex.remove('2');
    downloadIndex.reset();
    expect(downloadIndex.all()).toEqual([]);
  });

  it('checks file names case-insensitively', () => {
    downloadIndex.add(record('1'));
    expect(downloadIndex.hasFileName('book 1.EPUB')).toBe(true);
    expect(downloadIndex.hasFileName('Book 2.epub')).toBe(false);
  });

  it('prunes records whose files no longer exist', () => {
    downloadIndex.add(record('1'));
    downloadIndex.add(record('2'));
    downloadIndex.prune((r) => r.id !== '1');
    expect(downloadIndex.all().map((r) => r.id)).toEqual(['2']);
  });

  it('does not store the download link itself', () => {
    downloadIndex.add(record('1'));
    expect(memory.get('downloads')).not.toContain('example.com');
  });
});

describe('parseDownloads', () => {
  it('drops malformed records and fills defaults', () => {
    const result = parseDownloads([
      record('1'),
      'junk',
      { id: '2' },
      { id: '3', fileName: '../escape.epub' },
      { id: '4', fileName: 'ok.pdf', authors: ['A', 3], size: 'big' },
      record('1'),
    ]);
    expect(result.map((r) => r.id)).toEqual(['1', '4']);
    expect(result[1]).toMatchObject({ title: 'ok.pdf', authors: ['A'], size: 0 });
  });

  it('survives corrupt storage', () => {
    memory.set('downloads', '{"schema":1,"items":"nope"}');
    expect(downloadIndex.all()).toEqual([]);
  });
});
