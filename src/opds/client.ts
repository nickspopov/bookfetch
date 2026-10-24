// HTTP client: fetch with timeout, auth scoping, status mapping, content sniffing and search.
import { decodeEntities } from './html';
import { mimeBase, mimeParams } from './mime';
import { buildSearchUrl, parseOpenSearchDescription } from './opensearch';
import { parseFeed } from './parse';
import type { ClientOptions, Credentials, Feed, OpdsClient, RequestOptions, SearchSpec } from './types';
import { OpdsError } from './types';
import { assertSafeHttpUrl, credentialOriginOf, originOf, resolveUrl } from './url';

export const ACCEPT_FEED =
  'application/atom+xml;profile=opds-catalog, application/atom+xml;q=0.9, application/xml;q=0.8, */*;q=0.5';
const ACCEPT_OPENSEARCH = 'application/opensearchdescription+xml, application/xml;q=0.9, */*;q=0.5';

const DEFAULT_TIMEOUT_MS = 20000;

export const MESSAGES = {
  network: "Can't reach the server. Check the address and your connection.",
  timeout: 'The server took too long to answer.',
  unauthorized: 'The server needs a valid username and password.',
  forbidden: 'The server refused access with these credentials.',
  notFound: 'Nothing was found at this address.',
  http: (status: number) => `The server answered with an error (HTTP ${status}).`,
  notOpds: "This address doesn't look like an OPDS catalog.",
  opds2: "OPDS 2 catalogs aren't supported yet.",
  noSearch: 'This catalog has no search',
} as const;

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function utf8Bytes(text: string): number[] {
  const bytes: number[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0xfffd;
    if (cp < 0x80) bytes.push(cp);
    else if (cp < 0x800) bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) {
      const c = cp >= 0xd800 && cp <= 0xdfff ? 0xfffd : cp; // lone surrogate
      bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    } else bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }
  return bytes;
}

/** Base64 of the UTF-8 bytes of `text` (no Buffer/btoa dependency; btoa throws on non-Latin-1). */
export function base64Utf8(text: string): string {
  const bytes = utf8Bytes(text);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += BASE64[(n >> 18) & 63] + BASE64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? BASE64[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? BASE64[n & 63] : '=';
  }
  return out;
}

export function basicAuthHeader(credentials: Credentials): string {
  return `Basic ${base64Utf8(`${credentials.username}:${credentials.password}`)}`;
}

type Sniffed = { kind: 'feed' } | { kind: 'html' } | { kind: 'opds2' } | { kind: 'other' };

/** Classifies a response body by its content (servers often send wrong Content-Type headers). */
export function sniffBody(body: string): Sniffed {
  const text = body.replace(/^﻿/, '').trimStart();
  if (text.startsWith('{') || text.startsWith('[')) {
    const looksOpds2 = /"metadata"\s*:/.test(text) && /"(?:publications|navigation|groups)"\s*:/.test(text);
    return { kind: looksOpds2 ? 'opds2' : 'other' };
  }
  if (!text.startsWith('<')) return { kind: 'other' };
  // skip the XML declaration, processing instructions, comments and the doctype to find the root element
  let rest = text;
  let doctypeHtml = false;
  for (;;) {
    rest = rest.trimStart();
    if (rest.startsWith('<?')) {
      const end = rest.indexOf('?>');
      if (end === -1) return { kind: 'other' };
      rest = rest.slice(end + 2);
    } else if (rest.startsWith('<!--')) {
      const end = rest.indexOf('-->');
      if (end === -1) return { kind: 'other' };
      rest = rest.slice(end + 3);
    } else if (/^<!doctype/i.test(rest)) {
      const end = rest.indexOf('>');
      if (end === -1) return { kind: 'other' };
      if (/^<!doctype\s+html/i.test(rest)) doctypeHtml = true;
      rest = rest.slice(end + 1);
    } else break;
  }
  const root = /^<([A-Za-z_][\w.-]*:)?([A-Za-z_][\w.-]*)/.exec(rest);
  const local = root?.[2].toLowerCase();
  if (local === 'feed' || local === 'entry') return { kind: 'feed' };
  if (local === 'html' || doctypeHtml) return { kind: 'html' };
  return { kind: 'other' };
}

function parseTagAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  const inner = tag.replace(/^<\s*link\b/i, '').replace(/\/?>$/, '');
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner))) {
    attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return attrs;
}

/** Finds <link rel="alternate" type="application/atom+xml;profile=opds-catalog" href> in an HTML page. */
export function findOpdsAutodiscovery(html: string, pageUrl: string): string | undefined {
  const tags = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const a = parseTagAttributes(tag);
    const rels = (a.rel ?? '').toLowerCase().split(/\s+/);
    if (!rels.includes('alternate') || !a.href) continue;
    if (mimeBase(a.type) !== 'application/atom+xml' || mimeParams(a.type).profile !== 'opds-catalog') continue;
    const baseTag = /<base\b[^>]*\bhref\s*=\s*["']([^"']+)["']/i.exec(html);
    const base = baseTag ? (resolveUrl(decodeEntities(baseTag[1]), pageUrl) ?? pageUrl) : pageUrl;
    return resolveUrl(a.href, base);
  }
  return undefined;
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: string }).name === 'AbortError';
}

