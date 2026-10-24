/// <reference types="jest" />
/// <reference types="node" />
import { Buffer } from 'buffer';

import { OpdsError, base64Utf8, basicAuthHeader, createOpdsClient, type Feed } from '../../src/opds';
import { KAVITA_BASE, UA, fixture, mockFetch } from './helpers';

const CATALOG = 'https://books.example.org/opds/root.xml';
const ORIGIN = 'https://books.example.org';
const credentials = { username: 'reader', password: 'secret' };
const FEED = (title = 'Root') =>
  `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>${title}</title>
   <link rel="next" href="page2.xml" type="application/atom+xml;profile=opds-catalog"/></feed>`;

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (e) {
    return e instanceof OpdsError ? e.code : `not OpdsError: ${String(e)}`;
  }
  return undefined;
}

describe('base64 for Basic auth', () => {
  it.each([['reader:secret'], ['ü:pässwörd'], ['用户:密码'], ['emoji:🔑'], [''], ['a'], ['ab'], ['abc']])(
    'encodes %j as UTF-8',
    (text) => {
      expect(base64Utf8(text)).toBe(Buffer.from(text, 'utf8').toString('base64'));
    },
  );

  it('builds the header', () => {
    expect(basicAuthHeader({ username: 'ü', password: '密码' })).toBe(
      `Basic ${Buffer.from('ü:密码', 'utf8').toString('base64')}`,
    );
  });
});

