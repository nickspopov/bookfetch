# OPDS core (`src/opds`)

The app talks to catalogs only through `@/opds` (`src/opds/index.ts`). The core is plain TypeScript with one
dependency (`fast-xml-parser` 5); it has no React or Expo imports and is tested with Jest (`npx jest`).

| Module | Role |
| --- | --- |
| `types.ts` | Public contract (`Feed`, `Entry`, `Acquisition`, `OpdsError`, `OpdsClient`, ...) |
| `xml.ts` | XML parsing and namespace normalisation |
| `parse.ts` | `parseFeed` — Atom feed / entry document → `Feed` |
| `opensearch.ts` | `parseOpenSearchDescription`, `buildSearchUrl` |
| `client.ts` | `createOpdsClient` — fetch, auth, status mapping, sniffing, search |
| `url.ts` | RFC 3986 resolution, `originOf`, `normalizeCatalogUrl` |
| `mime.ts` | `formatLabel`, DRM detection, MIME parameters |
| `html.ts` | `htmlToText`, `decodeEntities` |

## Supported

OPDS 1.0–1.2 (Atom): navigation and acquisition feeds, single Atom entry documents, pagination, OpenSearch
descriptions and Atom search templates, HTTP Basic auth, keys in the URL (Kavita), HTML autodiscovery.

## Mapping rules

**XML and namespaces.** Element names are rewritten using the `xmlns` declarations in scope, including
declarations on the element itself (Kavita writes `<totalResults xmlns="http://a9.com/-/spec/opensearch/1.1/">`).
Atom elements become bare names, so `<atom:entry>` and `<entry>` read the same. Other known namespaces get
fixed prefixes: `opds:`, `dc:`, `dcterms:`, `opensearch:`, `thr:`, `pse:`. Undeclared prefixes stay as written,
and elements with no namespace count as Atom. `content`/`summary` are kept as raw markup so that `xhtml` and
`html` keep their paragraph order. Entities (XML, HTML named, DOCTYPE-declared) and CDATA are decoded.

**Text.** Titles and subtitles become one line. Summaries are plain text: tags are stripped, block ends become
`\n\n`, `<br>` becomes `\n`, list items become `• ` lines, and `script`/`style` are dropped. When both `summary`
and `content` exist, the longer one wins. Plain-text constructs are only stripped when they contain common HTML
tags, so a title like `Fish & Chips <Cookbook>` stays as written. A missing title becomes `Untitled`.

