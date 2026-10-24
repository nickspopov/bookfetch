import { useEffect, useState } from 'react';

import type { Catalog } from './catalogs';
import { sessionFor, type CatalogSession } from './client';

/** The catalog's client once its keychain items are loaded. */
export function useCatalogSession(catalog: Catalog | undefined) {
  const [state, setState] = useState<{ key?: string; session?: CatalogSession; error?: unknown }>({});
  const key = catalog ? `${catalog.id}|${catalog.url}|${catalog.hasCredentials}|${catalog.urlInKeychain}` : undefined;

  useEffect(() => {
    if (!catalog || !key) return;
    let cancelled = false;
    sessionFor(catalog).then(
      (session) => !cancelled && setState({ key, session }),
      (error: unknown) => !cancelled && setState({ key, error }),
    );
    return () => {
      cancelled = true;
    };
    // The key captures every catalog field the session depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state.key === key ? state : {};
}
