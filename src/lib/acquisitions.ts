import { isDrmType, type Acquisition, type Entry } from '@/opds';

/**
 * Button label for a link: its format ("EPUB", "Sample (EPUB)"), or the link's own title when several links
 * share a format (Gutenberg: "EPUB3 (E-readers incl. Send-to-Kindle)" next to "EPUB (older e-readers)").
 */
export function acquisitionLabel(acquisition: Acquisition, siblings: Acquisition[] = []): string {
  const format = acquisition.formatLabel || 'file';
  const title = acquisition.title?.replace(/\s+/g, ' ').trim();
  const shared = siblings.some((a) => a !== acquisition && a.formatLabel === acquisition.formatLabel);
  const label = shared && title && title.length <= 48 ? title : format;
  return acquisition.kind === 'sample' ? `Sample (${label})` : label;
}

/** Downloadable links, full books first, without duplicate links. */
export function downloadableAcquisitions(entry: Entry): Acquisition[] {
  const seen = new Set<string>();
  return entry.acquisitions
    .filter((a) => a.downloadable && a.kind !== 'buy' && a.kind !== 'borrow' && a.kind !== 'subscribe')
    .filter((a) => !a.indirectTypes.some(isDrmType))
    .filter((a) => (seen.has(a.href) ? false : (seen.add(a.href), true)))
    .sort((a, b) => Number(a.kind === 'sample') - Number(b.kind === 'sample'));
}
