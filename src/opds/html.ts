// Plain-text helpers for catalog text (titles, summaries) that may contain HTML, entities or odd whitespace.

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ensp: ' ',
  emsp: ' ',
  thinsp: ' ',
  shy: '',
  zwnj: '',
  zwj: '',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  sbquo: '‚',
  ldquo: '“',
  rdquo: '”',
  bdquo: '„',
  laquo: '«',
  raquo: '»',
  lsaquo: '‹',
  rsaquo: '›',
  bull: '•',
  middot: '·',
  copy: '©',
  reg: '®',
  trade: '™',
  deg: '°',
  times: '×',
  divide: '÷',
  plusmn: '±',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
  sect: '§',
  para: '¶',
  dagger: '†',
  Dagger: '‡',
  euro: '€',
  pound: '£',
  yen: '¥',
  cent: '¢',
  iexcl: '¡',
  iquest: '¿',
  prime: '′',
  Prime: '″',
  agrave: 'à',
  aacute: 'á',
  acirc: 'â',
  atilde: 'ã',
  auml: 'ä',
  aring: 'å',
  aelig: 'æ',
  ccedil: 'ç',
  egrave: 'è',
  eacute: 'é',
  ecirc: 'ê',
  euml: 'ë',
  igrave: 'ì',
  iacute: 'í',
  icirc: 'î',
  iuml: 'ï',
  ntilde: 'ñ',
  ograve: 'ò',
  oacute: 'ó',
  ocirc: 'ô',
  otilde: 'õ',
  ouml: 'ö',
  oslash: 'ø',
  oelig: 'œ',
  szlig: 'ß',
  ugrave: 'ù',
  uacute: 'ú',
  ucirc: 'û',
  uuml: 'ü',
  yacute: 'ý',
  yuml: 'ÿ',
  Agrave: 'À',
  Aacute: 'Á',
  Acirc: 'Â',
  Atilde: 'Ã',
  Auml: 'Ä',
  Aring: 'Å',
  AElig: 'Æ',
  Ccedil: 'Ç',
  Egrave: 'È',
  Eacute: 'É',
  Ecirc: 'Ê',
  Euml: 'Ë',
  Igrave: 'Ì',
  Iacute: 'Í',
  Icirc: 'Î',
  Iuml: 'Ï',
  Ntilde: 'Ñ',
  Ograve: 'Ò',
  Oacute: 'Ó',
  Ocirc: 'Ô',
  Otilde: 'Õ',
  Ouml: 'Ö',
  Oslash: 'Ø',
  OElig: 'Œ',
  Ugrave: 'Ù',
  Uacute: 'Ú',
  Ucirc: 'Û',
  Uuml: 'Ü',
  Yacute: 'Ý',
};

function fromCodePoint(code: number): string {
  if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return '';
  return String.fromCodePoint(code);
}

/** Decodes numeric and common named character references; unknown names are left as they are. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[A-Za-z][A-Za-z0-9]*);/g, (match, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return fromCodePoint(code);
    }
    return NAMED_ENTITIES[body] ?? match;
  });
}

/** Collapses runs of spaces/tabs, trims lines, keeps at most one blank line between paragraphs. */
export function tidyWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\f\v   -   　]+/g, ' ')
    .replace(/[​﻿]/g, '')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Single-line text: all whitespace (including newlines) collapsed to one space. */
export function singleLine(text: string): string {
  return tidyWhitespace(text).replace(/\s+/g, ' ');
}

const BLOCK_TAGS = 'p|div|section|article|blockquote|h[1-6]|ul|ol|dl|table|tr|pre|header|footer|figure|address';

/**
 * HTML (already entity-decoded markup) to plain text: drops script/style, turns block ends into
 * paragraph breaks ("\n\n"), <br> into "\n", list items into "• " lines, strips all other tags,
 * decodes entities and tidies whitespace (source newlines inside a paragraph become spaces).
 */
export function htmlToText(html: string): string {
  const PARA = '\u0000P\u0000';
  const LINE = '\u0000L\u0000';
  const text = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|head|template)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<br\b[^>]*>/gi, LINE)
    .replace(/<li\b[^>]*>/gi, `${LINE}• `)
    .replace(new RegExp(`</?(?:${BLOCK_TAGS})\\b[^>]*>`, 'gi'), PARA)
    .replace(/<\/?(?:li|dt|dd|hr)\b[^>]*>/gi, LINE)
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ');
  const decoded = decodeEntities(text)
    .split(PARA)
    .map((para) =>
      para
        .split(LINE)
        .map((line) => line.trim())
        .filter((line) => line !== '' && line !== '•')
        .join('\n'),
    )
    .filter((para) => para !== '')
    .join('\n\n');
  return tidyWhitespace(decoded);
}

const COMMON_TAG_RE =
  /<\/?(?:p|br|div|span|b|i|em|strong|a|ul|ol|li|dl|dt|dd|h[1-6]|blockquote|img|font|sup|sub|small|big|u|s|hr|table|tbody|thead|tr|td|th|pre|code|cite|q|abbr|section|article|header|footer)\b[^>]*>/i;

/** True when the string contains a common HTML tag (so plain "<Cookbook>" in a title is left alone). */
export function looksLikeHtml(text: string): boolean {
  return COMMON_TAG_RE.test(text);
}
