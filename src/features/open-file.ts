import { Alert } from 'react-native';

import { downloadIndex, type DownloadRecord } from '@/lib/downloads/index-store';
import { openDownloaded } from '@/lib/downloads/open';

function formatName(record: DownloadRecord): string {
  if (record.formatLabel) return record.formatLabel;
  const dot = record.fileName.lastIndexOf('.');
  return dot === -1 ? 'these' : record.fileName.slice(dot + 1).toUpperCase();
}

/** "Open in…" for a downloaded book, with the alerts for a missing file or no app to open it. */
export async function openInOtherApp(record: DownloadRecord) {
  const result = await openDownloaded(record);
  if (result === 'missing') {
    downloadIndex.remove(record.id);
    Alert.alert('File not found', 'This book was deleted outside Bookfetch. Download it again from its catalog.');
  } else if (result === 'no-app') {
    Alert.alert("Can't open this book", `No app on this phone opens ${formatName(record)} files.`);
  }
}
