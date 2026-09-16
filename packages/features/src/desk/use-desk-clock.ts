'use client';

import { createBrowserSupabase } from '@kayamo/db';
import { logicalDateFromInstant } from '@kayamo/offline';
import { useEffect, useState } from 'react';
import { hydrateFoodHistory } from '../food/hydrate-food-history';
import { browserTimeZone } from '../food/default-clock';

export function useDeskClock(userId: string) {
  const [clock, setClock] = useState({ timeZone: 'UTC', dayStartsAt: '00:00:00' });
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const client = createBrowserSupabase();
    let cancelled = false;
    void hydrateFoodHistory({ client, userId })
      .then((next) => {
        if (!cancelled) setClock(next);
      })
      .catch(() => {
        if (!cancelled) setClock({ timeZone: browserTimeZone(), dayStartsAt: '00:00:00' });
      });
    const tick = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(tick);
    };
  }, [userId]);

  const today = logicalDateFromInstant(
    new Date(nowMs).toISOString(),
    clock.timeZone,
    clock.dayStartsAt,
  );
  return { clock, today, nowMs };
}
