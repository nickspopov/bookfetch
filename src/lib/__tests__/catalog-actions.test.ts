import { Alert } from 'react-native';

import { removeCatalogWithFeedback } from '@/features/remove-catalog';
import type { Feed } from '@/opds';

import { connectCatalog, removeCatalog, StaleConnectError } from '../catalog-actions';
import { catalogStore } from '../catalogs';
import { deleteCredentials, deleteSecretUrl } from '../credentials';
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

describe('connectCatalog stale completions', () => {
  const url = 'https://books.example.com/opds';
  const credentials = { username: 'ann', password: 'secret' };

  function deferredFeed() {
    let resolve!: (value: Feed) => void;
    mockFetchFeed.mockReturnValueOnce(new Promise<Feed>((r) => (resolve = r)));
    return () => resolve(feed(url));
  }

  it('saves nothing when the form closed while connecting', async () => {
    let current = true;
    const finish = deferredFeed();
    const pending = connectCatalog({ url, credentials, isCurrent: () => current });
    current = false;
    finish();
    await expect(pending).rejects.toBeInstanceOf(StaleConnectError);
    expect(catalogStore.all()).toEqual([]);
    expect(mockSecure.size).toBe(0);
  });

  it('takes back keychain items when the attempt went stale while they were written', async () => {
    let current = true;
    mockFetchFeed.mockResolvedValueOnce(feed(url));
    const SecureStore = jest.requireMock('expo-secure-store');
    SecureStore.setItemAsync.mockImplementationOnce(async (key: string, value: string) => {
      mockSecure.set(key, value);
      current = false;
    });
    await expect(connectCatalog({ url, credentials, isCurrent: () => current })).rejects.toBeInstanceOf(
      StaleConnectError,
    );
    expect(catalogStore.all()).toEqual([]);
    expect(mockSecure.size).toBe(0);
  });

  it('does not bring back a catalog that was removed while its edit was connecting', async () => {
    mockFetchFeed.mockResolvedValueOnce(feed(url));
    const { catalog } = await connectCatalog({ url });
    const finish = deferredFeed();
    const pending = connectCatalog({ url, credentials, catalogId: catalog.id, isCurrent: () => true });
    await removeCatalog(catalog.id);
    finish();
    await expect(pending).rejects.toBeInstanceOf(StaleConnectError);
    expect(catalogStore.get(catalog.id)).toBeUndefined();
    expect(mockSecure.size).toBe(0);
  });

  it('saves a current attempt', async () => {
    mockFetchFeed.mockResolvedValueOnce(feed(url));
    const { catalog } = await connectCatalog({ url, credentials, isCurrent: () => true });
    expect(catalogStore.get(catalog.id)?.hasCredentials).toBe(true);
  });
});

describe('removing a catalog', () => {
  const url = 'https://books.example.com/opds';
  const credentials = { username: 'ann', password: 'secret' };
  const failNextDelete = () =>
    jest.requireMock('expo-secure-store').deleteItemAsync.mockRejectedValueOnce(new Error('Keychain unavailable'));

  it('reports keychain deletion errors', async () => {
    failNextDelete();
    await expect(deleteCredentials('c1')).rejects.toThrow('Keychain unavailable');
    failNextDelete();
    await expect(deleteSecretUrl('c1')).rejects.toThrow('Keychain unavailable');
  });

  it('deletes the saved login, then the catalog', async () => {
    mockFetchFeed.mockResolvedValueOnce(feed(url));
    const { catalog } = await connectCatalog({ url, credentials });
    expect(mockSecure.size).toBe(1);
    await removeCatalog(catalog.id);
    expect(catalogStore.get(catalog.id)).toBeUndefined();
    expect(mockSecure.size).toBe(0);
  });

  it('keeps the catalog when its saved login cannot be deleted', async () => {
    mockFetchFeed.mockResolvedValueOnce(feed(url));
    const { catalog } = await connectCatalog({ url, credentials });
    failNextDelete();
    await expect(removeCatalog(catalog.id)).rejects.toThrow('Keychain unavailable');
    expect(catalogStore.get(catalog.id)).toBeDefined();
  });

  it('tells the user when the saved login could not be removed', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockFetchFeed.mockResolvedValueOnce(feed(url));
    const { catalog } = await connectCatalog({ url, credentials, name: 'Home' });
    failNextDelete();
    await removeCatalogWithFeedback(catalog);
    expect(alert).toHaveBeenCalledWith("Couldn't remove “Home”", "Couldn't remove the saved login. Try again.");
    expect(catalogStore.get(catalog.id)).toBeDefined();

    alert.mockClear();
    await removeCatalogWithFeedback(catalog);
    expect(alert).not.toHaveBeenCalled();
    expect(catalogStore.get(catalog.id)).toBeUndefined();
  });
});