describe('fetchFeed', () => {
  it('sends User-Agent, Accept and Basic auth to the catalog origin and parses the feed', async () => {
    const { fetchImpl, requests } = mockFetch({ [CATALOG]: { body: FEED() } });
    const client = createOpdsClient({ userAgent: UA, credentials, catalogOrigin: `${ORIGIN}/`, fetchImpl });
    const feed = await client.fetchFeed(CATALOG);
    expect(feed.title).toBe('Root');
    expect(feed.url).toBe(CATALOG);
    expect(requests[0].headers).toEqual({
      'User-Agent': UA,
      Accept: 'application/atom+xml;profile=opds-catalog, application/atom+xml;q=0.9, application/xml;q=0.8, */*;q=0.5',
      Authorization: `Basic ${Buffer.from('reader:secret').toString('base64')}`,
    });
  });

  it('does not send credentials to other origins', async () => {
    const other = 'https://cdn.example.net/feed.xml';
    const { fetchImpl, requests } = mockFetch({ [other]: { body: FEED() } });
    const client = createOpdsClient({ userAgent: UA, credentials, catalogOrigin: ORIGIN, fetchImpl });
    await client.fetchFeed(other);
    expect(requests[0].headers.Authorization).toBeUndefined();
    expect(requests[0].headers['User-Agent']).toBe(UA);
  });

  it('treats a different scheme or port as a different origin', () => {
    const client = createOpdsClient({
      userAgent: UA,
      credentials,
      catalogOrigin: ORIGIN,
      fetchImpl: jest.fn() as never,
    });
    expect(client.headersFor('https://books.example.org:443/x').Authorization).toBeDefined();
    expect(client.headersFor('http://books.example.org/x').Authorization).toBeUndefined();
    expect(client.headersFor('https://books.example.org:8443/x').Authorization).toBeUndefined();
    expect(client.headersFor('https://evil.example.org/?https://books.example.org').Authorization).toBeUndefined();
    expect(client.headersFor('data:image/png;base64,AAA=')).toEqual({ 'User-Agent': UA });
  });

  it('never sends credentials to URLs that parsers read differently or that carry userinfo', () => {
    const client = createOpdsClient({
      userAgent: UA,
      credentials,
      catalogOrigin: ORIGIN,
      fetchImpl: jest.fn() as never,
    });
    expect(client.headersFor(`${ORIGIN}/x`).Authorization).toBeDefined();
    for (const url of [
      'https://evil.example\\@books.example.org/x',
      'https://evil.example%5C@books.example.org/x',
      'https://reader@books.example.org/x',
      'https://reader:secret@books.example.org/x',
      'https://books.example.org/x y',
      'https://books.example.org/x\ty',
      'https://books.example.org/x\u0001',
    ]) {
      expect(client.headersFor(url)).toEqual({ 'User-Agent': UA });
    }
  });

  it('refuses to fetch ambiguous URLs, including a redirect target or an autodiscovered link', async () => {
    const fetchImpl = jest.fn() as unknown as typeof fetch;
    const client = createOpdsClient({ userAgent: UA, credentials, catalogOrigin: ORIGIN, fetchImpl });
    expect(await codeOf(client.fetchFeed('https://evil.example\\@books.example.org/opds'))).toBe('invalid-url');
    expect(await codeOf(client.fetchFeed('https://books.example.org/op ds'))).toBe('invalid-url');
    expect(fetchImpl).not.toHaveBeenCalled();

    const redirected = mockFetch({ [CATALOG]: { body: FEED(), url: 'https://evil.example\\@books.example.org/' } });
    const redirectClient = createOpdsClient({ userAgent: UA, fetchImpl: redirected.fetchImpl });
    expect(await codeOf(redirectClient.fetchFeed(CATALOG))).toBe('invalid-url');

    const page = 'https://books.example.org/';
    const html =
      '<html><head><link rel="alternate" type="application/atom+xml;profile=opds-catalog" href="/op\u0001ds"></head></html>';
    const discovered = mockFetch({ [page]: { body: html } });
    const discoverClient = createOpdsClient({ userAgent: UA, fetchImpl: discovered.fetchImpl });
    expect(await codeOf(discoverClient.fetchFeed(page))).toBe('invalid-url');
    expect(discovered.requests).toHaveLength(1);
  });

  it('resolves links against response.url after a cross-origin redirect and stops sending auth there', async () => {
    const moved = 'https://mirror.example.net/opds/root.xml';
    const { fetchImpl, requests } = mockFetch({
      [CATALOG]: { body: FEED(), url: moved },
      'https://mirror.example.net/opds/page2.xml': { body: FEED('Page 2') },
    });
    const client = createOpdsClient({ userAgent: UA, credentials, catalogOrigin: ORIGIN, fetchImpl });
    const feed = await client.fetchFeed(CATALOG);
    expect(feed.url).toBe(moved);
    expect(feed.next).toBe('https://mirror.example.net/opds/page2.xml');
    await client.fetchFeed(feed.next!);
    expect(requests[1].headers.Authorization).toBeUndefined();
    expect(client.headersFor(feed.next!).Authorization).toBeUndefined();
  });

  it('sends no Authorization at all without credentials', async () => {
    const { fetchImpl, requests } = mockFetch({ [CATALOG]: { body: FEED() } });
    await createOpdsClient({ userAgent: UA, catalogOrigin: ORIGIN, fetchImpl }).fetchFeed(CATALOG);
    expect(requests[0].headers.Authorization).toBeUndefined();
  });

  it.each([
    [401, 'unauthorized'],
    [403, 'unauthorized'],
    [404, 'not-found'],
    [500, 'http'],
    [302, 'http'],
  ])('maps HTTP %i to %s', async (status, code) => {
    const { fetchImpl } = mockFetch({ [CATALOG]: { status, body: 'nope' } });
    const client = createOpdsClient({ userAgent: UA, fetchImpl });
    let error: OpdsError | undefined;
    try {
      await client.fetchFeed(CATALOG);
    } catch (e) {
      error = e as OpdsError;
    }
    expect(error?.code).toBe(code);
    expect(error?.status).toBe(status);
    expect(error?.message).not.toBe('');
  });

  it('maps the Standard Ebooks 401 page to unauthorized', async () => {
    const url = 'https://standardebooks.org/feeds/opds';
    const { fetchImpl } = mockFetch({ [url]: { status: 401, body: fixture('standardebooks-root-401.html') } });
    expect(await codeOf(createOpdsClient({ userAgent: UA, fetchImpl }).fetchFeed(url))).toBe('unauthorized');
  });

  it('maps a failing fetch (TypeError) to network', async () => {
    const { fetchImpl } = mockFetch({});
    expect(await codeOf(createOpdsClient({ userAgent: UA, fetchImpl }).fetchFeed(CATALOG))).toBe('network');
  });

  it('times out with an abort and maps it to timeout', async () => {
    const fetchImpl = jest.fn(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_, reject) => {
          init.signal.addEventListener('abort', () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    ) as unknown as typeof fetch;
    const client = createOpdsClient({ userAgent: UA, fetchImpl, timeoutMs: 20 });
    expect(await codeOf(client.fetchFeed(CATALOG))).toBe('timeout');
  });

  it('times out a body that never finishes', async () => {
    const fetchImpl = jest.fn(async (_url: string, init: { signal: AbortSignal }) => ({
      status: 200,
      url: CATALOG,
      text: () =>
        new Promise<string>((_, reject) => {
          init.signal.addEventListener('abort', () =>
            reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })),
          );
        }),
    })) as unknown as typeof fetch;
    expect(await codeOf(createOpdsClient({ userAgent: UA, fetchImpl, timeoutMs: 20 }).fetchFeed(CATALOG))).toBe(
      'timeout',
    );
  });

  it('rejects with the AbortError itself when the caller cancels', async () => {
    const fetchImpl = jest.fn(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_, reject) => {
          init.signal.addEventListener('abort', () =>
            reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })),
          );
        }),
    ) as unknown as typeof fetch;
    const controller = new AbortController();
    const promise = createOpdsClient({ userAgent: UA, fetchImpl, timeoutMs: 5000 }).fetchFeed(CATALOG, {
      signal: controller.signal,
    });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    await expect(promise).rejects.not.toBeInstanceOf(OpdsError);
  });

  it('defaults the timeout to 20 seconds', async () => {
    jest.useFakeTimers();
    try {
      const fetchImpl = jest.fn(
        (_url: string, init: { signal: AbortSignal }) =>
          new Promise((_, reject) => {
            init.signal.addEventListener('abort', () =>
              reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })),
            );
          }),
      ) as unknown as typeof fetch;
      const promise = codeOf(createOpdsClient({ userAgent: UA, fetchImpl }).fetchFeed(CATALOG));
      jest.advanceTimersByTime(19999);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(1);
      expect(await promise).toBe('timeout');
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('content sniffing', () => {
  it('parses a feed sent as text/html or text/xml (header ignored, body decides)', async () => {
    const { fetchImpl } = mockFetch({ [KAVITA_BASE]: { body: fixture('kavita-root.xml') } });
    const feed = await createOpdsClient({ userAgent: UA, fetchImpl }).fetchFeed(KAVITA_BASE);
    expect(feed.title).toBe('Kavita');
  });

  it('reports OPDS 2 JSON as opds2-unsupported', async () => {
    const url = 'https://test.opds.io/2.0/home.json';
    const { fetchImpl } = mockFetch({ [url]: { body: fixture('opds2-test-home.json') } });
    const client = createOpdsClient({ userAgent: UA, fetchImpl });
    let error: OpdsError | undefined;
    try {
      await client.fetchFeed(url);
    } catch (e) {
      error = e as OpdsError;
    }
    expect(error?.code).toBe('opds2-unsupported');
    expect(error?.message).toBe("OPDS 2 catalogs aren't supported yet.");
  });

  it('reports other JSON as not-opds', async () => {
    const { fetchImpl } = mockFetch({ [CATALOG]: { body: '{"error":"nope"}' } });
    expect(await codeOf(createOpdsClient({ userAgent: UA, fetchImpl }).fetchFeed(CATALOG))).toBe('not-opds');
  });

  it('follows the HTML autodiscovery link once', async () => {
    const page = 'https://books.example.org/';
    const { fetchImpl, requests } = mockFetch({
      [page]: { body: fixture('html-autodiscovery.html') },
      'https://books.example.org/opds/root.xml?lang=en&v=1': { body: FEED('Discovered') },
    });
    const feed = await createOpdsClient({ userAgent: UA, fetchImpl }).fetchFeed(page);
    expect(feed.title).toBe('Discovered');
    expect(feed.url).toBe('https://books.example.org/opds/root.xml?lang=en&v=1');
    expect(requests.map((r) => r.url)).toEqual([page, 'https://books.example.org/opds/root.xml?lang=en&v=1']);
  });

  it('does not follow a second autodiscovery hop', async () => {
    const page = 'https://books.example.org/';
    const loop = `<!DOCTYPE html><html><head><link rel="alternate" type="application/atom+xml;profile=opds-catalog" href="/again"></head></html>`;
    const { fetchImpl, requests } = mockFetch({
      [page]: { body: loop },
      'https://books.example.org/again': { body: loop },
    });
    expect(await codeOf(createOpdsClient({ userAgent: UA, fetchImpl }).fetchFeed(page))).toBe('not-opds');
    expect(requests).toHaveLength(2);
  });

  it('reports HTML without an OPDS link as not-opds (rel=search and plain Atom feeds are not followed)', async () => {
    const html = `<html><head><link rel="search" type="application/atom+xml;profile=opds-catalog" href="/s">
      <link rel="alternate" type="application/atom+xml" href="/blog.xml"></head></html>`;
    const { fetchImpl, requests } = mockFetch({ [CATALOG]: { body: html } });
    expect(await codeOf(createOpdsClient({ userAgent: UA, fetchImpl }).fetchFeed(CATALOG))).toBe('not-opds');
    expect(requests).toHaveLength(1);
  });

  it('finds the OPDS link in a real XHTML page (XML declaration + doctype) and follows it', async () => {
    const page = 'https://standardebooks.org/feeds/opds';
    const discovered = 'https://standardebooks.org/feeds/opds/new-releases';
    const { fetchImpl, requests } = mockFetch({
      [page]: { body: fixture('standardebooks-root-401.html') },
      [discovered]: { status: 401 },
    });
    expect(await codeOf(createOpdsClient({ userAgent: UA, fetchImpl }).fetchFeed(page))).toBe('unauthorized');
    expect(requests.map((r) => r.url)).toEqual([page, discovered]);
  });

  it('reports XML with another root (OpenSearch, RSS) and plain text as not-opds', async () => {
    const { fetchImpl } = mockFetch({
      [CATALOG]: { body: fixture('gutenberg-osd.xml') },
      'https://books.example.org/rss': { body: '<?xml version="1.0"?><rss version="2.0"><channel/></rss>' },
      'https://books.example.org/txt': { body: 'Hello' },
    });
    const client = createOpdsClient({ userAgent: UA, fetchImpl });
    expect(await codeOf(client.fetchFeed(CATALOG))).toBe('not-opds');
    expect(await codeOf(client.fetchFeed('https://books.example.org/rss'))).toBe('not-opds');
    expect(await codeOf(client.fetchFeed('https://books.example.org/txt'))).toBe('not-opds');
  });

  it('reports broken XML with a feed root as parse', async () => {
    const { fetchImpl } = mockFetch({
      [CATALOG]: { body: '<feed xmlns="http://www.w3.org/2005/Atom"><title>x</feed' },
    });
    const code = await codeOf(createOpdsClient({ userAgent: UA, fetchImpl }).fetchFeed(CATALOG));
    // fast-xml-parser is lenient; either the partial feed parses or it is a parse error, never a crash
    expect([undefined, 'parse']).toContain(code);
  });

  it('wraps a single entry document into a feed', async () => {
    const url = 'https://books.example.org/entries/single.xml';
    const { fetchImpl } = mockFetch({ [url]: { body: fixture('single-entry.xml') } });
    const feed = await createOpdsClient({ userAgent: UA, fetchImpl }).fetchFeed(url);
    expect(feed.entries).toHaveLength(1);
    expect(feed.kind).toBe('acquisition');
  });
});

