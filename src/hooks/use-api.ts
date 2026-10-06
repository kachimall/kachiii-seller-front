"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface State<T> {
  data?: T;
  error?: unknown;
  /** The request key the data/error belong to. */
  settledKey?: string;
}

/**
 * Loads data on the client whenever `key` changes (pass null to wait). The fetcher can close over
 * anything: only the key decides when it reruns. Old data stays visible while a reload runs.
 */
export function useApi<T>(key: string | null, fetcher: () => Promise<T>) {
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<State<T>>({});
  const requestKey = key === null ? null : `${key}#${nonce}`;

  useEffect(() => {
    if (requestKey === null) return;
    let cancelled = false;
    fetcherRef.current().then(
      (data) => !cancelled && setState({ data, settledKey: requestKey }),
      (error: unknown) => !cancelled && setState((prev) => ({ data: prev.data, error, settledKey: requestKey })),
    );
    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const mutate = useCallback((data: T) => setState((prev) => ({ ...prev, data, error: undefined })), []);

  return {
    data: state.data,
    error: state.settledKey === requestKey ? state.error : undefined,
    loading: requestKey !== null && state.settledKey !== requestKey,
    reload,
    mutate,
  };
}
