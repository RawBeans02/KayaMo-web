'use client';

import { useEffect, useState } from 'react';

export function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let interval = 0;
    const delay = Math.max(250, 60_000 - (Date.now() % 60_000));
    const timeout = window.setTimeout(() => {
      setNow(Date.now());
      interval = window.setInterval(() => setNow(Date.now()), 60_000);
    }, delay);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, []);

  return now;
}

export function useSecondClock(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  return now;
}
