'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Keep the last confirmed records visible during a refresh; never replace a failed read with an empty list. */
export function useRecords<T>(load: () => Promise<T>) {
  const [data, setData] = useState<{ source: typeof load; value: T }>();
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const ticket = ++generation.current;
    try {
      const result = await load();
      if (generation.current === ticket) {
        setData({ source: load, value: result });
        setError(null);
      }
    } catch {
      if (generation.current === ticket)
        setError('Could not read your saved records. Please retry.');
    }
  }, [load]);
  useEffect(() => {
    void refresh();
    const visible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const timer = window.setInterval(visible, 5000);
    document.addEventListener('visibilitychange', visible);
    return () => {
      generation.current++;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [refresh]);
  return { data: data?.source === load ? data.value : undefined, error, refresh };
}
