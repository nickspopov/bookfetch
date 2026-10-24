import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { Feed } from '@/opds';

import { connectCatalog } from '../catalog-actions';
import { catalogStore, useCatalog } from '../catalogs';
import { useCatalogSession } from '../use-session';
import { memory } from './mmkv-mock';

jest.mock('react-native-mmkv', () => jest.requireActual('./mmkv-mock').mmkvMock);

const mockSecure = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK: 0,
  getItemAsync: jest.fn(async (key: string) => mockSecure.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => void mockSecure.set(key, value)),
  deleteItemAsync: jest.fn(async (key: string) => void mockSecure.delete(key)),
}));

const URL = 'https://books.example.com/opds';
const mockFeed: Feed = { url: URL, title: 'Library', kind: 'navigation', entries: [], facets: [] };

// The connect flow's probe client is stubbed; saved catalogs get real clients from sessionFor.
jest.mock('../client', () => ({
  ...jest.requireActual('../client'),
  makeClient: () => ({ fetchFeed: async () => mockFeed }),
}));

const basic = (username: string, password: string) => `Basic ${btoa(`${username}:${password}`)}`;

beforeEach(() => {
  memory.clear();
  mockSecure.clear();
  catalogStore.reset();
});

it('bumps the session revision on every connect or edit', async () => {
  const { catalog } = await connectCatalog({ url: URL, credentials: { username: 'ann', password: 'old' } });
  expect(catalog.sessionRevision).toBe(1);
  const edited = await connectCatalog({
    url: URL,
    credentials: { username: 'ann', password: 'new' },
    catalogId: catalog.id,
  });
  expect(edited.catalog.sessionRevision).toBe(2);
  expect(catalogStore.get(catalog.id)?.sessionRevision).toBe(2);
});

it('gives mounted screens a new client after the password was edited', async () => {
  const { catalog } = await connectCatalog({ url: URL, credentials: { username: 'ann', password: 'old' } });
  const { result } = await renderHook(() => useCatalogSession(useCatalog(catalog.id)));
  await waitFor(() => expect(result.current.session).toBeDefined());
  const before = result.current.session!;
  expect(before.client.headersFor(URL).Authorization).toBe(basic('ann', 'old'));

  await act(async () => {
    await connectCatalog({ url: URL, credentials: { username: 'ann', password: 'new' }, catalogId: catalog.id });
  });
  await waitFor(() => expect(result.current.session).toBeDefined());
  await waitFor(() => expect(result.current.session).not.toBe(before));
  expect(result.current.session!.client).not.toBe(before.client);
  expect(result.current.session!.client.headersFor(URL).Authorization).toBe(basic('ann', 'new'));
});
