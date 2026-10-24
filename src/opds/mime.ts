// MIME helpers: short format labels, DRM detection, parameter parsing.

/** "Application/Atom+XML; profile=opds-catalog" -> "application/atom+xml" */
export function mimeBase(mime: string | undefined): string {
  return (mime ?? '').split(';')[0].trim().toLowerCase();
}

/** Lower-cased MIME parameters: "a/b; profile=x; kind=y" -> { profile: 'x', kind: 'y' } */
export function mimeParams(mime: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (mime ?? '').split(';').slice(1)) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    const value = part
      .slice(eq + 1)
      .trim()
      .replace(/^"(.*)"$/, '$1')
      .toLowerCase();
    if (key) out[key] = value;
  }
  return out;
}

export function isAtomType(mime: string | undefined): boolean {
  return mimeBase(mime) === 'application/atom+xml';
}

/** Atom entry document type ("application/atom+xml;type=entry"). */
export function isAtomEntryType(mime: string | undefined): boolean {
  return isAtomType(mime) && mimeParams(mime).type === 'entry';
}

export function isImageType(mime: string | undefined): boolean {
  return mimeBase(mime).startsWith('image/');
}

export function isHtmlType(mime: string | undefined): boolean {
  const base = mimeBase(mime);
  return base === 'text/html' || base === 'application/xhtml+xml';
}

/** Adobe ADEPT and Readium LCP wrappers. */
export function isDrmType(mime: string | undefined): boolean {
  const base = mimeBase(mime);
  return base.includes('adobe.adept') || /(^|[./+-])lcp([./+-]|$)/.test(base);
}

const LABELS: Record<string, string> = {
  'application/epub+zip': 'EPUB',
  'application/kepub+zip': 'Kobo EPUB',
  'application/x-kobo-epub+zip': 'Kobo EPUB',
  'application/pdf': 'PDF',
  'application/x-pdf': 'PDF',
  'application/x-mobipocket-ebook': 'Kindle (MOBI)',
  'application/x-mobipocket': 'Kindle (MOBI)',
  'application/vnd.amazon.ebook': 'Kindle (AZW3)',
  'application/vnd.amazon.mobi8-ebook': 'Kindle (AZW3)',
  'application/x-mobi8-ebook': 'Kindle (AZW3)',
  'application/x-azw3': 'Kindle (AZW3)',
  'application/x-fictionbook+xml': 'FB2',
  'application/x-fictionbook': 'FB2',
  'application/fb2+xml': 'FB2',
  'application/fb2': 'FB2',
  'text/fb2+xml': 'FB2',
  'text/xml+fb2': 'FB2',
  'application/fb2+zip': 'FB2 (zip)',
  'application/x-fictionbook+zip': 'FB2 (zip)',
  'application/x-zip-compressed-fb2': 'FB2 (zip)',
  'application/vnd.comicbook+zip': 'CBZ',
  'application/x-cbz': 'CBZ',
  'application/vnd.comicbook-rar': 'CBR',
  'application/x-cbr': 'CBR',
  'application/x-cb7': 'CB7',
  'application/vnd.comicbook+7z': 'CB7',
  'image/vnd.djvu': 'DjVu',
  'image/x-djvu': 'DjVu',
  'image/djvu': 'DjVu',
  'application/djvu': 'DjVu',
  'text/plain': 'Text',
  'text/html': 'HTML',
  'application/xhtml+xml': 'HTML',
  'application/rtf': 'RTF',
  'text/rtf': 'RTF',
  'application/zip': 'ZIP',
  'application/vnd.rar': 'RAR',
  'application/x-rar-compressed': 'RAR',
  'application/x-rar': 'RAR',
  'application/x-zip-compressed': 'ZIP',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.oasis.opendocument.text': 'ODT',
  'application/x-chm': 'CHM',
  'application/vnd.ms-htmlhelp': 'CHM',
};

/** MIME type -> short label ("EPUB", "PDF", "Kindle (AZW3)", ...); parameters ignored, case-insensitive. */
export function formatLabel(mime: string): string {
  const base = mimeBase(mime);
  if (base === '') return 'File';
  const known = LABELS[base];
  if (known) return known;
  if (base.startsWith('audio/')) return 'Audio';
  const subtype = base.split('/')[1] ?? '';
  const cleaned = subtype
    .replace(/^(?:x-|vnd\.)/, '')
    .split('+')[0]
    .toUpperCase();
  if (cleaned === '') return 'File';
  return cleaned.length > 12 ? cleaned.slice(0, 12) : cleaned;
}
