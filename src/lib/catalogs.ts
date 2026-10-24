import { useSyncExternalStore } from 'react';

import { redactUrl } from './catalog-url';
import { readVersioned, writeVersioned } from './storage';

export interface Catalog {
  id: string;
  /** normalized root feed URL; never contains a login. When `urlInKeychain`, API keys in it are replaced by REDACTED
   * and the real URL lives in SecureStore. */
  url: string;
  urlInKeychain: boolean;
  /** feed title or the name the user typed */
  title: string;
  iconUrl?: string;
  /** true when a login is stored in SecureStore for this catalog */
  hasCredentials: boolean;
  addedAt: number;
}

const KEY = 'catalogs';
export const CATALOGS_SCHEMA = 1;

/** Keeps every well-formed catalog and drops anything else; never throws. */
export function parseCatalogs(items: unknown[] | undefined): Catalog[] {
  if (!items) return [];
  const seen = new Set<string>();
  const result: Catalog[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const c = item as Record<string, unknown>;
    if (typeof c.id !== 'string' || !c.id || seen.has(c.id)) continue;
    if (typeof c.url !== 'string' || !/^https?:\/\//i.test(c.url)) continue;
    seen.add(c.id);
    result.push({
      id: c.id,
      url: c.url,
      title: typeof c.title === 'string' && c.title.trim() ? c.title : hostOf(c.url),
      iconUrl: typeof c.iconUrl === 'string' ? storableIconUrl(c.iconUrl, c.urlInKeychain === true) : undefined,
      urlInKeychain: c.urlInKeychain === true,
      hasCredentials: c.hasCredentials === true,
      addedAt: typeof c.addedAt === 'number' ? c.addedAt : 0,
    });
  }
  return result;
}

/**
 * The catalog list lives in MMKV, outside the keychain. A keyed catalog's icon URL (Kavita) carries the same API
 * key, so such icons are not kept; the row shows the fallback glyph instead.
 */
export function storableIconUrl(iconUrl: string | undefined, keyedCatalog: boolean): string | undefined {
  if (!iconUrl || keyedCatalog || redactUrl(iconUrl).secret) return undefined;
  return iconUrl;
}

export function hostOf(url: string): string {
  const match = /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/?#]*@)?([^/?#]+)/i.exec(url);
  return match ? match[1] : url;
}

export function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

let catalogs: Catalog[] | undefined;
const listeners = new Set<() => void>();

function current(): Catalog[] {
  catalogs ??= parseCatalogs(readVersioned(KEY, CATALOGS_SCHEMA));
  return catalogs;
}

function commit(next: Catalog[]) {
  catalogs = next;
  writeVersioned(KEY, CATALOGS_SCHEMA, next);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const catalogStore = {
  all: current,
  get: (id: string) => current().find((c) => c.id === id),
  add(catalog: Catalog) {
    commit([...current().filter((c) => c.id !== catalog.id), catalog]);
  },
  update(id: string, patch: Partial<Omit<Catalog, 'id'>>) {
    commit(current().map((c) => (c.id === id ? { ...c, ...patch } : c)));
  },
  remove(id: string) {
    commit(current().filter((c) => c.id !== id));
  },
  /** test helper */
  reset() {
    catalogs = undefined;
  },
};

export function useCatalogs(): Catalog[] {
  return useSyncExternalStore(subscribe, current);
}

export function useCatalog(id: string | undefined): Catalog | undefined {
  const all = useCatalogs();
  return id ? all.find((c) => c.id === id) : undefined;
}
