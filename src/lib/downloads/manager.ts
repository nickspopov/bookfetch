import { File } from 'expo-file-system';
import { useSyncExternalStore } from 'react';

import type { Acquisition, Entry } from '@/opds';

import type { Catalog } from '../catalogs';
import { sessionFor } from '../client';
import { describeError } from '../errors';
import { baseFileName, extensionFor, uniqueFileName } from './file-name';
import { deleteQuietly, downloadedFile, downloadsDirectory, partialDirectory } from './files';
import { downloadIndex, hrefKeyOf, type DownloadRecord } from './index-store';

export type ActiveDownload =
  | { status: 'downloading'; written: number; total: number }
  | { status: 'failed'; message: string; needsLogin: boolean };

const active = new Map<string, ActiveDownload>();
const controllers = new Map<string, AbortController>();
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version += 1;
  listeners.forEach((listener) => listener());
}

function setState(key: string, state: ActiveDownload | undefined) {
  if (state) active.set(key, state);
  else active.delete(key);
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useActiveDownload(href: string | undefined): ActiveDownload | undefined {
  useSyncExternalStore(subscribe, () => version);
  return href ? active.get(hrefKeyOf(href)) : undefined;
}

export function clearFailure(href: string) {
  const key = hrefKeyOf(href);
  if (active.get(key)?.status === 'failed') setState(key, undefined);
}

export function cancelDownload(href: string) {
  controllers.get(hrefKeyOf(href))?.abort();
}

/** Maps a failed download to the sentence shown under the button. */
export function describeDownloadError(error: unknown, sentCredentials: boolean) {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : String(error);
  if (name === 'MissingSecretError') return describeError(error, sentCredentials);
  if (name === 'NotABookError') {
    return {
      message: 'The server sent a web page instead of the book. It may need a login.',
      needsLogin: false,
    };
  }
  const status = /\b([45]\d\d)\b/.exec(message)?.[1];
  if (status === '401' || status === '403') {
    return {
      message: sentCredentials ? 'Wrong username or password.' : 'The server asked for a login.',
      needsLogin: true,
    };
  }
  if (status === '404') return { message: 'The book file is no longer on the server (404).', needsLogin: false };
  if (status) return { message: `The server answered with an error (${status}).`, needsLogin: false };
  if (/disk|space|ENOSPC|no space/i.test(message)) {
    return { message: "There isn't enough space on this phone.", needsLogin: false };
  }
  return { message: "The download didn't finish. Check your connection and try again.", needsLogin: false };
}

class NotABookError extends Error {
  constructor() {
    super('The server sent HTML instead of a book file');
    this.name = 'NotABookError';
  }
}

function looksLikeHtml(file: File, mimeType: string): boolean {
  if (/html/i.test(mimeType)) return false;
  try {
    const handle = file.open();
    try {
      const bytes = handle.readBytes(Math.min(512, file.size));
      let head = '';
      for (const byte of bytes) head += String.fromCharCode(byte);
      return /^(﻿|\xEF\xBB\xBF)?\s*(<!doctype html|<html)/i.test(head);
    } finally {
      handle.close();
    }
  } catch {
    return false;
  }
}

const isAbort = (error: unknown) =>
  error instanceof Error && (error.name === 'AbortError' || /abort|cancel/i.test(error.message));

/**
 * Downloads an acquisition into the downloads folder. The file goes to a cache folder first and is moved into
 * place and indexed only once it is complete and looks like a book.
 */
export async function startDownload(catalog: Catalog, entry: Entry, acquisition: Acquisition): Promise<void> {
  const key = hrefKeyOf(acquisition.href);
  if (active.get(key)?.status === 'downloading') return;
  const controller = new AbortController();
  controllers.set(key, controller);
  setState(key, { status: 'downloading', written: 0, total: acquisition.size ?? -1 });

  let sentCredentials = false;
  const partial = new File(partialDirectory(), `${key}-${Date.now()}.part`);
  try {
    const session = await sessionFor(catalog);
    sentCredentials = session.sentCredentials;
    let lastEmit = 0;
    await File.downloadFileAsync(acquisition.href, partial, {
      headers: session.client.headersFor(acquisition.href),
      idempotent: true,
      signal: controller.signal,
      onProgress: ({ bytesWritten, totalBytes }) => {
        const now = Date.now();
        if (now - lastEmit < 120) return;
        lastEmit = now;
        setState(key, {
          status: 'downloading',
          written: bytesWritten,
          total: totalBytes > 0 ? totalBytes : (acquisition.size ?? -1),
        });
      },
    });
    if (controller.signal.aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' });
    if (!partial.exists || partial.size === 0) throw new Error('Empty download');
    if (looksLikeHtml(partial, acquisition.type)) throw new NotABookError();

    const directory = downloadsDirectory();
    const ext = extensionFor(acquisition.type, acquisition.href);
    const fileName = uniqueFileName(
      baseFileName(entry.title, entry.authors),
      ext,
      (name) => downloadedFile(name).exists || downloadIndex.hasFileName(name),
    );
    const destination = new File(directory, fileName);
    partial.move(destination);

    const record: DownloadRecord = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      fileName,
      title: entry.title || fileName,
      authors: entry.authors,
      mimeType: acquisition.type,
      formatLabel: acquisition.formatLabel,
      size: destination.size || acquisition.size || 0,
      catalogId: catalog.id,
      catalogTitle: catalog.title,
      hrefKey: key,
      downloadedAt: Date.now(),
    };
    downloadIndex.add(record);
    setState(key, undefined);
  } catch (error) {
    deleteQuietly(partial);
    if (controller.signal.aborted || isAbort(error)) setState(key, undefined);
    else setState(key, { status: 'failed', ...describeDownloadError(error, sentCredentials) });
  } finally {
    controllers.delete(key);
  }
}

/** Deletes a downloaded file and its record. */
export function deleteDownload(record: DownloadRecord) {
  deleteQuietly(downloadedFile(record.fileName));
  downloadIndex.remove(record.id);
}
