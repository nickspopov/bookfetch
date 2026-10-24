// XML parsing with namespace normalisation.
// Element names are rewritten to canonical prefixes resolved from the xmlns declarations in scope:
// Atom elements become bare names ("entry", "link"), others become "opds:", "dc:", "dcterms:",
// "opensearch:", "thr:", "pse:". A feed that writes <atom:entry> or redeclares the default
// namespace on a single element (<totalResults xmlns="http://a9.com/-/spec/opensearch/1.1/">) reads
// the same as one that does not. Undeclared prefixes are kept as written (sloppy feeds use "dc:"
// without declaring it); elements in no namespace are treated as Atom.
import { XMLParser } from 'fast-xml-parser';

import { OpdsError } from './types';

export type XmlNode = Record<string, unknown>;

export const TEXT = '#text';
export const ATTR = '@_';

const CANONICAL: Record<string, string> = {
  'http://www.w3.org/2005/atom': '',
  'http://opds-spec.org/2010/catalog': 'opds',
  'http://purl.org/dc/elements/1.1/': 'dc',
  'http://purl.org/dc/terms/': 'dcterms',
  'http://a9.com/-/spec/opensearch/1.1/': 'opensearch',
  'http://a9.com/-/spec/opensearchrss/1.0/': 'opensearch',
  'http://purl.org/syndication/thread/1.0': 'thr',
  'http://vaemendis.net/opds-pse/ns': 'pse',
  'http://www.w3.org/1999/xhtml': 'xhtml',
  'http://www.w3.org/xml/1998/namespace': 'xml',
};

// content/summary keep their raw markup so xhtml/html can be turned into text in order.
const RAW_ELEMENTS = ['content', 'summary'];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: ATTR,
  textNodeName: TEXT,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: true,
  ignoreDeclaration: true,
  ignorePiTags: true,
  removeNSPrefix: false,
  stopNodes: RAW_ELEMENTS.flatMap((name) => [`*.${name}`, `*.atom:${name}`]),
});

type Scope = Record<string, string | undefined>;

function canonicalName(name: string, scope: Scope, isAttribute: boolean): string {
  const colon = name.indexOf(':');
  const prefix = colon === -1 ? '' : name.slice(0, colon);
  const local = colon === -1 ? name : name.slice(colon + 1);
  if (prefix === 'xml') return `xml:${local}`;
  if (prefix === '' && isAttribute) return local; // unprefixed attributes have no namespace
  const uri = scope[prefix];
  if (uri === undefined) return prefix === '' || prefix === 'atom' ? local : name;
  const canon = CANONICAL[uri.trim().toLowerCase().replace(/^https:/, 'http:')];
  if (canon === '') return local;
  if (canon !== undefined) return `${canon}:${local}`;
  return prefix === '' ? `?:${local}` : name;
}

function normalizeNode(value: unknown, parentScope: Scope): unknown {
  if (Array.isArray(value)) return value.map((v) => normalizeNode(v, parentScope));
  if (value === null || typeof value !== 'object') return value;
  const node = value as XmlNode;
  let scope = parentScope;
  for (const key of Object.keys(node)) {
    if (key === `${ATTR}xmlns`) scope = { ...scope, '': String(node[key]) };
    else if (key.startsWith(`${ATTR}xmlns:`)) scope = { ...scope, [key.slice(ATTR.length + 6)]: String(node[key]) };
  }
  const out: XmlNode = {};
  for (const key of Object.keys(node)) {
    if (key === TEXT) {
      out[TEXT] = node[key];
      continue;
    }
    if (key.startsWith(ATTR)) {
      const name = key.slice(ATTR.length);
      if (name === 'xmlns' || name.startsWith('xmlns:')) continue;
      out[ATTR + canonicalName(name, scope, true)] = node[key];
      continue;
    }
    const canon = canonicalName(key, scope, false);
    const child = normalizeNode(node[key], scope);
    if (canon in out) {
      out[canon] = [...asArray(out[canon]), ...asArray(child)];
    } else {
      out[canon] = child;
    }
  }
  return out;
}

/**
 * Parses an XML document and returns [rootName, rootNode] with canonical element names.
 * Throws OpdsError('parse') for empty or non-XML input.
 */
export function parseXml(xml: string): [string, XmlNode] {
  const source = (xml ?? '').replace(/^﻿/, '');
  if (source.trim() === '' || !source.trimStart().startsWith('<')) {
    throw new OpdsError('parse', "The catalog sent something that isn't XML.");
  }
  let parsed: unknown;
  try {
    parsed = parser.parse(source);
  } catch {
    throw new OpdsError('parse', "The catalog sent a feed that couldn't be read.");
  }
  const doc = normalizeNode(parsed, {}) as XmlNode;
  const rootName = Object.keys(doc).find((k) => !k.startsWith(ATTR) && k !== TEXT && !k.startsWith('?'));
  const root = rootName !== undefined ? asArray(doc[rootName])[0] : undefined;
  if (rootName === undefined || root === undefined) {
    throw new OpdsError('parse', "The catalog sent a feed that couldn't be read.");
  }
  return [rootName, typeof root === 'object' && root !== null ? (root as XmlNode) : { [TEXT]: root }];
}

export function asArray<T = unknown>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

export function children(node: XmlNode | undefined, ...names: string[]): XmlNode[] {
  if (!node) return [];
  const out: XmlNode[] = [];
  for (const name of names) {
    for (const child of asArray(node[name])) {
      if (child !== null && typeof child === 'object') out.push(child as XmlNode);
      else if (child !== undefined) out.push({ [TEXT]: child });
    }
  }
  return out;
}

export function child(node: XmlNode | undefined, ...names: string[]): XmlNode | undefined {
  return children(node, ...names)[0];
}

export function attr(node: XmlNode | undefined, name: string): string | undefined {
  const value = node?.[ATTR + name];
  if (value === undefined || value === null) return undefined;
  return String(value);
}

/** Text content of a simple element (the parser's entity/CDATA handling already applied). */
export function textOf(node: XmlNode | undefined): string | undefined {
  if (!node) return undefined;
  const value = node[TEXT];
  if (value === undefined || value === null) return undefined;
  return String(value);
}

/** Text of the first of the named child elements that has text. */
export function childText(node: XmlNode | undefined, ...names: string[]): string | undefined {
  for (const c of children(node, ...names)) {
    const t = textOf(c)?.trim();
    if (t) return t;
  }
  return undefined;
}
