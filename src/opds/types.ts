// OPDS core contract shared by the app and the parser/client.
// Owned by the core lane; the app lane codes against these types. Only ADD fields, never rename or remove.

export type AcquisitionKind =
  | 'open-access' // http://opds-spec.org/acquisition/open-access
  | 'generic' // http://opds-spec.org/acquisition
  | 'sample' // http://opds-spec.org/acquisition/sample or /preview
  | 'borrow' // hidden in the app
  | 'buy' // hidden in the app
  | 'subscribe'; // hidden in the app

export interface Acquisition {
  href: string; // absolute URL
  type: string; // MIME type as given, e.g. "application/epub+zip"; "" when missing
  kind: AcquisitionKind;
  title?: string;
  /** opds:indirectAcquisition types, outermost first (DRM wrappers etc.) */
  indirectTypes: string[];
  /** bytes, from link length attribute when present */
  size?: number;
  /** short label for the UI: "EPUB", "Kindle (AZW3)", "PDF", "CBZ", "FB2", ... */
  formatLabel: string;
  /** true when the app may offer a direct download (not buy/borrow/subscribe, no DRM indirection) */
  downloadable: boolean;
}

export interface NavigationLink {
  href: string; // absolute URL of the target feed
  rel?: string;
  type?: string;
}

export interface Entry {
  id: string;
  title: string;
  authors: string[];
  /** plain text (HTML stripped) */
  summary?: string;
  updated?: string;
  issued?: string;
  language?: string;
  publisher?: string;
  categories: string[];
  coverUrl?: string;
  thumbnailUrl?: string;
  /** set for navigation entries (subsection/catalog links) */
  navigation?: NavigationLink;
  acquisitions: Acquisition[];
  /** a related HTML page for the book, when given */
  alternateHref?: string;
}

export type SearchSpec =
  | { kind: 'template'; template: string; indexOffset?: number; pageOffset?: number } // Atom URL template with {searchTerms}
  | { kind: 'description'; url: string }; // OpenSearch description document to fetch first

export interface FacetLink {
  title: string;
  href: string;
  group?: string;
  active: boolean;
  count?: number;
}

export interface Feed {
  url: string; // the URL this feed was fetched from (after redirects when known)
  id?: string;
  title: string;
  subtitle?: string;
  updated?: string;
  iconUrl?: string;
  /** 'navigation' when every entry is a navigation entry, else 'acquisition' */
  kind: 'navigation' | 'acquisition';
  entries: Entry[];
  next?: string;
  previous?: string;
  start?: string;
  /** first/last page of a paged feed (rel="first"/"last"), when given */
  first?: string;
  last?: string;
  up?: string;
  search?: SearchSpec;
  facets: FacetLink[];
  /** opensearch:totalResults when present */
  totalResults?: number;
}

export type OpdsErrorCode =
  | 'invalid-url'
  | 'network' // offline, DNS, TLS, connection refused
  | 'timeout'
  | 'unauthorized' // 401/403
  | 'not-found' // 404
  | 'http' // other non-2xx
  | 'not-opds' // HTML or something else without an OPDS feed link
  | 'opds2-unsupported' // JSON / OPDS 2 feed
  | 'parse'; // XML could not be parsed

export class OpdsError extends Error {
  code: OpdsErrorCode;
  status?: number;
  constructor(code: OpdsErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'OpdsError';
    this.code = code;
    this.status = status;
  }
}

export interface Credentials {
  username: string;
  password: string;
}

export interface ClientOptions {
  /** sent on every request; the app passes "Bookfetch/<version> (+https://nickpopov.com/bookfetch)" */
  userAgent: string;
  /** HTTP Basic credentials, sent only to the catalog's own origin */
  credentials?: Credentials;
  /** origin (scheme://host[:port]) the credentials belong to */
  catalogOrigin?: string;
  timeoutMs?: number; // default 20000
  fetchImpl?: typeof fetch; // tests inject a mock
}

export interface RequestOptions {
  /** cancels the request; the promise then rejects with the AbortError itself (not an OpdsError) */
  signal?: AbortSignal;
}

export interface OpdsClient {
  /** fetch + parse; follows HTML autodiscovery (<link rel="alternate" type="application/atom+xml;profile=opds-catalog">) once */
  fetchFeed(url: string, options?: RequestOptions): Promise<Feed>;
  /** resolves feed.search (fetching the OpenSearch description when needed) and returns the results feed */
  search(feed: Feed, query: string, options?: RequestOptions): Promise<Feed>;
  /** headers to use for images and downloads of the given URL (User-Agent, and Authorization only for the catalog origin) */
  headersFor(url: string): Record<string, string>;
}
