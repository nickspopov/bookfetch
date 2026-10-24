import { Directory, File, Paths } from 'expo-file-system';

/** Downloads live in Documents/Bookfetch, which iOS shows in Files → On My iPhone → Bookfetch. */
export const DOWNLOADS_FOLDER_NAME = 'Bookfetch';

export function downloadsDirectory(): Directory {
  const directory = new Directory(Paths.document, DOWNLOADS_FOLDER_NAME);
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
  return directory;
}

export function downloadedFile(fileName: string): File {
  return new File(Paths.document, DOWNLOADS_FOLDER_NAME, fileName);
}

export function partialDirectory(): Directory {
  const directory = new Directory(Paths.cache, 'partial-downloads');
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
  return directory;
}

export function fileExists(fileName: string): boolean {
  try {
    return downloadedFile(fileName).exists;
  } catch {
    return false;
  }
}

export function deleteQuietly(file: File) {
  try {
    if (file.exists) file.delete();
  } catch {
    // Already gone.
  }
}

/** Removes leftovers of downloads that never finished (the app was closed mid-download). */
export function clearPartialDownloads() {
  try {
    const directory = new Directory(Paths.cache, 'partial-downloads');
    if (directory.exists) directory.delete();
  } catch {
    // Best effort.
  }
}
