import type { Entry, Feed } from '@/opds';

// In-memory hand-off between screens: whole entries and feeds never go into a route URL.

const MAX_ITEMS = 200;

function boundedMap<T>() {
  const map = new Map<string, T>();
  return {
    get: (key: string) => map.get(key),
    set(key: string, value: T) {
      map.delete(key);
      map.set(key, value);
      while (map.size > MAX_ITEMS) map.delete(map.keys().next().value as string);
    },
    delete: (key: string) => map.delete(key),
    clear: () => map.clear(),
  };
}

let counter = 0;
const entries = boundedMap<{ catalogId: string; entry: Entry }>();

/** Stores an entry for the book screen and returns the token to put in its route. */
export function putEntry(catalogId: string, entry: Entry): string {
  counter += 1;
  const token = `${Date.now().toString(36)}-${counter}`;
  entries.set(token, { catalogId, entry });
  return token;
}

export function getEntry(token: string | undefined) {
  return token ? entries.get(token) : undefined;
}

const pages = boundedMap<{ catalogId: string; url: string }>();

/**
 * Stores a feed URL for a feed screen and returns the token to put in its route. Feed URLs can carry an API key
 * (Kavita), so they never go into route params, which navigation state and deep-link logs can expose.
 */
export function putFeedPage(catalogId: string, url: string): string {
  counter += 1;
  const token = `p${Date.now().toString(36)}-${counter}`;
  pages.set(token, { catalogId, url });
  return token;
}

export type FeedTarget = { kind: 'root' } | { kind: 'page'; url: string } | { kind: 'gone' };

/**
 * What a feed screen shows: the catalog root when it has no page token, the stored page, or "gone" when the token
 * is no longer known (the app was restarted and its route restored) or belongs to another catalog.
 */
export function resolveFeedPage(catalogId: string, token: string | undefined): FeedTarget {
  if (!token) return { kind: 'root' };
  const page = pages.get(token);
  return page && page.catalogId === catalogId ? { kind: 'page', url: page.url } : { kind: 'gone' };
}

const feeds = boundedMap<Feed>();
const feedKey = (catalogId: string, url: string) => `${catalogId}|${url}`;

/** A feed fetched by the connect flow, so opening the new catalog does not fetch it again. */
export function putFeed(catalogId: string, url: string, feed: Feed) {
  feeds.set(feedKey(catalogId, url), feed);
}

export function takeFeed(catalogId: string, url: string): Feed | undefined {
  const key = feedKey(catalogId, url);
  const feed = feeds.get(key);
  feeds.delete(key);
  return feed;
}

const searchFeeds = boundedMap<Feed>();

/** The feed whose search a results screen should run (its SearchSpec is not URL-sized). */
export function putSearchSource(feed: Feed): string {
  counter += 1;
  const token = `s${counter}`;
  searchFeeds.set(token, feed);
  return token;
}

export function getSearchSource(token: string | undefined): Feed | undefined {
  return token ? searchFeeds.get(token) : undefined;
}
