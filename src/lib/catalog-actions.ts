import { normalizeCatalogUrl, type Credentials, type Feed } from '@/opds';

import { redactUrl } from './catalog-url';
import { catalogStore, newId, type Catalog } from './catalogs';
import { forgetSession, makeClient } from './client';
import { deleteCredentials, deleteSecretUrl, saveCredentials, saveSecretUrl } from './credentials';
import { putFeed } from './nav-store';

export interface ConnectInput {
  url: string;
  name?: string;
  credentials?: Credentials;
  /** set when editing an existing catalog */
  catalogId?: string;
}

/**
 * Normalizes the address, fetches the feed with the given login and, on success, saves the catalog.
 * Throws the OpdsError from the client on failure; nothing is saved then.
 */
export async function connectCatalog(input: ConnectInput): Promise<{ catalog: Catalog; feed: Feed }> {
  const url = normalizeCatalogUrl(input.url);
  const feed = await makeClient(url, input.credentials).fetchFeed(url);
  // HTML autodiscovery or redirects can land on another URL; keep the feed's own address.
  const rootUrl = feed.url || url;
  const id = input.catalogId ?? newId();
  const existing = input.catalogId ? catalogStore.get(input.catalogId) : undefined;
  const { redacted, secret } = redactUrl(rootUrl);

  if (input.credentials) await saveCredentials(id, input.credentials);
  else await deleteCredentials(id);
  if (secret) await saveSecretUrl(id, rootUrl);
  else await deleteSecretUrl(id);

  const catalog: Catalog = {
    id,
    url: secret ? redacted : rootUrl,
    urlInKeychain: secret,
    title: input.name?.trim() || cleanTitle(feed.title) || existing?.title || hostLabel(rootUrl),
    iconUrl: feed.iconUrl,
    hasCredentials: !!input.credentials,
    addedAt: existing?.addedAt ?? Date.now(),
  };
  forgetSession(id);
  catalogStore.add(catalog);
  putFeed(id, rootUrl, feed);
  return { catalog, feed };
}

export function renameCatalog(id: string, title: string) {
  const trimmed = title.trim();
  if (trimmed) catalogStore.update(id, { title: trimmed });
}

export async function removeCatalog(id: string) {
  catalogStore.remove(id);
  forgetSession(id);
  await Promise.all([deleteCredentials(id), deleteSecretUrl(id)]);
}

function cleanTitle(title: string | undefined): string {
  return (title ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function hostLabel(url: string): string {
  return /^[a-z]+:\/\/([^/?#]+)/i.exec(url)?.[1] ?? url;
}
