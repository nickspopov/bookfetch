import { useEffect, useState } from 'react';

import type { Catalog } from './catalogs';
import { sessionFor, sessionKey, type CatalogSession } from './client';

/** The catalog's client once its keychain items are loaded. */
export function useCatalogSession(catalog: Catalog | undefined) {
  const [state, setState] = useState<{ key?: string; session?: CatalogSession; error?: unknown }>({});
  // The key changes with the catalog's session revision, so an edited login replaces the client of open screens.
  const key = catalog ? sessionKey(catalog) : undefined;

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
