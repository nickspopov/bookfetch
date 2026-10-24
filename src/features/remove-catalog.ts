import { Alert } from 'react-native';

import { removeCatalog } from '@/lib/catalog-actions';
import type { Catalog } from '@/lib/catalogs';

/** Removes a catalog, or keeps it and says so when its saved login could not be deleted. */
export async function removeCatalogWithFeedback(catalog: Catalog) {
  try {
    await removeCatalog(catalog.id);
  } catch {
    Alert.alert(`Couldn't remove “${catalog.title}”`, "Couldn't remove the saved login. Try again.");
  }
}