**URLs.** Every href resolves against the link's, then the entry's, then the feed's `xml:base`, then the feed URL
(`response.url` after redirects). This follows RFC 3986 and does not use the global `URL`: React Native's
`URL` only concatenates the base and the reference and ignores `../`, `?query` and `#frag`. The scheme is never
upgraded (http stays http) and query strings are kept. Spaces and non-ASCII characters are percent-encoded; existing
`%XX` escapes are left as they are. Templates (`{searchTerms}`) are resolved without encoding the braces.
`data:` URIs (Gutenberg's inline thumbnails) pass through unchanged.

**Feed links.** `next`, `previous`/`prev`, `start`, `first`, `last` and `up` are read, with IANA relation URIs
shortened. For search, an Atom link with `{searchTerms}` gives `{kind:'template'}` and is preferred over an
`application/opensearchdescription+xml` link, which gives `{kind:'description'}`. `rel="http://opds-spec.org/facet"`
links fill `facets` (`opds:facetGroup`, `opds:activeFacet`, `thr:count`). `opensearch:totalResults` fills
`totalResults`. The feed `kind` is `navigation` when every entry is a navigation entry. An empty feed uses
the self link's `kind=` parameter and otherwise counts as `acquisition`.

**Entries.** An entry is a navigation entry when it has no acquisition link but does have one of these:
- a `subsection`/`collection`/`http://opds-spec.org/sort/*`/featured/recommended rel;
- an Atom-typed link (not self/start/up/search/related);
- an Atom entry `alternate`;
- as a last resort, an Atom `related` link.

Covers come from `http://opds-spec.org/image`, `/cover` or `x-stanza-cover-image`, and thumbnails from
`.../image/thumbnail` or `x-stanza-cover-image-thumbnail`. Any `image/*` link is a fallback, except PSE stream
templates. When only a cover or only a thumbnail is present, it fills both fields.

The other entry fields map like this:
- Authors: `author/name`, falling back to `dc:creator`.
- Language: `dcterms:language`/`dc:language`.
- Publisher: `dc:publisher`, or Calibre-Web's `<publisher><name>`.
- Issued: `dcterms:issued`/`dc:issued`/`published`.
- Categories: `@label`, else `@term`, de-duplicated.
- `alternateHref`: the `alternate` link with an HTML or XHTML type.

Missing ids fall back to the navigation href, the first acquisition href or `entry-<n>`. Repeated ids within
a feed get a `#2`, `#3` suffix (Kavita repeats them), so `entry.id` is safe as a list key.

**Acquisitions.** Rels map to kinds:
- `http://opds-spec.org/acquisition` → `generic`
- `/open-access` → `open-access`
- `/sample` and `/preview` → `sample`
- `/borrow`, `/buy`, `/subscribe` → the kind of the same name

Unknown `/acquisition/*` rels count as `generic`. Nested `opds:indirectAcquisition` elements fill `indirectTypes`,
outermost first. The `length` attribute gives `size`. Identical href+type pairs are listed once.

`downloadable` is true only when all of these hold:
- the kind is open-access, generic or sample;
- neither the link type nor any indirect type is DRM (`adobe.adept`, or an `lcp` token such as `application/vnd.readium.lcp.license.v1.0+json`);
- the href is http(s).

Wrapper links (DRM, HTML, Atom, or untyped) are labelled with the innermost non-DRM indirect type. An
`application/x-mobipocket-ebook` file whose href ends in `.azw3` is labelled `Kindle (AZW3)`.

**formatLabel.** EPUB, Kobo EPUB, PDF, Kindle (MOBI), Kindle (AZW3), FB2, FB2 (zip), CBZ, CBR, CB7, DjVu, Text,
HTML, RTF, ZIP, RAR, DOC/DOCX/ODT, CHM, Audio (`audio/*`). Anything else gets the subtype in upper case, without
`x-`/`vnd.` and `+suffix`, cut to 12 characters. An empty type gives `File`. Parameters are ignored, and matching
is case-insensitive.

**OpenSearch.** The core picks the description's `Url` with an Atom type and `rel` `results` (or no rel). It
prefers `profile=opds-catalog`, then `kind=acquisition`, resolves the template against the description URL, and
keeps `indexOffset`/`pageOffset`. `buildSearchUrl` fills the parameters like this:
- `{searchTerms}` gets `encodeURIComponent(query.trim())`.
- Optional `{x?}` parameters are removed, together with their now-empty query pair.
- Required `{startPage}`, `{startIndex}`, `{count}` and `{language}` become `pageOffset ?? 1`, `indexOffset ?? 0`, `20` and `*`.
- Other required parameters become empty.

The client caches each resolved template per description URL.

## Client

`createOpdsClient({ userAgent, credentials?, catalogOrigin?, timeoutMs?, fetchImpl? })`

- Every request sends `User-Agent` and `Accept: application/atom+xml;profile=opds-catalog, application/atom+xml;q=0.9, application/xml;q=0.8, */*;q=0.5`
  (OpenSearch descriptions get an OpenSearch-first Accept).
- `Authorization: Basic …` goes only to URLs whose origin (scheme, host and port, with default ports
  normalised) equals `catalogOrigin`. That rule applies to each request, so after a redirect to another origin
  (`response.url`) the next pages, autodiscovered feeds and descriptions there go out without credentials.
  `headersFor(url)` applies the same rule for images and downloads. Base64 is computed from UTF-8 bytes by the
  core itself (no `Buffer`; `btoa` fails on non-Latin-1 text).
- Timeout: `AbortController`, 20 s by default, covering the headers and the body.
- `fetchFeed(url, { signal })` and `search(feed, q, { signal })` take an optional caller signal. When the
  caller cancels, the promise rejects with the `AbortError` itself, not an `OpdsError`, so screens can ignore it.
- The body decides, not `Content-Type`:
  - JSON with `"metadata"` plus `"publications"`/`"navigation"`/`"groups"` → `opds2-unsupported`.
  - Other JSON → `not-opds`.
  - Root element `feed` → parsed.
  - Root element `entry` → wrapped into a one-entry acquisition feed.
  - HTML (doctype or `<html>` root) → the core follows `<link rel="alternate" type="application/atom+xml;profile=opds-catalog">` once (attributes in any order); without one it is `not-opds`.
  - Any other XML root, or plain text → `not-opds`.
- `search`: a template is filled and fetched. A description is fetched under the same auth rules, parsed and
  cached, then the template is fetched. A feed without search throws `OpdsError('not-found', 'This catalog has no search')`.

## Error codes (`OpdsError.code`)

| Code | When | Message (shown to users) |
| --- | --- | --- |
| `invalid-url` | `normalizeCatalogUrl` rejected the input | Enter a full web address that starts with http:// or https://. |
| `network` | fetch threw (offline, DNS, TLS, refused) | Can't reach the server. Check the address and your connection. |
| `timeout` | no complete answer within `timeoutMs` | The server took too long to answer. |
| `unauthorized` | HTTP 401 / 403 (`status` set) | The server needs a valid username and password. / The server refused access with these credentials. |
| `not-found` | HTTP 404 / 410; no search | Nothing was found at this address. / This catalog has no search |
| `http` | any other non-2xx (`status` set) | The server answered with an error (HTTP n). |
| `not-opds` | HTML without an OPDS link, other XML, JSON, text | This address doesn't look like an OPDS catalog. |
| `opds2-unsupported` | OPDS 2 JSON | OPDS 2 catalogs aren't supported yet. |
| `parse` | empty or unreadable XML | The catalog sent a feed that couldn't be read. |

## normalizeCatalogUrl

The function goes through these steps:
1. Trim the input. Reject it when it is empty or has whitespace inside.
2. Map `opds://` and `opds+https://` to `https://`, and `opds+http://` to `http://`.
3. Add `https://` when there is no scheme. `host:8080/path` counts as a host with a port, not a scheme.
4. Allow only http and https; `javascript:`, `file:`, `data:`, `ftp:`, `mailto:` and others get `invalid-url`.
5. Validate the host (ASCII names, IPv4, `[IPv6]`, `localhost`) and the port. Lower-case the scheme and host, and
   keep the path and query (an empty path becomes `/`).

## Tested servers (fixtures in `__fixtures__/opds/`)

| Server | Fixtures | Kind |
| --- | --- | --- |
| Project Gutenberg | `gutenberg-root.xml`, `gutenberg-search-austen.xml`, `gutenberg-book-1342.xml`, `gutenberg-osd.xml` | live, 2026-10-24 |
| Standard Ebooks | `standardebooks-search-austen.xml`, `standardebooks-root-401.html` | live |
| Kavita demo (key in URL) | `kavita-root.xml`, `kavita-libraries.xml`, `kavita-library-1.xml`, `kavita-series-56.xml`, `kavita-search-osd.xml` | live |
| OPDS 2 test catalog | `opds2-test-home.json` | live, trimmed |
| Calibre-Web | `calibre-web-root.xml`, `calibre-web-new.xml` | hand-made from its templates |
| Komga | `komga-series.xml` | hand-made from its OPDS 1.2 controller |
| Edge cases | `edge-cases.xml`, `single-entry.xml`, `html-autodiscovery.html` | hand-made |

## Known limits

- OPDS 2 (JSON) is detected and reported, not parsed.
- OPDS-PSE page streaming links are ignored. Facets are parsed but the app shows no facet UI.
- Only HTTP Basic auth is supported. Digest, cookie/session login forms, OAuth and client certificates are not.
- Self-signed or otherwise invalid TLS certificates fail as `network`. There is no trust override.
- Redirects are followed by the platform's fetch. Whether it keeps an `Authorization` header on a cross-origin
  redirect is up to NSURLSession/OkHttp; OkHttp drops it on a host change.
- Gutenberg's OpenSearch template is `http://m.gutenberg.org/...`. The core does not upgrade it, so the app's
  transport security settings decide whether plain-http catalogs load.
- Hostnames must be ASCII (no IDN/punycode conversion).
- `fast-xml-parser` is lenient: some malformed XML still parses into a partial feed instead of failing with `parse`.
