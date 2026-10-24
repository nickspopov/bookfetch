import { createMMKV, type MMKV } from 'react-native-mmkv';

let instance: MMKV | undefined;

/** The app's single key-value store. No encryption key: the app uses only OS crypto (export compliance). */
export function storage(): MMKV {
  instance ??= createMMKV({ id: 'bookfetch' });
  return instance;
}

/** Reads a versioned JSON document; anything missing, corrupt or from another schema version yields `undefined`. */
export function readVersioned(key: string, version: number): unknown[] | undefined {
  let raw: string | undefined;
  try {
    raw = storage().getString(key);
  } catch {
    return undefined;
  }
  return parseVersioned(raw, version);
}

export function parseVersioned(raw: string | undefined, version: number): unknown[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return undefined;
    const doc = parsed as { schema?: unknown; items?: unknown };
    if (doc.schema !== version || !Array.isArray(doc.items)) return undefined;
    return doc.items;
  } catch {
    return undefined;
  }
}

export function writeVersioned(key: string, version: number, items: unknown[]): void {
  storage().set(key, JSON.stringify({ schema: version, items }));
}
