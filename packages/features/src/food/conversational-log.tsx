'use client';

import { foodParseSchema, parseFoodMessageHeuristic, type FoodParse } from '@kayamo/food';
import { resolveFromCatalogFoods, type CatalogFood } from '@kayamo/food/search-ui';
import {
  logFoodEntry,
  restoreLocalFoodEntry,
  reviseLocalFoodEntry,
  tombstoneLocalFoodEntry,
  type LocalFoodEntry,
} from '@kayamo/offline';
import { useMemo, useState } from 'react';
import { catalogForCommandLog } from './command-log-model';
import { applyFoodParse, type ApplyParseResult, type LedgerEntry } from './conversational-ledger';
import {
  loadPersonalFoodMemory,
  savePersonalFoodMemory,
  type PersonalFoodMemory,
} from './personal-food-memory';
import styles from './desk.module.css';

function toLedger(row: LocalFoodEntry): LedgerEntry {
  return {
    id: row.id,
    user_id: row.user_id,
    food_id: row.food_id,
    food_name_snapshot: row.food_name_snapshot,
    meal_slot: row.meal_slot,
    quantity: row.quantity,
    grams: row.grams,
    serving_label_snapshot: row.serving_label_snapshot,
    kcal: row.kcal,
    protein_g: row.protein_g,
    carbs_g: row.carbs_g,
    fat_g: row.fat_g,
    fiber_g: row.fiber_g,
    sugar_g: row.sugar_g,
    sodium_mg: row.sodium_mg,
    source: row.source,
    resolved_via: row.resolved_via,
    confidence: row.confidence,
    logical_date: row.logical_date,
    deleted_at: row.deleted_at,
  };
}

export function ConversationalLog({
  userId,
  logicalDate,
  today,
  timeZone,
  dayStartsAt,
  entries,
  history,
  catalog,
  onLogicalDateChange,
}: {
  userId: string;
  logicalDate: string;
  today: string;
  timeZone: string;
  dayStartsAt: string;
  entries: LocalFoodEntry[];
  history: LocalFoodEntry[];
  catalog: CatalogFood[];
  onLogicalDateChange: (date: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ApplyParseResult | null>(null);
  const [pendingParse, setPendingParse] = useState<{ parsed: FoodParse; raw: string; memory: PersonalFoodMemory } | null>(
    null,
  );
  const foods = useMemo(() => catalogForCommandLog(catalog), [catalog]);

  async function run(raw: string, parsed: FoodParse, memory: PersonalFoodMemory, confirmed: boolean) {
    const working = history.map(toLedger);
    const applied = await applyFoodParse(
      {
        userId,
        logicalDate,
        today,
        timeZone,
        dayStartsAt,
        parsed,
        rawMessage: raw,
        entries: working.filter((row) => row.logical_date === logicalDate),
        history: working,
        memory,
        confirmed,
      },
      {
        resolve: (query) => resolveFromCatalogFoods(query, userId, foods),
        log: (row) => logFoodEntry(row),
        revise: (row) => reviseLocalFoodEntry(row),
        tombstone: (id) => tombstoneLocalFoodEntry({ id, userId }),
      },
    );
    savePersonalFoodMemory(userId, applied.memory, window.localStorage);
    if (applied.nextDate !== logicalDate) onLogicalDateChange(applied.nextDate);
    setResult(applied);
    if (applied.needsConfirm && !confirmed) {
      setPendingParse({ parsed, raw, memory: applied.memory });
    } else {
      setPendingParse(null);
      setDraft('');
    }
  }

  async function submit(confirmed = false) {
    const raw = draft.trim();
    if (!raw && !pendingParse) return;
    setBusy(true);
    try {
      const memory = loadPersonalFoodMemory(userId, window.localStorage);
      const parsed =
        confirmed && pendingParse
          ? pendingParse.parsed
          : await parseFromServer(
              raw || pendingParse?.raw || '',
              logicalDate,
              entries,
              memory.aliases,
            ).catch(() =>
              parseFoodMessageHeuristic(raw, {
                logicalDate,
                entries: entries.map((row) => ({
                  id: row.id,
                  displayName: row.food_name_snapshot,
                  mealSlot: row.meal_slot,
                  quantity: Number(row.quantity) || 1,
                  unit: row.serving_label_snapshot,
                })),
                aliases: memory.aliases,
              }),
            );
      await run(raw || pendingParse?.raw || '', parsed, pendingParse?.memory ?? memory, confirmed);
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (!result?.undo.length) return;
    for (const action of [...result.undo].reverse()) {
      if (action.kind === 'create') {
        await tombstoneLocalFoodEntry({ id: action.id, userId });
      } else if (action.kind === 'delete') {
        await restoreLocalFoodEntry({ id: action.id, userId });
      } else {
        await reviseLocalFoodEntry(action.before);
      }
    }
    setResult(null);
  }

  return (
    <div className={styles.converse}>
      <label className={styles.search}>
        <span>Say what you ate</span>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={2}
          placeholder='breakfast 2 slices marbys, half tbsp nutella and skippy'
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void submit(false);
            }
          }}
        />
      </label>
      <div className={styles.converseActions}>
        <button type="button" className={styles.primary} disabled={busy} onClick={() => void submit(false)}>
          {busy ? 'Reading…' : 'Log'}
        </button>
        {pendingParse ? (
          <button type="button" className={styles.ghost} disabled={busy} onClick={() => void submit(true)}>
            Confirm
          </button>
        ) : null}
        {result?.undo.length ? (
          <button type="button" className={styles.ghost} onClick={() => void undo()}>
            Undo
          </button>
        ) : null}
      </div>
      {result ? <ApplySummary result={result} /> : null}
    </div>
  );
}

function ApplySummary({ result }: { result: ApplyParseResult }) {
  return (
    <div className={styles.converseResult} role="status">
      {result.clarifications.map((line) => (
        <p key={line}>{line}</p>
      ))}
      {result.needsConfirm ? <p>Confirm to save this.</p> : null}
      {result.lines.length > 0 ? (
        <ul>
          {result.lines.map((line, index) => (
            <li key={`${line.name}-${index}`}>
              {line.name}
              {line.detail ? ` · ${line.detail}` : ''}
              {line.kcal !== undefined ? ` · ${Math.round(line.kcal)} kcal` : ''}
              {line.deltaKcal ? ` · ${line.deltaKcal > 0 ? '+' : ''}${Math.round(line.deltaKcal)} kcal` : ''}
            </li>
          ))}
        </ul>
      ) : null}
      <p>
        Today: {result.totals.calories.toLocaleString('en-PH')} kcal
        {result.totals.estimated_low !== result.totals.estimated_high
          ? ` · likely ${result.totals.estimated_low.toLocaleString('en-PH')}–${result.totals.estimated_high.toLocaleString('en-PH')}`
          : ''}
      </p>
    </div>
  );
}

async function parseFromServer(
  message: string,
  logicalDate: string,
  entries: LocalFoodEntry[],
  aliases: Record<string, string>,
): Promise<FoodParse> {
  const response = await fetch('/api/foods/parse', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message,
      logicalDate,
      aliases,
      entries: entries.map((row) => ({
        id: row.id,
        displayName: row.food_name_snapshot,
        mealSlot: row.meal_slot,
        quantity: Number(row.quantity) || 1,
        unit: row.serving_label_snapshot,
      })),
    }),
  });
  if (!response.ok) throw new Error('parse failed');
  return foodParseSchema.parse(await response.json());
}
