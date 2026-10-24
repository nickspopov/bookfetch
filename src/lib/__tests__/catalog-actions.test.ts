import type { Feed } from '@/opds';

import { connectCatalog } from '../catalog-actions';
import { catalogStore } from '../catalogs';
import { memory } from './mmkv-mock';

jest.mock('react-native-mmkv', () => jest.requireActual('./mmkv-mock').mmkvMock);

const mockSecure = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK: 0,
  getItemAsync: jest.fn(async (key: string) => mockSecure.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => void mockSecure.set(key, value)),
  deleteItemAsync: jest.fn(async (key: string) => void mockSecure.delete(key)),
}));

const mockFetchFeed = jest.fn<Promise<Feed>, [string]>();
jest.mock('../client', () => ({
  ...jest.requireActual('../client'),
  makeClient: () => ({ fetchFeed: mockFetchFeed }),
}));

const KAVITA_KEY = '9003cf99-9213-4206-a787-af2fe4cc5f1f';

const feed = (url: string, extra: Partial<Feed> = {}): Feed => ({
  url,
  title: 'Library',
  kind: 'navigation',
  entries: [],
  facets: [],
  ...extra,
});

beforeEach(() => {
  memory.clear();
  mockSecure.clear();
  catalogStore.reset();
  mockFetchFeed.mockReset();
});

describe('connectCatalog icon', () => {
  it('does not store the icon of a catalog whose URL carries a key', async () => {
    const url = `https://kavita.example.com/api/opds/${KAVITA_KEY}`;
    mockFetchFeed.mockResolvedValue(
      feed(url, { iconUrl: `https://kavita.example.com/api/opds/${KAVITA_KEY}/favicon` }),
    );
    const { catalog } = await connectCatalog({ url });
    expect(catalog.urlInKeychain).toBe(true);
    expect(catalog.iconUrl).toBeUndefined();
    expect(memory.get('catalogs')).not.toContain(KAVITA_KEY);
  });

  it('does not store an icon URL that carries a key of its own', async () => {
    const url = 'https://books.example.com/opds';
    mockFetchFeed.mockResolvedValue(feed(url, { iconUrl: 'https://books.example.com/icon.png?apikey=abc123' }));
    const { catalog } = await connectCatalog({ url });
    expect(catalog.iconUrl).toBeUndefined();
  });

  it('keeps a plain icon URL', async () => {
    const url = 'https://books.example.com/opds';
    mockFetchFeed.mockResolvedValue(feed(url, { iconUrl: 'https://books.example.com/favicon.ico' }));
    const { catalog } = await connectCatalog({ url });
    expect(catalog.iconUrl).toBe('https://books.example.com/favicon.ico');
  });
});