export function createOpdsClient(options: ClientOptions): OpdsClient {
  const fetchImpl: typeof fetch = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const catalogOrigin = originOf(options.catalogOrigin);
  const authorization = options.credentials ? basicAuthHeader(options.credentials) : undefined;
  const templateCache = new Map<string, Extract<SearchSpec, { kind: 'template' }>>();

  function headersFor(url: string): Record<string, string> {
    const headers: Record<string, string> = { 'User-Agent': options.userAgent };
    if (authorization && catalogOrigin !== '' && credentialOriginOf(url) === catalogOrigin) {
      headers.Authorization = authorization;
    }
    return headers;
  }

  async function request(url: string, accept: string, init?: RequestOptions): Promise<{ body: string; url: string }> {
    assertSafeHttpUrl(url);
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onCallerAbort = () => controller.abort();
    if (init?.signal) {
      if (init.signal.aborted) controller.abort();
      else init.signal.addEventListener('abort', onCallerAbort);
    }
    try {
      const headers: Record<string, string> = { ...headersFor(url), Accept: accept };
      const send = (target: string) => fetchImpl(target, { method: 'GET', headers, signal: controller.signal });
      let requested = url;
      let response = await send(requested);
      // iOS drops custom headers when it follows a redirect, so a protected catalog that redirects (/opds -> /opds/)
      // answers 401 to the right credentials. Ask the final URL directly once, and only on the catalog origin.
      if (
        (response.status === 401 || response.status === 403) &&
        headers.Authorization !== undefined &&
        response.url &&
        response.url !== url &&
        credentialOriginOf(response.url) === catalogOrigin
      ) {
        requested = response.url;
        response = await send(requested);
      }
      if (response.status === 401) throw new OpdsError('unauthorized', MESSAGES.unauthorized, 401);
      if (response.status === 403) throw new OpdsError('unauthorized', MESSAGES.forbidden, 403);
      if (response.status === 404 || response.status === 410) {
        throw new OpdsError('not-found', MESSAGES.notFound, response.status);
      }
      if (response.status < 200 || response.status > 299) {
        throw new OpdsError('http', MESSAGES.http(response.status), response.status);
      }
      const body = await response.text();
      return { body, url: response.url ? assertSafeHttpUrl(response.url) : requested };
    } catch (error) {
      if (error instanceof OpdsError) throw error;
      if (init?.signal?.aborted && !timedOut) throw error;
      if (timedOut || isAbortError(error)) throw new OpdsError('timeout', MESSAGES.timeout);
      throw new OpdsError('network', MESSAGES.network);
    } finally {
      clearTimeout(timer);
      init?.signal?.removeEventListener('abort', onCallerAbort);
    }
  }

  async function fetchFeed(url: string, init?: RequestOptions): Promise<Feed> {
    let target = url;
    for (let hop = 0; hop < 2; hop += 1) {
      const { body, url: finalUrl } = await request(target, ACCEPT_FEED, init);
      const sniffed = sniffBody(body);
      if (sniffed.kind === 'feed') return parseFeed(body, finalUrl);
      if (sniffed.kind === 'opds2') throw new OpdsError('opds2-unsupported', MESSAGES.opds2);
      if (sniffed.kind === 'html' && hop === 0) {
        const discovered = findOpdsAutodiscovery(body, finalUrl);
        if (discovered) {
          target = discovered;
          continue;
        }
      }
      break;
    }
    throw new OpdsError('not-opds', MESSAGES.notOpds);
  }

  async function resolveSearch(spec: SearchSpec, init?: RequestOptions) {
    if (spec.kind === 'template') return spec;
    const cached = templateCache.get(spec.url);
    if (cached) return cached;
    const { body, url } = await request(spec.url, ACCEPT_OPENSEARCH, init);
    const parsed = parseOpenSearchDescription(body, url);
    if (!parsed || parsed.kind !== 'template') throw new OpdsError('not-found', MESSAGES.noSearch);
    templateCache.set(spec.url, parsed);
    return parsed;
  }

  async function search(feed: Feed, query: string, init?: RequestOptions): Promise<Feed> {
    if (!feed.search) throw new OpdsError('not-found', MESSAGES.noSearch);
    const spec = await resolveSearch(feed.search, init);
    const url = buildSearchUrl(spec.template, query, { indexOffset: spec.indexOffset, pageOffset: spec.pageOffset });
    return fetchFeed(url, init);
  }

  return { fetchFeed, search, headersFor };
}
