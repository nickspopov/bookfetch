/// <reference types="jest" />
/// <reference types="node" />
import { readFileSync } from 'fs';
import { join } from 'path';

export function fixture(name: string): string {
  return readFileSync(join(__dirname, '..', '..', '__fixtures__', 'opds', name), 'utf8');
}

export const KAVITA_BASE = 'https://demo.kavitareader.com/api/opds/9003cf99-9213-4206-a787-af2fe4cc5f1f';

export const UA = 'Bookfetch/1.0.0 (+https://nickpopov.com/bookfetch)';

export interface MockRoute {
  status?: number;
  body?: string;
  /** response.url (final URL after redirects); defaults to the request URL */
  url?: string;
}

export interface RecordedRequest {
  url: string;
  headers: Record<string, string>;
}

/** fetch mock answering from a URL -> response table; records each request with its headers. */
export function mockFetch(routes: Record<string, MockRoute | (() => Promise<never>)>) {
  const requests: RecordedRequest[] = [];
  const impl = jest.fn(async (input: unknown, init?: { headers?: Record<string, string> }) => {
    const url = String(input);
    requests.push({ url, headers: { ...(init?.headers ?? {}) } });
    const route = routes[url];
    if (route === undefined) throw new TypeError('Network request failed');
    if (typeof route === 'function') return route();
    return {
      status: route.status ?? 200,
      url: route.url ?? url,
      text: async () => route.body ?? '',
    };
  });
  return { fetchImpl: impl as unknown as typeof fetch, requests };
}
