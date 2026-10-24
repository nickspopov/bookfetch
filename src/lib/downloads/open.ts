import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { downloadedFile } from './files';
import type { DownloadRecord } from './index-store';

const EXTENSION_MIME: Record<string, string> = {
  epub: 'application/epub+zip',
  pdf: 'application/pdf',
  mobi: 'application/x-mobipocket-ebook',
  azw3: 'application/vnd.amazon.mobi8-ebook',
  fb2: 'application/x-fictionbook+xml',
  cbz: 'application/vnd.comicbook+zip',
  cbr: 'application/vnd.comicbook-rar',
  txt: 'text/plain',
  rtf: 'application/rtf',
  djvu: 'image/vnd.djvu',
  zip: 'application/zip',
};

const MIME_UTI: Record<string, string> = {
  'application/epub+zip': 'org.idpf.epub-container',
  'application/pdf': 'com.adobe.pdf',
  'text/plain': 'public.plain-text',
  'application/rtf': 'public.rtf',
  'application/zip': 'public.zip-archive',
};

export function mimeTypeFor(record: Pick<DownloadRecord, 'mimeType' | 'fileName'>): string {
  const given = record.mimeType.split(';')[0].trim().toLowerCase();
  if (given && given !== 'application/octet-stream') return given;
  const ext = record.fileName.slice(record.fileName.lastIndexOf('.') + 1).toLowerCase();
  return EXTENSION_MIME[ext] ?? 'application/octet-stream';
}

export type OpenResult = 'opened' | 'missing' | 'no-app';

const FLAG_GRANT_READ_URI_PERMISSION = 1;

/**
 * Hands a downloaded file to another app: the share sheet on iOS (Books, Kindle, Save to Files…),
 * an ACTION_VIEW chooser on Android with the share sheet as fallback.
 */
export async function openDownloaded(record: DownloadRecord): Promise<OpenResult> {
  const file = downloadedFile(record.fileName);
  if (!file.exists) return 'missing';
  const mimeType = mimeTypeFor(record);

  if (Platform.OS === 'android') {
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: file.contentUri,
        type: mimeType,
        flags: FLAG_GRANT_READ_URI_PERMISSION,
      });
      return 'opened';
    } catch {
      // No app handles ACTION_VIEW for this type; offer the share sheet instead.
    }
  }

  try {
    if (!(await Sharing.isAvailableAsync())) return 'no-app';
    await Sharing.shareAsync(file.uri, {
      mimeType,
      UTI: MIME_UTI[mimeType] ?? 'public.data',
      dialogTitle: 'Open in…',
    });
    return 'opened';
  } catch {
    return 'no-app';
  }
}
