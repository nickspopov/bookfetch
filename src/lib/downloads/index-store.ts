import { useSyncExternalStore } from 'react';

import { hashString } from '../catalog-url';
import { readVersioned, writeVersioned } from '../storage';

export interface DownloadRecord {
  id: string;
  /** file name inside the downloads folder */
  fileName: string;
  title: string;
  authors: string[];
  mimeType: string;
  formatLabel: string;
  size: number;
  catalogId: string;
  catalogTitle: string;
  /** hash of the acquisition link, to recognize a book that is already downloaded */
  hrefKey: string;
  downloadedAt: number;
}

const KEY = 'downloads';
export const DOWNLOADS_SCHEMA = 1;

export const hrefKeyOf = (href: string) => hashString(href);

const str = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback);
const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/** Keeps well-formed records only; never throws. */
export function parseDownloads(items: unknown[] | undefined): DownloadRecord[] {
  if (!items) return [];
  const seen = new Set<string>();
  const result: DownloadRecord[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const id = str(r.id);
    const fileName = str(r.fileName);
    if (!id || !fileName || seen.has(id) || fileName.includes('/')) continue;
    seen.add(id);
    result.push({
      id,
      fileName,
      title: str(r.title) || fileName,
      authors: Array.isArray(r.authors) ? r.authors.filter((a): a is string => typeof a === 'string') : [],
      mimeType: str(r.mimeType),
      formatLabel: str(r.formatLabel),
      size: num(r.size),
      catalogId: str(r.catalogId),
      catalogTitle: str(r.catalogTitle),
      hrefKey: str(r.hrefKey),
      downloadedAt: num(r.downloadedAt),
    });
  }
  return result;
}

let records: DownloadRecord[] | undefined;
const listeners = new Set<() => void>();

function current(): DownloadRecord[] {
  records ??= parseDownloads(readVersioned(KEY, DOWNLOADS_SCHEMA));
  return records;
}

function commit(next: DownloadRecord[]) {
  records = next;
  writeVersioned(KEY, DOWNLOADS_SCHEMA, next);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const downloadIndex = {
  /** newest first */
  all: current,
  get: (id: string) => current().find((r) => r.id === id),
  findByHref: (href: string) => {
    const key = hrefKeyOf(href);
    return current().find((r) => r.hrefKey === key);
  },
  hasFileName: (fileName: string) => current().some((r) => r.fileName.toLowerCase() === fileName.toLowerCase()),
  add(record: DownloadRecord) {
    commit([record, ...current().filter((r) => r.id !== record.id)]);
  },
  remove(id: string) {
    commit(current().filter((r) => r.id !== id));
  },
  /** Drops records whose files are gone (deleted in the Files app). */
  prune(exists: (record: DownloadRecord) => boolean) {
    const kept = current().filter(exists);
    if (kept.length !== current().length) commit(kept);
  },
  /** test helper */
  reset() {
    records = undefined;
  },
};

export function useDownloads(): DownloadRecord[] {
  return useSyncExternalStore(subscribe, current);
}
