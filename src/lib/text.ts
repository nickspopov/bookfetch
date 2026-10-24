const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
};

/**
 * Plain, display-safe text from catalog fields, which may hold HTML, entities or odd whitespace.
 * Keeps paragraph breaks when `multiline`.
 */
export function cleanText(value: string | undefined | null, multiline = false): string {
  if (!value) return '';
  let text = String(value)
    .replace(/<\s*(br|\/p|\/div|\/li|\/h\d)\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
      if (code[0] === '#') {
        const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
      }
      return ENTITIES[code.toLowerCase()] ?? match;
    });
  if (!multiline) return text.replace(/\s+/g, ' ').trim();
  text = text
    .replace(/[ \t\f\v ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

export function formatBytes(bytes: number | undefined): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

export function yearOf(date: string | undefined): string {
  const match = date ? /\b(\d{4})\b/.exec(date) : null;
  return match ? match[1] : '';
}

const languageNames: Record<string, string> = {
  en: 'English',
  de: 'German',
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
  pt: 'Portuguese',
  nl: 'Dutch',
  ru: 'Russian',
  uk: 'Ukrainian',
  pl: 'Polish',
  fi: 'Finnish',
  sv: 'Swedish',
  da: 'Danish',
  no: 'Norwegian',
  la: 'Latin',
  el: 'Greek',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  hu: 'Hungarian',
  cs: 'Czech',
  eo: 'Esperanto',
};

export function languageName(code: string | undefined): string {
  if (!code) return '';
  const base = code.toLowerCase().split(/[-_]/)[0];
  return languageNames[base] ?? code;
}
