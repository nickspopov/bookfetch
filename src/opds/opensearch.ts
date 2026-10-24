// OpenSearch description documents and URL templates.
import { isAtomType, mimeParams } from './mime';
import type { SearchSpec } from './types';
import { resolveTemplate } from './url';
import { attr, children, parseXml } from './xml';

/**
 * Picks the Atom <Url> of an OpenSearch description (preferring profile=opds-catalog / kind=acquisition)
 * and returns it as an absolute template. Undefined when the document has no usable Atom template.
 */
export function parseOpenSearchDescription(xml: string, baseUrl: string): SearchSpec | undefined {
  let rootName: string;
  let root: Record<string, unknown>;
  try {
    [rootName, root] = parseXml(xml);
  } catch {
    return undefined;
  }
  if (rootName !== 'opensearch:OpenSearchDescription' && rootName !== 'OpenSearchDescription') return undefined;
  const urls = children(root, 'opensearch:Url', 'Url')
    .map((node) => ({
      node,
      type: attr(node, 'type') ?? '',
      template: attr(node, 'template') ?? '',
      rel: (attr(node, 'rel') ?? 'results').trim().toLowerCase(),
    }))
    .filter((u) => isAtomType(u.type) && u.template.trim() !== '' && u.rel.split(/\s+/).includes('results'));
  const score = (type: string) => {
    const params = mimeParams(type);
    return (params.profile === 'opds-catalog' ? 2 : 0) + (params.kind === 'acquisition' ? 1 : 0);
  };
  const best = [...urls].sort((a, b) => score(b.type) - score(a.type))[0];
  if (!best) return undefined;
  const template = resolveTemplate(best.template, baseUrl);
  if (!template) return undefined;
  const spec: SearchSpec = { kind: 'template', template };
  const indexOffset = Number(attr(best.node, 'indexOffset'));
  const pageOffset = Number(attr(best.node, 'pageOffset'));
  if (attr(best.node, 'indexOffset') !== undefined && Number.isInteger(indexOffset)) spec.indexOffset = indexOffset;
  if (attr(best.node, 'pageOffset') !== undefined && Number.isInteger(pageOffset)) spec.pageOffset = pageOffset;
  return spec;
}

export interface SearchUrlOptions {
  /** value for a required {startIndex}; default 0 */
  indexOffset?: number;
  /** value for a required {startPage}; default 1 */
  pageOffset?: number;
}

const EMPTY = '\u0000';

/**
 * Fills an OpenSearch URL template: {searchTerms} gets the encoded query; optional parameters ({x?}) are
 * dropped together with their now-empty query parameter; required {startPage}/{startIndex}/{count}/{language}
 * get 1 / 0 (or the given offsets) / 20 / "*"; other required parameters become empty.
 */
export function buildSearchUrl(template: string, query: string, options: SearchUrlOptions = {}): string {
  const filled = template.replace(/\{([^{}]*)\}/g, (_, rawName: string) => {
    const optional = rawName.endsWith('?');
    const name = (optional ? rawName.slice(0, -1) : rawName).trim();
    const local = name.includes(':') ? name.slice(name.lastIndexOf(':') + 1) : name;
    if (local === 'searchTerms' && !name.includes(':')) return encodeURIComponent(query.trim());
    if (optional) return EMPTY;
    switch (local) {
      case 'startPage':
        return String(options.pageOffset ?? 1);
      case 'startIndex':
        return String(options.indexOffset ?? 0);
      case 'count':
        return '20';
      case 'language':
        return '*';
      default:
        return EMPTY;
    }
  });
  if (!filled.includes(EMPTY)) return filled;

  const hashAt = filled.indexOf('#');
  const beforeHash = hashAt === -1 ? filled : filled.slice(0, hashAt);
  const hash = hashAt === -1 ? '' : filled.slice(hashAt);
  const queryAt = beforeHash.indexOf('?');
  const path = (queryAt === -1 ? beforeHash : beforeHash.slice(0, queryAt)).split(EMPTY).join('');
  if (queryAt === -1) return path + hash.split(EMPTY).join('');
  const params = beforeHash
    .slice(queryAt + 1)
    .split('&')
    .filter((pair) => {
      const eq = pair.indexOf('=');
      const value = eq === -1 ? pair : pair.slice(eq + 1);
      return value !== EMPTY && pair !== '';
    })
    .map((pair) => pair.split(EMPTY).join(''));
  return `${path}${params.length > 0 ? `?${params.join('&')}` : ''}${hash.split(EMPTY).join('')}`;
}
