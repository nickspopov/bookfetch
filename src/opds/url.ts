// URL helpers that behave the same in Jest (Node) and on device.
// React Native's global URL does not resolve relative references (it concatenates base + ref and
// ignores "../", "?query" and "#frag" references), so resolution follows RFC 3986 section 5 here.
import { OpdsError } from './types';

interface UriParts {
  scheme?: string;
  authority?: string;
  path: string;
  query?: string;
  fragment?: string;
}

const URI_RE = /^(?:([A-Za-z][A-Za-z0-9+.-]*):)?(?:\/\/([^/?#]*))?([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/;

function parseUri(input: string): UriParts {
  const m = URI_RE.exec(input);
  if (!m) return { path: input };
  return {
    scheme: m[1]?.toLowerCase(),
    authority: m[2],
    path: m[3] ?? '',
    query: m[4],
    fragment: m[5],
  };
}

function formatUri(p: UriParts): string {
  let out = '';
  if (p.scheme !== undefined) out += `${p.scheme}:`;
  if (p.authority !== undefined) out += `//${p.authority}`;
  out += p.path;
  if (p.query !== undefined) out += `?${p.query}`;
  if (p.fragment !== undefined) out += `#${p.fragment}`;
  return out;
}

function removeDotSegments(path: string): string {
  const input = path.split('/');
  const output: string[] = [];
  for (let i = 0; i < input.length; i += 1) {
    const seg = input[i];
    const last = i === input.length - 1;
    if (seg === '.') {
      if (last) output.push('');
    } else if (seg === '..') {
      if (output.length > 1 || (output.length === 1 && output[0] !== '')) output.pop();
      if (last) output.push('');
    } else {
      output.push(seg);
    }
  }
  let result = output.join('/');
  if (path.startsWith('/') && !result.startsWith('/')) result = `/${result}`;
  return result;
}

function mergePaths(base: UriParts, refPath: string): string {
  if (base.authority !== undefined && base.path === '') return `/${refPath}`;
  const slash = base.path.lastIndexOf('/');
  return slash === -1 ? refPath : base.path.slice(0, slash + 1) + refPath;
}

/** Percent-encodes characters that are never valid in a URL (spaces, quotes, non-ASCII, ...), keeping existing %XX. */
function sanitize(url: string): string {
  return url.replace(/[\s"<>\\^`{|}]|[^\x00-\x7F]/gu, (ch) => {
    try {
      return encodeURIComponent(ch);
    } catch {
      return ''; // lone surrogate
    }
  });
}

function resolveParts(ref: string, base: string): string | undefined {
  const r = parseUri(ref);
  if (r.scheme) {
    return formatUri({ ...r, path: removeDotSegments(r.path) });
  }
  const b = parseUri(base);
  if (!b.scheme) return undefined;
  const t: UriParts = { scheme: b.scheme, path: '' };
  if (r.authority !== undefined) {
    t.authority = r.authority;
    t.path = removeDotSegments(r.path);
    t.query = r.query;
  } else {
    t.authority = b.authority;
    if (r.path === '') {
      t.path = b.path;
      t.query = r.query !== undefined ? r.query : b.query;
    } else {
      t.path = removeDotSegments(r.path.startsWith('/') ? r.path : mergePaths(b, r.path));
      t.query = r.query;
    }
  }
  t.fragment = r.fragment;
  return formatUri(t);
}

/**
 * Resolves `ref` against `base` (RFC 3986). Returns undefined when the result has no scheme or is empty.
 * Does not change the scheme (no http->https upgrade) and keeps query strings as given.
 */
export function resolveUrl(ref: string | undefined | null, base: string | undefined): string | undefined {
  if (ref == null) return undefined;
  const trimmed = ref.trim();
  if (trimmed === '') return base ? sanitize(base) : undefined;
  if (/^data:/i.test(trimmed)) return trimmed;
  const resolved = resolveParts(sanitize(trimmed), base ? sanitize(base) : '');
  return resolved;
}

/**
 * Resolves a URL template (OpenSearch / Atom search link) without percent-encoding its `{placeholders}`.
 */
export function resolveTemplate(template: string, base: string | undefined): string | undefined {
  const tokens: string[] = [];
  const masked = template.trim().replace(/\{[^{}]*\}/g, (m) => {
    tokens.push(m);
    return `__bfph${tokens.length - 1}__`;
  });
  const resolved = resolveUrl(masked, base);
  return resolved?.replace(/__bfph(\d+)__/g, (_, i: string) => tokens[Number(i)]);
}

/** scheme://host[:port] in lower case without default ports; '' for non-http(s) or invalid URLs. */
export function originOf(url: string | undefined): string {
  if (!url) return '';
  const p = parseUri(url.trim());
  if ((p.scheme !== 'http' && p.scheme !== 'https') || !p.authority) return '';
  const hostPort = p.authority.slice(p.authority.lastIndexOf('@') + 1).toLowerCase();
  const m = /^(\[[^\]]*\]|[^:]*)(?::(\d*))?$/.exec(hostPort);
  if (!m || m[1] === '') return '';
  const port = m[2];
  const defaultPort = p.scheme === 'http' ? '80' : '443';
  const keepPort = port && port !== defaultPort ? `:${port}` : '';
  return `${p.scheme}://${m[1]}${keepPort}`;
}

export function isHttpUrl(url: string | undefined): boolean {
  return originOf(url) !== '';
}

const HOST_RE = /^(?:\[[0-9a-f:.]+\]|[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?)*\.?)$/i;

const INVALID_URL_MESSAGE = 'Enter a full web address that starts with http:// or https://.';

/**
 * Normalises what a user typed into an add-catalog field.
 * Trims; maps opds:// and opds+http(s):// to http(s)://; adds https:// when there is no scheme;
 * allows only http/https; keeps path and query. Bare IPs and localhost are fine (LAN servers).
 */
export function normalizeCatalogUrl(input: string): string {
  const raw = (input ?? '').trim();
  if (raw === '' || /\s/.test(raw)) throw new OpdsError('invalid-url', INVALID_URL_MESSAGE);

  let url: string;
  const withSlashes = /^([A-Za-z][A-Za-z0-9+.-]*):\/\//.exec(raw);
  if (withSlashes) {
    const scheme = withSlashes[1].toLowerCase();
    const rest = raw.slice(withSlashes[0].length);
    if (scheme === 'http' || scheme === 'https') url = `${scheme}://${rest}`;
    else if (scheme === 'opds' || scheme === 'opds+https') url = `https://${rest}`;
    else if (scheme === 'opds+http') url = `http://${rest}`;
    else throw new OpdsError('invalid-url', INVALID_URL_MESSAGE);
  } else {
    const schemeOnly = /^([A-Za-z][A-Za-z0-9+.-]*):(.*)$/.exec(raw);
    // "host:8080/path" looks like a scheme to a regex; a port number after the colon means it is a host.
    if (schemeOnly && !/^\d+(?:[/?#]|$)/.test(schemeOnly[2])) {
      throw new OpdsError('invalid-url', INVALID_URL_MESSAGE);
    }
    if (raw.startsWith('//')) url = `https:${raw}`;
    else if (raw.startsWith('/')) throw new OpdsError('invalid-url', INVALID_URL_MESSAGE);
    else url = `https://${raw}`;
  }

  const p = parseUri(url);
  const authority = p.authority ?? '';
  const hostPort = authority.slice(authority.lastIndexOf('@') + 1);
  const m = /^(\[[^\]]*\]|[^:]*)(?::(\d*))?$/.exec(hostPort);
  if (!m || !HOST_RE.test(m[1])) throw new OpdsError('invalid-url', INVALID_URL_MESSAGE);
  if (m[2] !== undefined && (m[2] === '' || Number(m[2]) > 65535)) {
    throw new OpdsError('invalid-url', INVALID_URL_MESSAGE);
  }
  const userinfo = authority.includes('@') ? authority.slice(0, authority.lastIndexOf('@') + 1) : '';
  const normalized: UriParts = {
    ...p,
    authority: `${userinfo}${m[1].toLowerCase()}${m[2] !== undefined ? `:${m[2]}` : ''}`,
    path: p.path === '' ? '/' : p.path,
  };
  return sanitize(formatUri(normalized));
}
