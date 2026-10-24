import { CATALOGS_SCHEMA, catalogStore, hostOf, parseCatalogs, type Catalog } from '../catalogs';
import { parseVersioned } from '../storage';
import { memory } from './mmkv-mock';

jest.mock('react-native-mmkv', () => jest.requireActual('./mmkv-mock').mmkvMock);

const catalog = (id: string, extra: Partial<Catalog> = {}): Catalog => ({
  id,
  url: `https://books${id}.example.com/opds`,
  urlInKeychain: false,
  title: `Library ${id}`,
  hasCredentials: false,
  addedAt: 1,
  ...extra,
});

beforeEach(() => {
  memory.clear();
  catalogStore.reset();
});

describe('parseVersioned', () => {
  it('returns undefined for missing, corrupt or foreign data', () => {
    expect(parseVersioned(undefined, 1)).toBeUndefined();
    expect(parseVersioned('', 1)).toBeUndefined();
    expect(parseVersioned('{not json', 1)).toBeUndefined();
    expect(parseVersioned('null', 1)).toBeUndefined();
    expect(parseVersioned('[1,2]', 1)).toBeUndefined();
    expect(parseVersioned('{"schema":2,"items":[]}', 1)).toBeUndefined();
    expect(parseVersioned('{"schema":1,"items":{}}', 1)).toBeUndefined();
  });

  it('returns the items of the matching schema', () => {
    expect(parseVersioned('{"schema":1,"items":[{"a":1}]}', 1)).toEqual([{ a: 1 }]);
  });
});

describe('parseCatalogs', () => {
  it('keeps well-formed catalogs and drops the rest', () => {
    const result = parseCatalogs([
      catalog('1'),
      null,
      42,
      { id: '', url: 'https://x.example.com' },
      { id: '2', url: 'ftp://nope.example.com' },
      { id: '3', url: 'http://lan.local:8080/opds', title: '   ', hasCredentials: 'yes' },
      catalog('1', { title: 'Duplicate' }),
    ]);
    expect(result.map((c) => c.id)).toEqual(['1', '3']);
    expect(result[1]).toEqual({
      id: '3',
      url: 'http://lan.local:8080/opds',
      title: 'lan.local:8080',
      iconUrl: undefined,
      urlInKeychain: false,
      hasCredentials: false,
      addedAt: 0,
    });
  });

  it('drops icon URLs of keyed catalogs and icon URLs that carry a key', () => {
    const result = parseCatalogs([
      catalog('k', { urlInKeychain: true, iconUrl: 'https://kavita.example.com/api/opds/x/favicon' }),
      catalog('q', { iconUrl: 'https://books.example.com/icon.png?token=abc' }),
      catalog('p', { iconUrl: 'https://books.example.com/favicon.ico' }),
    ]);
    expect(result.map((c) => c.iconUrl)).toEqual([undefined, undefined, 'https://books.example.com/favicon.ico']);
  });

  it('treats missing data as an empty list', () => {
    expect(parseCatalogs(undefined)).toEqual([]);
  });
});

describe('catalogStore', () => {
  it('starts empty when storage holds garbage', () => {
    memory.set('catalogs', '\u0000garbage');
    expect(catalogStore.all()).toEqual([]);
  });

  it('persists adds, updates and removals across reloads', () => {
    catalogStore.add(catalog('a'));
    catalogStore.add(catalog('b'));
    catalogStore.update('a', { title: 'Renamed' });
    catalogStore.reset();
    expect(catalogStore.all().map((c) => [c.id, c.title])).toEqual([
      ['a', 'Renamed'],
      ['b', 'Library b'],
    ]);
    expect(JSON.parse(memory.get('catalogs')!).schema).toBe(CATALOGS_SCHEMA);

    catalogStore.remove('a');
    catalogStore.remove('b');
    catalogStore.reset();
    expect(catalogStore.all()).toEqual([]);
  });
});

describe('hostOf', () => {
  it('drops scheme, login and path', () => {
    expect(hostOf('https://user:pw@books.example.com:8443/opds?x=1')).toBe('books.example.com:8443');
  });
});
