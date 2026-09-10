import { liveQuery } from 'dexie';
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { LocalFoodEntry, LocalMealTemplate } from './db';
import { isDatabaseClosedError, recoverClosedOfflineDb, reviveClosedOfflineDb } from './db';
import { getPlanningSnapshot, type PlanningSnapshot } from './planning-snapshot';
import { bindStatusStore, getSyncStatusSnapshot, type SyncStatus } from './sync';
import { listLocalFoodEntries, listLocalFoodHistory, listLocalMealTemplates } from './writes';

const SSR_STATUS: SyncStatus = { kind: 'synced' };

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(bindStatusStore, getSyncStatusSnapshot, () => SSR_STATUS);
}

function observeLive<T>(
  query: () => Promise<T>,
  onNext: (value: T) => void,
  onClosed: () => void,
  onError?: () => void,
): () => void {
  const subscription = liveQuery(() => recoverClosedOfflineDb(query)).subscribe({
    next: onNext,
    error: (error) => {
      if (isDatabaseClosedError(error)) {
        reviveClosedOfflineDb();
        window.setTimeout(onClosed, 0);
        return;
      }
      onError?.();
    },
  });
  return () => subscription.unsubscribe();
}

export function useLiveFoodEntries(userId: string | null, logicalDate: string): LocalFoodEntry[] {
  const [rows, setRows] = useState<LocalFoodEntry[]>([]);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (!userId) {
      setRows([]);
      return;
    }
    let cancelled = false;
    const stop = observeLive(
      () => listLocalFoodEntries(userId, logicalDate),
      setRows,
      () => {
        if (!cancelled) setGeneration((current) => current + 1);
      },
      () => setRows([]),
    );
    return () => {
      cancelled = true;
      stop();
    };
  }, [userId, logicalDate, generation]);

  return rows;
}

export function useLiveFoodHistory(userId: string | null): LocalFoodEntry[] {
  const [rows, setRows] = useState<LocalFoodEntry[]>([]);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (!userId) {
      setRows([]);
      return;
    }
    let cancelled = false;
    const stop = observeLive(
      () => listLocalFoodHistory(userId),
      setRows,
      () => {
        if (!cancelled) setGeneration((current) => current + 1);
      },
      () => setRows([]),
    );
    return () => {
      cancelled = true;
      stop();
    };
  }, [userId, generation]);

  return rows;
}

export function useLiveMealTemplates(userId: string | null): LocalMealTemplate[] {
  const [rows, setRows] = useState<LocalMealTemplate[]>([]);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (!userId) {
      setRows([]);
      return;
    }
    let cancelled = false;
    const stop = observeLive(
      () => listLocalMealTemplates(userId),
      setRows,
      () => {
        if (!cancelled) setGeneration((current) => current + 1);
      },
      () => setRows([]),
    );
    return () => {
      cancelled = true;
      stop();
    };
  }, [userId, generation]);

  return rows;
}

export function useLivePlanningSnapshot(params: {
  userId: string;
  date: string;
  today: string;
  tomorrow: string;
  nowIso: string;
  weekStart: string;
  weekEnd: string;
}): PlanningSnapshot | null {
  const [snapshot, setSnapshot] = useState<PlanningSnapshot | null>(null);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const stop = observeLive(
      () => getPlanningSnapshot(params),
      (next) => {
        if (!cancelled) setSnapshot(next);
      },
      () => {
        if (!cancelled) setGeneration((current) => current + 1);
      },
    );
    return () => {
      cancelled = true;
      stop();
    };
  }, [
    params.userId,
    params.date,
    params.today,
    params.tomorrow,
    params.nowIso,
    params.weekStart,
    params.weekEnd,
    generation,
  ]);

  return snapshot;
}
