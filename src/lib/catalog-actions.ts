import { normalizeCatalogUrl, type Credentials, type Feed } from '@/opds';

import { redactUrl } from './catalog-url';
import { catalogStore, newId, storableIconUrl, type Catalog } from './catalogs';
import { forgetSession, makeClient } from './client';
import { deleteCredentials, deleteSecretUrl, saveCredentials, saveSecretUrl } from './credentials';
import { putFeed } from './nav-store';

export interface ConnectInput {
  url: string;
  name?: string;
  credentials?: Credentials;
  /** set when editing an existing catalog */
  catalogId?: string;
  /** false once the form that started this attempt is gone or has started a newer one */
  isCurrent?: () => boolean;
}

/** The connect finished after its form closed, a newer attempt started, or the edited catalog was removed. */
export class StaleConnectError extends Error {
  constructor() {
    super('The connect attempt is no longer current');
    this.name = 'StaleConnectError';
  }
}

/**
 * Normalizes the address, fetches the feed with the given login and, on success, saves the catalog.
 * Throws the OpdsError from the client on failure, or StaleConnectError when the attempt is no longer wanted;
 * nothing is saved then. An edit never brings back a catalog that was removed while it was connecting.
 */
export async function connectCatalog(input: ConnectInput): Promise<{ catalog: Catalog; feed: Feed }> {
  const url = normalizeCatalogUrl(input.url);
  const feed = await makeClient(url, input.credentials).fetchFeed(url);
  // HTML autodiscovery or redirects can land on another URL; keep the feed's own address.
  const rootUrl = feed.url || url;
  const id = input.catalogId ?? newId();
  const existing = input.catalogId ? catalogStore.get(input.catalogId) : undefined;
  const { redacted, secret } = redactUrl(rootUrl);
  const stale = () =>
    (input.isCurrent ? !input.isCurrent() : false) || (!!input.catalogId && !catalogStore.get(input.catalogId));
  if (stale()) throw new StaleConnectError();

  if (input.credentials) await saveCredentials(id, input.credentials);
  else await deleteCredentials(id);
  if (secret) await saveSecretUrl(id, rootUrl);
  else await deleteSecretUrl(id);

  if (stale()) {
    // No catalog points at these keychain items any more (or never did): take them back out.
    if (!catalogStore.get(id)) await Promise.allSettled([deleteCredentials(id), deleteSecretUrl(id)]);
    throw new StaleConnectError();
  }

  const catalog: Catalog = {
    id,
    url: secret ? redacted : rootUrl,
    urlInKeychain: secret,
    title: input.name?.trim() || cleanTitle(feed.title) || existing?.title || hostLabel(rootUrl),
    iconUrl: storableIconUrl(feed.iconUrl, secret),
    hasCredentials: !!input.credentials,
    sessionRevision: (existing?.sessionRevision ?? 0) + 1,
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
