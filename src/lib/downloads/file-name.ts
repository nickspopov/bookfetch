const MIME_EXTENSIONS: Record<string, string> = {
  'application/epub+zip': 'epub',
  'application/pdf': 'pdf',
  'application/x-mobipocket-ebook': 'mobi',
  'application/vnd.amazon.ebook': 'azw',
  'application/x-mobi8-ebook': 'azw3',
  'application/vnd.amazon.mobi8-ebook': 'azw3',
  'application/kepub+zip': 'kepub.epub',
  'application/x-kepub+zip': 'kepub.epub',
  'application/fb2': 'fb2',
  'application/x-fictionbook+xml': 'fb2',
  'text/fb2+xml': 'fb2',
  'application/fb2+zip': 'fb2.zip',
  'application/x-zip-compressed-fb2': 'fb2.zip',
  'application/vnd.comicbook+zip': 'cbz',
  'application/x-cbz': 'cbz',
  'application/vnd.comicbook-rar': 'cbr',
  'application/x-cbr': 'cbr',
  'application/x-cb7': 'cb7',
  'application/x-cbt': 'cbt',
  'application/rtf': 'rtf',
  'text/rtf': 'rtf',
  'text/plain': 'txt',
  'text/html': 'html',
  'application/xhtml+xml': 'xhtml',
  'application/x-djvu': 'djvu',
  'image/vnd.djvu': 'djvu',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/zip': 'zip',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4b',
};

const KNOWN_EXTENSIONS = new Set([
  'epub',
  'pdf',
  'mobi',
  'azw',
  'azw3',
  'kfx',
  'fb2',
  'cbz',
  'cbr',
  'cb7',
  'cbt',
  'rtf',
  'txt',
  'djvu',
  'doc',
  'docx',
  'zip',
  'mp3',
  'm4b',
  'lit',
  'lrf',
  'pdb',
]);

// MIME types servers send for several formats (Calibre serves AZW3 as application/x-mobipocket-ebook).
const AMBIGUOUS_MIME = new Set(['', 'application/octet-stream', 'application/x-mobipocket-ebook', 'application/zip']);

// Ebook extensions a URL path can settle an ambiguous MIME type with; compound ones first.
const URL_EXTENSIONS = [
  'kepub.epub',
  'fb2.zip',
  'epub',
  'azw3',
  'azw',
  'mobi',
  'pdf',
  'cbz',
  'cbr',
  'cb7',
  'fb2',
  'djvu',
  'txt',
  'rtf',
  'zip',
];

/**
 * The file extension for a download: an ebook extension in the URL path when the MIME type is generic or
 * ambiguous, else the MIME type's, else a best guess from the URL path, else "bin".
 */
export function extensionFor(mime: string, url: string): string {
  const base = mime.split(';')[0].trim().toLowerCase();
  const path = url.split(/[?#]/)[0];
  const last = path.slice(path.lastIndexOf('/') + 1).toLowerCase();
  if (AMBIGUOUS_MIME.has(base)) {
    const fromUrl = URL_EXTENSIONS.find((ext) => last.endsWith(`.${ext}`));
    if (fromUrl) return fromUrl;
  }
  if (MIME_EXTENSIONS[base]) return MIME_EXTENSIONS[base];
  const dot = last.lastIndexOf('.');
  const ext = dot === -1 ? '' : last.slice(dot + 1);
  if (KNOWN_EXTENSIONS.has(ext)) return ext;
  // Gutenberg-style links end in ".epub3.images", ".epub.noimages", ".kf8.images"…
  const known = last.split('.').find((part) => KNOWN_EXTENSIONS.has(part.replace(/\d+$/, '')));
  if (known) return known.replace(/\d+$/, '') === 'epub' ? 'epub' : known;
  if (/\bepub/.test(last)) return 'epub';
  if (/\bkf8\b|\bkindle\b/.test(last)) return 'azw3';
  return 'bin';
}

const MAX_BASE_LENGTH = 120;

/** "<Title> - <Author>" without characters file systems reject, trimmed to a sane length. */
export function baseFileName(title: string, authors: string[]): string {
  const author = authors.map((a) => a.trim()).find(Boolean);
  const raw = author ? `${title.trim() || 'Untitled'} - ${author}` : title.trim() || 'Untitled';
  let name = raw
    .replace(/[/\\:*?"<>|]/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .trim();
  if (name.length > MAX_BASE_LENGTH) name = name.slice(0, MAX_BASE_LENGTH).trim();
  name = name.replace(/[.\s]+$/, '');
  return name || 'Book';
}

/** Picks "<base>.<ext>", or "<base> (2).<ext>" and so on when a name is taken. */
export function uniqueFileName(base: string, ext: string, taken: (name: string) => boolean): string {
  const candidate = `${base}.${ext}`;
  if (!taken(candidate)) return candidate;
  for (let n = 2; n < 1000; n += 1) {
    const next = `${base} (${n}).${ext}`;
    if (!taken(next)) return next;
  }
  return `${base} (${Date.now()}).${ext}`;
}