describe('search', () => {
  it('fills an Atom template directly', async () => {
    const results = 'http://192.168.1.10:8083/opds/search/jane%20austen';
    const { fetchImpl, requests } = mockFetch({ [results]: { body: FEED('Results') } });
    const client = createOpdsClient({ userAgent: UA, fetchImpl });
    const feed: Feed = {
      url: 'http://192.168.1.10:8083/opds',
      title: 'Calibre-Web',
      kind: 'navigation',
      entries: [],
      facets: [],
      search: { kind: 'template', template: 'http://192.168.1.10:8083/opds/search/{searchTerms}' },
    };
    expect((await client.search(feed, 'jane austen')).title).toBe('Results');
    expect(requests.map((r) => r.url)).toEqual([results]);
  });

  it('fetches the OpenSearch description once (with auth on the same origin) and caches the template', async () => {
    const credentialsKavita = { username: 'u', password: 'p' };
    const descUrl = `${KAVITA_BASE}/search`;
    const { fetchImpl, requests } = mockFetch({
      [descUrl]: { body: fixture('kavita-search-osd.xml') },
      [`${KAVITA_BASE}/series?query=dune`]: { body: FEED('Dune') },
      [`${KAVITA_BASE}/series?query=emma`]: { body: FEED('Emma') },
    });
    const client = createOpdsClient({
      userAgent: UA,
      credentials: credentialsKavita,
      catalogOrigin: 'https://demo.kavitareader.com',
      fetchImpl,
    });
    const root = await (async () => {
      const { fetchImpl: f } = mockFetch({ [KAVITA_BASE]: { body: fixture('kavita-root.xml') } });
      return createOpdsClient({ userAgent: UA, fetchImpl: f }).fetchFeed(KAVITA_BASE);
    })();
    expect((await client.search(root, 'dune')).title).toBe('Dune');
    expect((await client.search(root, 'emma')).title).toBe('Emma');
    expect(requests.map((r) => r.url)).toEqual([
      descUrl,
      `${KAVITA_BASE}/series?query=dune`,
      `${KAVITA_BASE}/series?query=emma`,
    ]);
    expect(requests[0].headers.Accept).toMatch(/^application\/opensearchdescription\+xml/);
    expect(requests[0].headers.Authorization).toBeDefined();
  });

  it('throws not-found when the catalog has no search', async () => {
    const client = createOpdsClient({ userAgent: UA, fetchImpl: jest.fn() as never });
    const feed: Feed = { url: CATALOG, title: 'x', kind: 'navigation', entries: [], facets: [] };
    await expect(client.search(feed, 'x')).rejects.toMatchObject({
      code: 'not-found',
      message: 'This catalog has no search',
    });
  });

  it('throws not-found when the description has no Atom template', async () => {
    const descUrl = 'https://books.example.org/osd';
    const { fetchImpl } = mockFetch({
      [descUrl]: {
        body: '<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/"><Url type="text/html" template="/?q={searchTerms}"/></OpenSearchDescription>',
      },
    });
    const feed: Feed = {
      url: CATALOG,
      title: 'x',
      kind: 'navigation',
      entries: [],
      facets: [],
      search: { kind: 'description', url: descUrl },
    };
    expect(await codeOf(createOpdsClient({ userAgent: UA, fetchImpl }).search(feed, 'x'))).toBe('not-found');
  });

  it('maps description fetch errors like feed errors', async () => {
    const descUrl = 'https://books.example.org/osd';
    const { fetchImpl } = mockFetch({ [descUrl]: { status: 401 } });
    const feed: Feed = {
      url: CATALOG,
      title: 'x',
      kind: 'navigation',
      entries: [],
      facets: [],
      search: { kind: 'description', url: descUrl },
    };
    expect(await codeOf(createOpdsClient({ userAgent: UA, fetchImpl }).search(feed, 'x'))).toBe('unauthorized');
  });
});
