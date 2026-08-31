export function sortVerifyRows<T extends { id: string; name: string }>(
  rows: readonly T[],
  logCounts: ReadonlyMap<string, number>,
): T[] {
  return [...rows].sort((a, b) => {
    const countA = logCounts.get(a.id) ?? 0;
    const countB = logCounts.get(b.id) ?? 0;
    if (countB !== countA) return countB - countA;
    return a.name.localeCompare(b.name);
  });
}

export function moveVerifyIndex(index: number, length: number, direction: 1 | -1): number {
  if (length <= 0) return 0;
  return (index + direction + length) % length;
}
