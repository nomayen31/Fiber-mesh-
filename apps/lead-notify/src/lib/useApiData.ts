/**
 * Tiny data-fetching hook for the authenticated screens.
 *
 * Deliberately not a query library: the app only needs "load, show a spinner,
 * show an error, allow pull-to-refresh, allow an out-of-band refresh when a push
 * arrives". Keeping it here means the behaviour is identical on every screen.
 */

import { useCallback, useEffect, useState } from "react";

export type ApiData<T> = {
  data: T | null;
  error: string | null;
  /** True only for the *first* load — pull-to-refresh uses `refreshing`. */
  loading: boolean;
  refreshing: boolean;
  reload: () => void;
  refresh: () => Promise<void>;
  /** Patch the cached value without a round trip (e.g. after a status change). */
  setData: (value: T) => void;
};

export function useApiData<T>(load: () => Promise<T>): ApiData<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const result = await load();
        if (!cancelled) setData(result);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "তথ্য আনা যায়নি।");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [load, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await load();
      setData(result);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "তথ্য আনা যায়নি।");
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  return {
    data,
    error,
    loading,
    refreshing,
    reload,
    refresh,
    setData: (value: T) => setData(value),
  };
}
