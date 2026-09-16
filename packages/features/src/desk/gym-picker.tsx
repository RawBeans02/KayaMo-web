'use client';

import { useMemo, useState } from 'react';
import {
  listedSubstitutes,
  searchCatalog,
  type CatalogExercise,
  type MovementKind,
  type MovementPattern,
  type SplitGroup,
} from '../gym/library';
import styles from '../food/desk.module.css';

const GROUPS: Array<{ id: SplitGroup | 'all'; label: string }> = [
  { id: 'all', label: 'All groups' },
  { id: 'push', label: 'Push' },
  { id: 'pull', label: 'Pull' },
  { id: 'legs', label: 'Legs' },
  { id: 'core', label: 'Core' },
];

const MOVEMENTS: Array<{ id: MovementKind | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'compound', label: 'Compound' },
  { id: 'isolated', label: 'Isolated' },
];

const GEAR: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'Any gear' },
  { id: 'barbell', label: 'Barbell' },
  { id: 'dumbbell', label: 'Dumbbell' },
  { id: 'cable', label: 'Cable' },
  { id: 'machine', label: 'Machine' },
  { id: 'bodyweight', label: 'Bodyweight' },
];

const PATTERNS: Array<{ id: MovementPattern | 'all'; label: string }> = [
  { id: 'all', label: 'Any pattern' },
  { id: 'horizontal_push', label: 'Horiz. push' },
  { id: 'vertical_push', label: 'Vert. push' },
  { id: 'horizontal_pull', label: 'Horiz. pull' },
  { id: 'vertical_pull', label: 'Vert. pull' },
  { id: 'squat', label: 'Squat' },
  { id: 'hip_hinge', label: 'Hinge' },
  { id: 'lunge', label: 'Lunge' },
];

function patternLabel(id: string): string {
  return id.replaceAll('_', ' ');
}

export function GymPicker({
  selectedSlug,
  onSelect,
}: {
  selectedSlug: string | null;
  onSelect: (exercise: CatalogExercise) => void;
}) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<SplitGroup | 'all'>('all');
  const [movement, setMovement] = useState<MovementKind | 'all'>('all');
  const [pattern, setPattern] = useState<MovementPattern | 'all'>('all');
  const [equipment, setEquipment] = useState('all');
  const [active, setActive] = useState(0);

  const rows = useMemo(
    () => searchCatalog({ query, group, movement, pattern, equipment }),
    [equipment, group, movement, pattern, query],
  );
  const highlight = rows.length === 0 ? 0 : Math.min(active, rows.length - 1);
  const swaps = selectedSlug ? listedSubstitutes(selectedSlug, 5) : [];

  return (
    <div className={styles.picker}>
      <label className={styles.search}>
        <span>Search lifts</span>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActive((current) => Math.min(current + 1, Math.max(rows.length - 1, 0)));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((current) => Math.max(current - 1, 0));
            } else if (event.key === 'Enter') {
              const row = rows[highlight];
              if (!row) return;
              event.preventDefault();
              onSelect(row);
            }
          }}
          placeholder="Squat, DB bench, RDL, pulldown…"
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls="gym-catalog"
        />
      </label>
      <div className={styles.chipRow} role="group" aria-label="Split group">
        {GROUPS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={styles.chip}
            data-on={group === item.id ? 'true' : 'false'}
            onClick={() => {
              setGroup(item.id);
              setActive(0);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className={styles.chipRow} role="group" aria-label="Mechanic">
        {MOVEMENTS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={styles.chip}
            data-on={movement === item.id ? 'true' : 'false'}
            onClick={() => {
              setMovement(item.id);
              setActive(0);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className={styles.chipRow} role="group" aria-label="Movement pattern">
        {PATTERNS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={styles.chip}
            data-on={pattern === item.id ? 'true' : 'false'}
            onClick={() => {
              setPattern(item.id);
              setActive(0);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className={styles.chipRow} role="group" aria-label="Equipment">
        {GEAR.map((item) => (
          <button
            key={item.id}
            type="button"
            className={styles.chip}
            data-on={equipment === item.id ? 'true' : 'false'}
            onClick={() => {
              setEquipment(item.id);
              setActive(0);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      {swaps.length > 0 ? (
        <p className={styles.statNote}>
          If this station is taken:{' '}
          {swaps.map((row, index) => (
            <span key={row.exercise.slug}>
              {index > 0 ? ' · ' : null}
              <button
                type="button"
                className={styles.textAction}
                onClick={() => onSelect(row.exercise)}
              >
                {row.exercise.name}
              </button>
            </span>
          ))}
        </p>
      ) : null}
      <div className={styles.pickerListWrap}>
        <table className={styles.table} id="gym-catalog">
          <thead>
            <tr>
              <th scope="col">Lift</th>
              <th scope="col">Pattern</th>
              <th scope="col">Muscle</th>
              <th scope="col">Kind</th>
              <th scope="col">Gear</th>
              <th scope="col">Track</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.wrap}>
                  No lifts match that search. Try an exercise name, muscle, or movement pattern.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={row.slug}
                  data-active={row.slug === selectedSlug || index === highlight ? 'true' : 'false'}
                >
                  <th scope="row">
                    <button
                      type="button"
                      className={styles.textAction}
                      onClick={() => onSelect(row)}
                      onMouseEnter={() => setActive(index)}
                    >
                      {row.name}
                    </button>
                  </th>
                  <td>{patternLabel(row.movementPattern)}</td>
                  <td>{row.primaryMuscle}</td>
                  <td>
                    {row.movement} · {row.laterality}
                  </td>
                  <td>{row.equipment}</td>
                  <td>{row.trackingMode.replaceAll('_', ' ')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className={styles.statNote}>
        {rows.length} in view. Pick a row, then log. Search matches aliases (DB bench, RDL) and
        families. It does not create a new lift.
      </p>
    </div>
  );
}
