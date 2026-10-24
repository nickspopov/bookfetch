// OPDS 1.x (Atom) feed parsing.
import { decodeEntities, htmlToText, looksLikeHtml, singleLine, tidyWhitespace } from './html';
import {
  formatLabel,
  isAtomEntryType,
  isAtomType,
  isDrmType,
  isHtmlType,
  isImageType,
  mimeBase,
  mimeParams,
} from './mime';
import type { Acquisition, AcquisitionKind, Entry, FacetLink, Feed, NavigationLink, SearchSpec } from './types';
import { OpdsError } from './types';
import { isHttpUrl, resolveTemplate, resolveUrl } from './url';
import { ATTR, TEXT, attr, child, childText, children, parseXml, textOf, type XmlNode } from './xml';

const IANA_REL = 'http://www.iana.org/assignments/relation/';
const PSE_REL = 'http://vaemendis.net/opds-pse/';

const ACQUISITION_KINDS: Record<string, AcquisitionKind> = {
  'http://opds-spec.org/acquisition': 'generic',
  'http://opds-spec.org/acquisition/open-access': 'open-access',
  'http://opds-spec.org/acquisition/sample': 'sample',
  'http://opds-spec.org/acquisition/preview': 'sample',
  'http://opds-spec.org/acquisition/borrow': 'borrow',
  'http://opds-spec.org/acquisition/buy': 'buy',
  'http://opds-spec.org/acquisition/subscribe': 'subscribe',
};

const DOWNLOADABLE_KINDS: AcquisitionKind[] = ['open-access', 'generic', 'sample'];

const COVER_RELS = ['http://opds-spec.org/image', 'http://opds-spec.org/cover', 'x-stanza-cover-image'];
const THUMBNAIL_RELS = [
  'http://opds-spec.org/image/thumbnail',
  'x-stanza-cover-image-thumbnail',
  'http://opds-spec.org/thumbnail',
];

const NAVIGATION_RELS = [
  'subsection',
  'collection',
  'http://opds-spec.org/featured',
  'http://opds-spec.org/recommended',
  'http://opds-spec.org/popular',
  'http://opds-spec.org/new',
  'http://opds-spec.org/shelf',
  'http://opds-spec.org/subscriptions',
];

// atom-typed links that never make an entry navigable on their own
const NON_NAVIGATION_RELS = [
  'self',
  'start',
  'up',
  'search',
  'next',
  'previous',
  'prev',
  'first',
  'last',
  'http://opds-spec.org/crawlable',
];

interface RawLink {
  rel: string;
  href: string;
  type: string;
  title?: string;
  length?: string;
  node: XmlNode;
}

/** Canonical rel: default "alternate", IANA URIs shortened, https://opds-spec.org treated as http. */
function normalizeRel(rel: string | undefined): string {
  const value = (rel ?? '').trim();
  if (value === '') return 'alternate';
  if (value.startsWith(IANA_REL)) return value.slice(IANA_REL.length).toLowerCase();
  if (value.startsWith('https://opds-spec.org/')) return `http://${value.slice('https://'.length)}`;
  return /^[A-Za-z-]+$/.test(value) ? value.toLowerCase() : value;
}

function baseFor(node: XmlNode | undefined, parentBase: string): string {
  const xmlBase = attr(node, 'xml:base');
  if (!xmlBase) return parentBase;
  return resolveUrl(xmlBase, parentBase) ?? parentBase;
}

function readLinks(node: XmlNode, base: string): RawLink[] {
  const links: RawLink[] = [];
  for (const link of children(node, 'link')) {
    const rawHref = attr(link, 'href');
    if (!rawHref || rawHref.trim() === '') continue;
    const linkBase = baseFor(link, base);
    const type = (attr(link, 'type') ?? '').trim();
    const rel = normalizeRel(attr(link, 'rel'));
    const href = rawHref.includes('{') ? resolveTemplate(rawHref, linkBase) : resolveUrl(rawHref, linkBase);
    if (!href) continue;
    links.push({
      rel,
      href,
      type,
      title: cleanAttrText(attr(link, 'title')),
      length: attr(link, 'length'),
      node: link,
    });
  }
  return links;
}

