'use client';

import {
  clearLocalRestTimer,
  extendLocalRestTimer,
  getLocalRestTimer,
  listLocalWorkoutHistory,
  recoverClosedOfflineDb,
  type LocalRestTimer,
  type LocalWorkout,
} from '@kayamo/offline';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  formatRestClock,
  restIsUrgent,
  restRemainingSeconds,
  sessionElapsedLabel,
} from '../gym/session-clock';
import { useDeskClock } from './use-desk-clock';

export type GymSessionValue = {
  workout: LocalWorkout | null;
  timer: LocalRestTimer | null;
  nowMs: number;
  remainingSeconds: number;
  restLabel: string;
  urgent: boolean;
  elapsedLabel: string | null;
  refresh: () => Promise<void>;
  extend: (seconds: number) => Promise<void>;
  skip: () => Promise<void>;
};

const GymSessionContext = createContext<GymSessionValue | null>(null);

export function GymSessionProvider({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const { today } = useDeskClock(userId);
  const [workout, setWorkout] = useState<LocalWorkout | null>(null);
  const [timer, setTimer] = useState<LocalRestTimer | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    try {
      await recoverClosedOfflineDb(async () => {
        const history = await listLocalWorkoutHistory(userId);
        const live =
          history.find((row) => row.status === 'active' && row.logical_date === today) ??
          history.find((row) => row.status === 'active') ??
          null;
        setWorkout(live);
        setTimer(live ? ((await getLocalRestTimer(live.id)) ?? null) : null);
      });
    } catch {
      // Dexie may not be open yet; the next tick retries.
    }
  }, [today, userId]);

  const extend = useCallback(
    async (seconds: number) => {
      if (!workout) return;
      await extendLocalRestTimer(workout.id, seconds);
      await refresh();
    },
    [refresh, workout],
  );

  const skip = useCallback(async () => {
    if (!workout) return;
    await clearLocalRestTimer(workout.id);
    await refresh();
  }, [refresh, workout]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const id = window.setInterval(() => void refresh(), 2_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const remaining = timer ? restRemainingSeconds(timer, nowMs) : 0;
  const ticking = Boolean(timer && remaining > 0);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), ticking ? 250 : 1_000);
    return () => window.clearInterval(id);
  }, [ticking, timer?.ends_at]);

  const value = useMemo<GymSessionValue>(
    () => ({
      workout,
      timer,
      nowMs,
      remainingSeconds: remaining,
      restLabel: formatRestClock(remaining),
      urgent: restIsUrgent(remaining),
      elapsedLabel: workout ? sessionElapsedLabel(workout.started_at, nowMs) : null,
      refresh,
      extend,
      skip,
    }),
    [extend, nowMs, refresh, remaining, skip, timer, workout],
  );

  return <GymSessionContext.Provider value={value}>{children}</GymSessionContext.Provider>;
}

export function useGymSession(): GymSessionValue {
  const value = useContext(GymSessionContext);
  if (!value) throw new Error('useGymSession requires GymSessionProvider');
  return value;
}
