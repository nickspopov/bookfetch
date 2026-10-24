const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^(?=.*\d)(?=.*[a-z])[a-z0-9_-]{24,}$/i;
const SECRET_PARAM = /^(api[-_]?key|key|token|auth|access[-_]?token)$/i;

export const REDACTED = '•••';

/**
 * Catalogs such as Kavita put an API key in the feed URL. Returns the URL with such keys replaced
 * for display and storage outside the keychain, and whether anything was replaced.
 */
export function redactUrl(url: string): { redacted: string; secret: boolean } {
  const match = /^([a-z][a-z0-9+.-]*:\/\/[^/?#]*)([^?#]*)(\?[^#]*)?(#.*)?$/i.exec(url);
  if (!match) return { redacted: url, secret: false };
  const [, origin, path = '', query = '', hash = ''] = match;
  let secret = false;
  const redactedPath = path
    .split('/')
    .map((segment) => {
      if (UUID.test(segment) || TOKEN.test(segment)) {
        secret = true;
        return REDACTED;
      }
      return segment;
    })
    .join('/');
  const redactedQuery = query
    ? '?' +
      query
        .slice(1)
        .split('&')
        .map((pair) => {
          const [name, value] = pair.split('=');
          if (value && SECRET_PARAM.test(decodeSafe(name))) {
            secret = true;
            return `${name}=${REDACTED}`;
          }
          return pair;
        })
        .join('&')
    : '';
  return { redacted: origin + redactedPath + redactedQuery + hash, secret };
}

/** Splits "https://user:pass@host/…" into a clean URL and a login, so a login never stays in a URL. */
export function splitUserInfo(input: string): { url: string; username?: string; password?: string } {
  const match = /^(\s*[a-z][a-z0-9+.-]*:\/\/)([^@/?#]*)@(.*)$/i.exec(input);
  if (!match) return { url: input };
  const [, scheme, userInfo, rest] = match;
  const colon = userInfo.indexOf(':');
  const username = decodeSafe(colon === -1 ? userInfo : userInfo.slice(0, colon));
  const password = colon === -1 ? '' : decodeSafe(userInfo.slice(colon + 1));
  return { url: scheme + rest, username, password };
}

function decodeSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Small stable string hash (FNV-1a) used to match download links without storing them. Not for security. */
export function hashString(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36) + value.length.toString(36);
}