function cleanAttrText(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  let text = value;
  // Kavita percent-encodes link titles ("Some%20Book.epub")
  if (/%[0-9A-Fa-f]{2}/.test(text) && !/\s/.test(text)) {
    try {
      text = decodeURIComponent(text);
    } catch {
      // keep as is
    }
  }
  const cleaned = singleLine(text);
  return cleaned === '' ? undefined : cleaned;
}

/** Concatenated text of a node and its descendants (for content that was parsed as elements). */
function deepText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value)) return value.map(deepText).join(' ');
  return Object.entries(value as XmlNode)
    .filter(([k]) => !k.startsWith(ATTR))
    .map(([, v]) => deepText(v))
    .join(' ');
}

/** Raw markup of a stop node: decodes CDATA sections (verbatim) and XML entities in the rest. */
function decodeRaw(raw: string): string {
  return raw
    .split(/(<!\[CDATA\[[\s\S]*?\]\]>)/)
    .map((part) => (part.startsWith('<![CDATA[') ? part.slice(9, -3) : decodeEntities(part)))
    .join('');
}

/**
 * Plain text from an Atom text construct of type text, html or xhtml.
 * `raw` is true for content/summary, which the parser keeps as unprocessed markup (stop nodes);
 * other elements arrive with entities and CDATA already decoded.
 */
function textConstruct(node: XmlNode | undefined, multiline: boolean, raw = false): string | undefined {
  if (!node) return undefined;
  const type = (attr(node, 'type') ?? 'text').trim().toLowerCase();
  const hasElements = Object.keys(node).some((k) => !k.startsWith(ATTR) && k !== TEXT);
  const source = hasElements ? deepText(node) : (textOf(node) ?? '');
  const isRaw = raw && !hasElements;
  let text: string;
  if (type === 'xhtml' || type === 'application/xhtml+xml') {
    // real tags, entities still encoded; CDATA content is literal text
    text = htmlToText(isRaw ? source.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, c: string) => escapeHtml(c)) : source);
  } else {
    const decoded = isRaw ? decodeRaw(source) : source;
    text = type === 'html' || type === 'text/html' || looksLikeHtml(decoded) ? htmlToText(decoded) : decoded;
  }
  const cleaned = multiline ? tidyWhitespace(text) : singleLine(text);
  return cleaned === '' ? undefined : cleaned;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Atom text construct read as a single line (titles, subtitles). */
function lineText(node: XmlNode | undefined): string | undefined {
  return textConstruct(node, false);
}

function acquisitionKind(rel: string): AcquisitionKind | undefined {
  const kind = ACQUISITION_KINDS[rel];
  if (kind) return kind;
  if (rel.startsWith('http://opds-spec.org/acquisition/')) return 'generic';
  return undefined;
}

function indirectTypes(node: XmlNode): string[] {
  const out: string[] = [];
  let current: XmlNode | undefined = child(node, 'opds:indirectAcquisition');
  while (current) {
    const type = attr(current, 'type');
    if (type) out.push(type.trim());
    current = child(current, 'opds:indirectAcquisition');
  }
  return out;
}

