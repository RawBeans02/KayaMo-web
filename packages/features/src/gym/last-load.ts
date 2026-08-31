export function lastLoadKg(
  sets: readonly {
    exercise_name_snapshot: string;
    weight_kg: string;
    completed_at: string | null;
  }[],
  name: string,
): string | null {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  let bestAt = '';
  let bestKg: string | null = null;
  for (const row of sets) {
    if (!row.completed_at) continue;
    if (row.exercise_name_snapshot.trim().toLowerCase() !== needle) continue;
    if (!bestKg || row.completed_at > bestAt) {
      bestAt = row.completed_at;
      bestKg = row.weight_kg;
    }
  }
  return bestKg;
}

export type LastSessionSet = {
  setIndex: number;
  weightKg: string;
  reps: number;
  isWarmup: boolean;
};

export function lastSessionSets(
  sets: readonly {
    workout_id: string;
    exercise_name_snapshot: string;
    set_index: number;
    weight_kg: string;
    reps: number;
    is_warmup: boolean;
    completed_at: string | null;
  }[],
  name: string,
): LastSessionSet[] {
  const needle = name.trim().toLowerCase();
  const matches = sets.filter(
    (row) =>
      row.completed_at && row.exercise_name_snapshot.trim().toLowerCase() === needle,
  );
  if (matches.length === 0) return [];
  const latestWorkout = matches.reduce((latest, row) => {
    const stamp = row.completed_at ?? '';
    return stamp > latest.completed_at! ? row : latest;
  });
  return matches
    .filter((row) => row.workout_id === latestWorkout.workout_id)
    .sort((a, b) => a.set_index - b.set_index)
    .map((row) => ({
      setIndex: row.set_index,
      weightKg: row.weight_kg,
      reps: row.reps,
      isWarmup: row.is_warmup,
    }));
}
