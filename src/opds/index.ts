// Public API of the OPDS core. Stubs; the core lane replaces the bodies (and may split into modules),
// keeping these exported names and signatures.
export * from './types';
import type { ClientOptions, Feed, OpdsClient, SearchSpec } from './types';

const todo = (): never => {
  throw new Error('OPDS core not implemented yet');
};

export function parseFeed(xml: string, feedUrl: string): Feed {
  return todo();
}
export function parseOpenSearchDescription(xml: string, baseUrl: string): SearchSpec | undefined {
  return todo();
}
export function buildSearchUrl(template: string, query: string): string {
  return todo();
}
export function createOpdsClient(options: ClientOptions): OpdsClient {
  return todo();
}
/** MIME type -> short label ("EPUB", "PDF", "Kindle (AZW3)", ...) */
export function formatLabel(mime: string): string {
  return todo();
}
/** Normalises what a user typed: trims, adds https:// when no scheme, rejects non-http(s) with OpdsError('invalid-url'). */
export function normalizeCatalogUrl(input: string): string {
  return todo();
}