function toAcquisition(link: RawLink, kind: AcquisitionKind): Acquisition {
  const indirect = indirectTypes(link.node);
  const size = link.length !== undefined ? Number(link.length) : NaN;
  const drm = isDrmType(link.type) || indirect.some(isDrmType);
  // A wrapper (DRM license, HTML page, Atom entry) is labelled by the innermost real format it leads to.
  const innermost = [...indirect].reverse().find((t) => !isDrmType(t));
  const isWrapper = link.type === '' || isDrmType(link.type) || isHtmlType(link.type) || isAtomType(link.type);
  let labelType = innermost && isWrapper ? innermost : link.type;
  // Standard Ebooks and others send AZW3 files as application/x-mobipocket-ebook
  if (mimeBase(labelType) === 'application/x-mobipocket-ebook' && /\.azw3(?:$|[?#])/i.test(link.href)) {
    labelType = 'application/x-mobi8-ebook';
  }
  const acquisition: Acquisition = {
    href: link.href,
    type: link.type,
    kind,
    indirectTypes: indirect,
    formatLabel: formatLabel(labelType),
    downloadable: DOWNLOADABLE_KINDS.includes(kind) && !drm && isHttpUrl(link.href),
  };
  if (link.title) acquisition.title = link.title;
  if (Number.isFinite(size) && size > 0) acquisition.size = Math.round(size);
  return acquisition;
}

function readAcquisitions(links: RawLink[]): Acquisition[] {
  const seen = new Set<string>();
  const out: Acquisition[] = [];
  for (const link of links) {
    const kind = acquisitionKind(link.rel);
    if (!kind) continue;
    const key = `${link.href}\n${mimeBase(link.type)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(toAcquisition(link, kind));
  }
  return out;
}

function isNavigationRel(rel: string): boolean {
  return NAVIGATION_RELS.includes(rel) || rel.startsWith('http://opds-spec.org/sort/');
}

function pickNavigation(links: RawLink[]): NavigationLink | undefined {
  const candidates = links.filter((l) => !isImageType(l.type) && !acquisitionKind(l.rel));
  const pick =
    candidates.find((l) => isNavigationRel(l.rel) && (l.type === '' || isAtomType(l.type))) ??
    candidates.find(
      (l) =>
        isAtomType(l.type) && !isAtomEntryType(l.type) && !NON_NAVIGATION_RELS.includes(l.rel) && l.rel !== 'related',
    ) ??
    candidates.find((l) => isAtomEntryType(l.type) && l.rel === 'alternate') ??
    candidates.find((l) => isAtomType(l.type) && l.rel === 'related');
  if (!pick) return undefined;
  const nav: NavigationLink = { href: pick.href, rel: pick.rel };
  if (pick.type) nav.type = pick.type;
  return nav;
}

function firstLink(
  links: RawLink[],
  rels: string[],
  accept: (l: RawLink) => boolean = () => true,
): RawLink | undefined {
  for (const rel of rels) {
    const found = links.find((l) => l.rel === rel && accept(l));
    if (found) return found;
  }
  return undefined;
}

function readAuthors(entry: XmlNode): string[] {
  const names = children(entry, 'author')
    .map((a) => childText(a, 'name') ?? (Object.keys(a).length === 1 ? textOf(a) : undefined))
    .filter((n): n is string => !!n)
    .map(singleLine);
  const fallback =
    names.length > 0 ? names : children(entry, 'dc:creator', 'dcterms:creator').map((c) => singleLine(textOf(c) ?? ''));
  return dedupe(fallback.filter((n) => n !== ''));
}

function readCategories(entry: XmlNode): string[] {
  return dedupe(
    children(entry, 'category')
      .map((c) => singleLine(decodeEntities(attr(c, 'label')?.trim() || attr(c, 'term')?.trim() || '')))
      .filter((c) => c !== ''),
  );
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function singleText(node: XmlNode, ...names: string[]): string | undefined {
  const t = childText(node, ...names);
  if (t === undefined) return undefined;
  const cleaned = singleLine(t);
  return cleaned === '' ? undefined : cleaned;
}

function readPublisher(entry: XmlNode): string | undefined {
  const direct = singleText(entry, 'dc:publisher', 'dcterms:publisher');
  if (direct) return direct;
  const nested = child(entry, 'publisher'); // Calibre-Web style <publisher><name>..</name></publisher>
  const name = childText(nested, 'name') ?? textOf(nested);
  return name ? singleLine(name) || undefined : undefined;
}

function readSummary(entry: XmlNode): string | undefined {
  const summary = textConstruct(child(entry, 'summary'), true, true);
  const content = textConstruct(child(entry, 'content'), true, true);
  const description =
    summary || content ? undefined : textConstruct(child(entry, 'dc:description', 'dcterms:description'), true);
  // Prefer the fuller description: some servers put a teaser in <summary> and the blurb in <content>.
  if (summary && content) return content.length > summary.length ? content : summary;
  return summary ?? content ?? description;
}

function parseEntry(node: XmlNode, base: string, index: number): Entry {
  const entryBase = baseFor(node, base);
  const links = readLinks(node, entryBase);
  const acquisitions = readAcquisitions(links);

  // any image link is a cover fallback, except page-streaming templates (PSE) and thumbnails
  const cover =
    firstLink(links, COVER_RELS) ??
    links.find(
      (l) =>
        isImageType(l.type) && !THUMBNAIL_RELS.includes(l.rel) && !l.rel.startsWith(PSE_REL) && !l.href.includes('{'),
    );
  const thumbnail = firstLink(links, THUMBNAIL_RELS);
  const alternate = links.find(
    (l) => l.rel === 'alternate' && (isHtmlType(l.type) || l.type === '') && isHttpUrl(l.href) && !isAtomType(l.type),
  );

  const title = lineText(child(node, 'title')) ?? singleText(node, 'dc:title', 'dcterms:title') ?? 'Untitled';
  const entry: Entry = {
    id: singleText(node, 'id') ?? '',
    title,
    authors: readAuthors(node),
    categories: readCategories(node),
    acquisitions,
  };
  const summary = readSummary(node);
  if (summary) entry.summary = summary;
  const updated = singleText(node, 'updated');
  if (updated) entry.updated = updated;
  const issued = singleText(node, 'dcterms:issued', 'dc:issued', 'published', 'dc:date', 'dcterms:date');
  if (issued) entry.issued = issued;
  const language = singleText(node, 'dcterms:language', 'dc:language');
  if (language) entry.language = language;
  const publisher = readPublisher(node);
  if (publisher) entry.publisher = publisher;
  const coverUrl = cover?.href ?? thumbnail?.href;
  const thumbnailUrl = thumbnail?.href ?? cover?.href;
  if (coverUrl) entry.coverUrl = coverUrl;
  if (thumbnailUrl) entry.thumbnailUrl = thumbnailUrl;
  if (alternate) entry.alternateHref = alternate.href;
  if (acquisitions.length === 0) {
    const navigation = pickNavigation(links);
    if (navigation) entry.navigation = navigation;
  }
  if (entry.id === '') {
    entry.id = entry.navigation?.href ?? acquisitions[0]?.href ?? `entry-${index}`;
  }
  return entry;
}

function readSearch(links: RawLink[]): SearchSpec | undefined {
  const searchLinks = links.filter((l) => l.rel === 'search');
  const template = searchLinks.find((l) => isAtomType(l.type) && l.href.includes('{searchTerms}'));
  if (template) return { kind: 'template', template: template.href };
  const description = searchLinks.find((l) => mimeBase(l.type) === 'application/opensearchdescription+xml');
  if (description) return { kind: 'description', url: description.href };
  return undefined;
}

function readFacets(links: RawLink[]): FacetLink[] {
  return links
    .filter((l) => l.rel === 'http://opds-spec.org/facet')
    .map((l) => {
      const facet: FacetLink = {
        title: l.title ?? 'Untitled',
        href: l.href,
        active: (attr(l.node, 'opds:activeFacet') ?? '').trim().toLowerCase() === 'true',
      };
      const group = cleanAttrText(attr(l.node, 'opds:facetGroup'));
      if (group) facet.group = group;
      const count = Number(attr(l.node, 'thr:count'));
      if (attr(l.node, 'thr:count') !== undefined && Number.isFinite(count)) facet.count = count;
      return facet;
    });
}

/** Makes entry ids unique within a feed (Kavita repeats ids for "Continue Reading" rows) so they can key lists. */
function uniqueIds(entries: Entry[]): void {
  // reserve every original id first so a repaired id never collides with a later original ("x", "x", "x#2")
  const taken = new Set(entries.map((e) => e.id));
  const kept = new Set<string>();
  const nextSuffix = new Map<string, number>();
  for (const entry of entries) {
    if (!kept.has(entry.id)) {
      kept.add(entry.id);
      continue;
    }
    let n = nextSuffix.get(entry.id) ?? 2;
    while (taken.has(`${entry.id}#${n}`)) n += 1;
    nextSuffix.set(entry.id, n + 1);
    const id = `${entry.id}#${n}`;
    taken.add(id);
    entry.id = id;
  }
}

function buildFeed(root: XmlNode, entryNodes: XmlNode[], feedUrl: string): Feed {
  const base = baseFor(root, feedUrl);
  const links = readLinks(root, base);
  const entries = entryNodes.map((node, i) => parseEntry(node, base, i));
  uniqueIds(entries);

  const selfLink = firstLink(links, ['self']);
  const selfKind = selfLink ? mimeParams(selfLink.type).kind : undefined;
  const allNavigation = entries.length > 0 && entries.every((e) => e.navigation && e.acquisitions.length === 0);
  const kind: Feed['kind'] =
    entries.length === 0
      ? selfKind === 'navigation'
        ? 'navigation'
        : 'acquisition'
      : allNavigation
        ? 'navigation'
        : 'acquisition';

  const feed: Feed = {
    url: feedUrl,
    title: lineText(child(root, 'title')) ?? '',
    kind,
    entries,
    facets: readFacets(links),
  };
  const id = singleText(root, 'id');
  if (id) feed.id = id;
  const subtitle = lineText(child(root, 'subtitle'));
  if (subtitle) feed.subtitle = subtitle;
  const updated = singleText(root, 'updated');
  if (updated) feed.updated = updated;
  const icon = childText(root, 'icon') ?? childText(root, 'logo');
  const iconUrl = icon ? resolveUrl(icon, base) : undefined;
  if (iconUrl) feed.iconUrl = iconUrl;

  const notImage = (l: RawLink) => !isImageType(l.type);
  const next = firstLink(links, ['next'], notImage);
  const previous = firstLink(links, ['previous', 'prev'], notImage);
  const start = firstLink(links, ['start'], notImage);
  const first = firstLink(links, ['first'], notImage);
  const last = firstLink(links, ['last'], notImage);
  const up = firstLink(links, ['up'], notImage);
  if (next) feed.next = next.href;
  if (previous) feed.previous = previous.href;
  if (start) feed.start = start.href;
  if (first) feed.first = first.href;
  if (last) feed.last = last.href;
  if (up) feed.up = up.href;
  const search = readSearch(links);
  if (search) feed.search = search;
  const total = Number(childText(root, 'opensearch:totalResults'));
  if (childText(root, 'opensearch:totalResults') !== undefined && Number.isFinite(total) && total >= 0) {
    feed.totalResults = total;
  }
  return feed;
}

/**
 * Parses an OPDS 1.x Atom feed (or a single Atom entry document, returned as a one-entry acquisition feed).
 * Relative links resolve against xml:base (feed, entry, link) and then feedUrl.
 * Throws OpdsError('parse') for empty/non-XML input and OpdsError('not-opds') for XML that is not Atom.
 */
export function parseFeed(xml: string, feedUrl: string): Feed {
  const [rootName, root] = parseXml(xml);
  if (rootName === 'feed') return buildFeed(root, children(root, 'entry'), feedUrl);
  if (rootName === 'entry') {
    const feed = buildFeed({}, [root], feedUrl);
    feed.title = feed.entries[0]?.title ?? '';
    feed.kind = 'acquisition';
    return feed;
  }
  throw new OpdsError('not-opds', "This address doesn't look like an OPDS catalog.");
}
