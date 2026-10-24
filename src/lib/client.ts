import { createOpdsClient, originOf, type Credentials, type OpdsClient } from '@/opds';

import { USER_AGENT } from './app-info';
import type { Catalog } from './catalogs';
import { loadCredentials, loadSecretUrl } from './credentials';

export function makeClient(url: string, credentials?: Credentials): OpdsClient {
  return createOpdsClient({
    userAgent: USER_AGENT,
    credentials,
    catalogOrigin: credentials ? originOf(url) || undefined : undefined,
  });
}

/** Thrown when a catalog's keychain item (its URL with an API key) is gone, e.g. after a restore. */
export class MissingSecretError extends Error {
  constructor() {
    super('The catalog address is missing from the keychain');
    this.name = 'MissingSecretError';
  }
}

export interface CatalogSession {
  client: OpdsClient;
  /** the real root feed URL (with its API key, if any) */
  rootUrl: string;
  sentCredentials: boolean;
}

const sessions = new Map<string, Promise<CatalogSession>>();

/** Identifies one generation of a catalog's client; it changes whenever its URL or login was saved again. */
export function sessionKey(catalog: Catalog): string {
  return `${catalog.id}|${catalog.sessionRevision}|${catalog.url}|${catalog.hasCredentials}|${catalog.urlInKeychain}`;
}

/** One client per saved catalog, created with its stored login and URL. */
export function sessionFor(catalog: Catalog): Promise<CatalogSession> {
  const key = sessionKey(catalog);
  let session = sessions.get(key);
  if (!session) {
    session = (async () => {
      const rootUrl = catalog.urlInKeychain ? await loadSecretUrl(catalog.id) : catalog.url;
      if (!rootUrl) throw new MissingSecretError();
      const credentials = catalog.hasCredentials ? await loadCredentials(catalog.id) : undefined;
      return { client: makeClient(rootUrl, credentials), rootUrl, sentCredentials: !!credentials };
    })();
    session.catch(() => sessions.delete(key));
    sessions.set(key, session);
  }
  return session;
}

/** Drops cached clients after a catalog's URL or login changed or it was removed. */
export function forgetSession(catalogId: string) {
  for (const key of sessions.keys()) {
    if (key.startsWith(`${catalogId}|`)) sessions.delete(key);
  }
}
