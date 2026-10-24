// Public API of the OPDS core (OPDS 1.x catalogs). The app imports from '@/opds' only.
export * from './types';
export { createOpdsClient, base64Utf8, basicAuthHeader } from './client';
export { decodeEntities, htmlToText } from './html';
export { formatLabel, isDrmType, mimeBase } from './mime';
export { buildSearchUrl, parseOpenSearchDescription } from './opensearch';
export type { SearchUrlOptions } from './opensearch';
export { parseFeed } from './parse';
export { normalizeCatalogUrl, originOf, resolveUrl } from './url';
