import * as SecureStore from 'expo-secure-store';

import type { Credentials } from '@/opds';

const options: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

const keyFor = (catalogId: string) => `catalog.${catalogId}.credentials`;

export async function loadCredentials(catalogId: string): Promise<Credentials | undefined> {
  try {
    const raw = await SecureStore.getItemAsync(keyFor(catalogId), options);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<Credentials>;
    if (typeof parsed.username !== 'string' || typeof parsed.password !== 'string') return undefined;
    return { username: parsed.username, password: parsed.password };
  } catch {
    return undefined;
  }
}

export async function saveCredentials(catalogId: string, credentials: Credentials): Promise<void> {
  await SecureStore.setItemAsync(keyFor(catalogId), JSON.stringify(credentials), options);
}

/** Deleting a missing item succeeds; a keychain failure is thrown so the caller can keep what still refers to it. */
export async function deleteCredentials(catalogId: string): Promise<void> {
  await SecureStore.deleteItemAsync(keyFor(catalogId), options);
}

const urlKeyFor = (catalogId: string) => `catalog.${catalogId}.url`;

/** Catalog URLs that carry an API key (Kavita) are kept here rather than in the catalog list. */
export async function loadSecretUrl(catalogId: string): Promise<string | undefined> {
  try {
    return (await SecureStore.getItemAsync(urlKeyFor(catalogId), options)) ?? undefined;
  } catch {
    return undefined;
  }
}

export async function saveSecretUrl(catalogId: string, url: string): Promise<void> {
  await SecureStore.setItemAsync(urlKeyFor(catalogId), url, options);
}

export async function deleteSecretUrl(catalogId: string): Promise<void> {
  await SecureStore.deleteItemAsync(urlKeyFor(catalogId), options);
}
