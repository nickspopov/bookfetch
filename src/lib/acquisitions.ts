import { isDrmType, type Acquisition, type Entry } from '@/opds';

export function acquisitionLabel(acquisition: Acquisition): string {
  const format = acquisition.formatLabel || 'file';
  return acquisition.kind === 'sample' ? `Sample (${format})` : format;
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
