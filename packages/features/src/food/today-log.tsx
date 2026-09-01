'use client';

import type { Food, MealTemplateItem, Serving } from '@kayamo/db';
import { createBrowserSupabase, listServings, listVisibleFoods } from '@kayamo/db';
import {
  asMealSlot,
  entriesOnLogicalDate,
  lastMealSlotEntries,
  mealSlotAtHour,
  mealSlotLabel,
  QUICK_LOG_LIMIT,
  rankQuickLogFoods,
  scaleNutrientSnapshot,
  shiftLogicalDate,
  type MealSlot,
  type QuickLogCandidate,
  type QuickLogHistoryEntry,
} from '@kayamo/food/quick-log';
import type { LocalFoodEntry, LogFoodEntryInput } from '@kayamo/offline';
import {
  cacheFoodWithServings,
  getCachedServings,
  getOfflineDb,
  recoverClosedOfflineDb,
  localHourFromInstant,
  logicalDateFromInstant,
  logFoodEntries,
  saveMealTemplate,
  tombstoneLocalFoodEntries,
  useLiveFoodEntries,
  useLiveFoodHistory,
  useLiveMealTemplates,
} from '@kayamo/offline';
import { Button, NumberDisplay, Sheet, Toast } from '@kayamo/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { hydrateFoodHistory } from './hydrate-food-history';
import { PHONE_TOAST_DOCK_CLASS } from './phone-chrome';
import { defaultQuantityFromServings, QuantitySheet, toSheetServings, type QuantityTarget } from './quantity-form';

const UNDO_MS = 8000;
const HISTORY_DAYS = 30;

function toHistory(entry: LocalFoodEntry, timeZone: string): QuickLogHistoryEntry | null {
  if (!entry.food_id) return null;
  const mealSlot = asMealSlot(entry.meal_slot);
  if (!mealSlot) return null;
  return {
    foodId: entry.food_id,
    name: entry.food_name_snapshot,
    mealSlot,
    loggedAtMs: Date.parse(entry.logged_at),
    localHour: localHourFromInstant(entry.logged_at, timeZone),
    quantity: entry.quantity,
    grams: entry.grams,
    servingId: entry.serving_id,
    servingLabel: entry.serving_label_snapshot,
    kcal: entry.kcal,
    protein_g: entry.protein_g,
    carbs_g: entry.carbs_g,
    fat_g: entry.fat_g,
    fiber_g: entry.fiber_g,
    sugar_g: entry.sugar_g,
    sodium_mg: entry.sodium_mg,
    source: entry.source,
    resolvedVia: entry.resolved_via,
    confidence: entry.confidence,
  };
}

function toLogInput(
  userId: string,
  mealSlot: MealSlot,
  item: QuantityTarget | QuickLogHistoryEntry | MealTemplateItem,
  timeZone: string,
  dayStartsAt: string,
): LogFoodEntryInput | null {
  const foodId = 'foodId' in item ? item.foodId : null;
  const foodName = 'name' in item ? item.name : 'foodName' in item ? item.foodName : null;
  if (!foodId || !foodName) return null;
  return {
    userId,
    mealSlot,
    foodId,
    foodName,
    quantity: item.quantity,
    grams: item.grams,
    kcal: item.kcal,
    protein_g: item.protein_g,
    carbs_g: item.carbs_g,
    fat_g: item.fat_g,
    fiber_g: item.fiber_g,
    sugar_g: item.sugar_g,
    sodium_mg: item.sodium_mg,
    source: item.source as LogFoodEntryInput['source'],
    resolvedVia: item.resolvedVia as LogFoodEntryInput['resolvedVia'],
    inputMethod: 'quick',
    servingId: item.servingId,
    servingLabel: item.servingLabel,
    confidence: item.confidence,
    timeZone,
    dayStartsAt,
  };
}

function fallbackCandidates(foods: Food[], servingsById: Map<string, Serving[]>): QuickLogCandidate[] {
  return foods
    .filter((food) => !food.deleted_at)
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, QUICK_LOG_LIMIT)
    .map((food) => {
      const qty = defaultQuantityFromServings(servingsById.get(food.id) ?? []);
      const nutrients = scaleNutrientSnapshot(food, Number(qty.grams) || 100);
      return {
        foodId: food.id,
        name: food.name,
        score: 0,
        hourFrequency: 0,
        recency: 0,
        ...qty,
        ...nutrients,
        source: food.source,
        resolvedVia: food.source,
        confidence: food.confidence,
      };
    });
}

export function TodayLog({
  userId,
  toastDockClassName = PHONE_TOAST_DOCK_CLASS,
}: {
  userId: string;
  toastDockClassName?: string;
}) {
  const [timeZone, setTimeZone] = useState('Asia/Manila');
  const [dayStartsAt, setDayStartsAt] = useState('00:00:00');
  const [cachedFoods, setCachedFoods] = useState<Food[]>([]);
  const [servingsById, setServingsById] = useState<Map<string, Serving[]>>(new Map());
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [sheetTarget, setSheetTarget] = useState<QuantityTarget | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [undo, setUndo] = useState<{ ids: string[]; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | 0>(0);

  const today = logicalDateFromInstant(new Date(nowMs).toISOString(), timeZone, dayStartsAt);
  const hour = localHourFromInstant(new Date(nowMs).toISOString(), timeZone);
  const mealSlot = mealSlotAtHour(hour);
  const entries = useLiveFoodEntries(userId, today);
  const historyRows = useLiveFoodHistory(userId);
  const templates = useLiveMealTemplates(userId);

  const history = useMemo(
    () => historyRows.flatMap((row) => toHistory(row, timeZone) ?? []),
    [historyRows, timeZone],
  );

  const ranked = useMemo(
    () => rankQuickLogFoods(history, { mealSlot, hour, nowMs }),
    [history, mealSlot, hour, nowMs],
  );

  const chips = ranked.length > 0 ? ranked : fallbackCandidates(cachedFoods, servingsById);
  const ready = chips.length > 0;

  const yesterday = shiftLogicalDate(today, -1);
  const yesterdayItems = useMemo(
    () => entriesOnLogicalDate(history, yesterday, (ms) => logicalDateFromInstant(new Date(ms).toISOString(), timeZone, dayStartsAt)),
    [history, yesterday, timeZone, dayStartsAt],
  );
  const lastSlotItems = useMemo(
    () =>
      lastMealSlotEntries(history, mealSlot, today, (ms) =>
        logicalDateFromInstant(new Date(ms).toISOString(), timeZone, dayStartsAt),
      ),
    [history, mealSlot, today, timeZone, dayStartsAt],
  );
  const slotToday = entries.filter((row) => asMealSlot(row.meal_slot) === mealSlot);

  useEffect(() => {
        const client = createBrowserSupabase();
        let cancelled = false;

        async function hydrate() {
          try {
            const { timeZone: tz, dayStartsAt: start } = await hydrateFoodHistory({
              client,
              userId,
              historyDays: HISTORY_DAYS,
            });
            if (cancelled) return;
            setTimeZone(tz);
            setDayStartsAt(start);

            const remoteFoods = await listVisibleFoods(client);
            for (const item of remoteFoods) {
              const servings = await listServings(client, item.id);
              await cacheFoodWithServings(item, servings);
            }
          } catch {
            // Offline: Dexie cache is enough.
          }

          try {
            const foods = (
              await recoverClosedOfflineDb(async () => getOfflineDb().foods.toArray())
            ).filter((item) => !item.deleted_at);
            const map = new Map<string, Serving[]>();
            for (const food of foods) {
              map.set(food.id, await getCachedServings(food.id));
            }
            if (cancelled) return;
            setCachedFoods(foods);
            setServingsById(map);
          } catch {
            // Auth/scope switch can close IndexedDB; live queries retry.
          }
        }

    void hydrate();
    const tick = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => {
      cancelled = true;
      clearInterval(tick);
    };
  }, [userId]);

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  function showUndo(ids: string[], message: string) {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo({ ids, message });
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
  }

  async function logItems(
    items: Array<QuantityTarget | QuickLogHistoryEntry | MealTemplateItem>,
    slot: MealSlot,
    message: string,
  ) {
    setError(null);
    const inputs = items.flatMap((item) => {
    const row = toLogInput(
      userId,
      'mealSlot' in item && asMealSlot(String(item.mealSlot)) ? item.mealSlot : slot,
      item,
      timeZone,
      dayStartsAt,
    );
      return row ? [row] : [];
    });
    if (inputs.length === 0) return;
    try {
      const rows = await logFoodEntries(inputs);
      showUndo(
        rows.map((row) => row.id),
        message,
      );
    } catch {
      setError('Could not save locally. Try again.');
    }
  }

  async function onUndo() {
    if (!undo) return;
    const ids = undo.ids;
    setUndo(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    await tombstoneLocalFoodEntries({ ids, userId });
  }

  async function onSaveTemplate() {
    const name = templateName.trim();
    if (!name || slotToday.length === 0) return;
    const items: MealTemplateItem[] = slotToday.flatMap((row) => {
      if (!row.food_id) return [];
      const source = row.source as MealTemplateItem['source'];
      const resolvedVia = row.resolved_via as MealTemplateItem['resolvedVia'];
      return [
        {
          foodId: row.food_id,
          foodName: row.food_name_snapshot,
          quantity: row.quantity,
          grams: row.grams,
          servingId: row.serving_id,
          servingLabel: row.serving_label_snapshot,
          kcal: row.kcal,
          protein_g: row.protein_g,
          carbs_g: row.carbs_g,
          fat_g: row.fat_g,
          fiber_g: row.fiber_g,
          sugar_g: row.sugar_g,
          sodium_mg: row.sodium_mg,
          source,
          resolvedVia,
          confidence: row.confidence,
        },
      ];
    });
    if (items.length === 0) return;
    try {
      await saveMealTemplate({ userId, name, items });
      setTemplateName('');
      setTemplateOpen(false);
    } catch {
      setError('Could not save that template.');
    }
  }

  return (
    <section className="mt-8 flex min-h-[calc(100dvh-14rem)] flex-col gap-4">
      <div data-testid="food-cache-ready" data-ready={ready ? '1' : '0'} hidden>
        {ready ? 'ready' : 'loading'}
      </div>

      <ul className="flex flex-col gap-3">
        {entries.map((entry) => (
          <li key={entry.id} data-testid="food-entry" className="border-y border-line py-3">
            <p className="font-data text-caption uppercase tracking-[0.14em] text-muted">
              {mealSlotLabel(asMealSlot(entry.meal_slot) ?? 'tanghalian')}
            </p>
            <p className="font-body text-body">{entry.food_name_snapshot}</p>
            <NumberDisplay value={String(Math.round(Number(entry.kcal)))} unit="kcal" size="sm" />
          </li>
        ))}
      </ul>

      <div className="mt-auto flex flex-col gap-3 pt-6">
        {templates.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() =>
                  void logItems(
                    template.items,
                    mealSlot,
                    `Logged ${template.name}`,
                  )
                }
                className="min-h-12 shrink-0 rounded-md bg-surface-2 px-4 font-body text-body text-text"
              >
                {template.name}
              </button>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          disabled={slotToday.length === 0}
          onClick={() => setTemplateOpen(true)}
          className="self-start font-data text-caption uppercase tracking-[0.14em] text-accent disabled:text-muted"
        >
          Save this {mealSlotLabel(mealSlot).toLowerCase()} as a template
        </button>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={yesterdayItems.length === 0}
            onClick={() => void logItems(yesterdayItems, mealSlot, 'Logged same as yesterday')}
          >
            Same as yesterday
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={lastSlotItems.length === 0}
            onClick={() =>
              void logItems(lastSlotItems, mealSlot, `Logged last ${mealSlotLabel(mealSlot).toLowerCase()}`)
            }
          >
            Repeat last {mealSlotLabel(mealSlot).toLowerCase()}
          </Button>
        </div>

        <p className="font-data text-caption uppercase tracking-[0.14em] text-muted">
          Quick log · {mealSlotLabel(mealSlot)}
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {chips.map((chip, index) => (
            <QuickChip
              key={chip.foodId}
              testId={index === 0 ? 'log-meal' : undefined}
              label={chip.name}
              onTap={() => void logItems([chip], mealSlot, `Logged ${chip.name}`)}
              onLongPress={() => setSheetTarget(chip)}
            />
          ))}
        </div>
        {error ? <p className="font-body text-body text-warning">{error}</p> : null}
      </div>

      {sheetTarget ? (
        <QuantitySheet
          key={sheetTarget.foodId}
          target={sheetTarget}
          servings={toSheetServings(servingsById.get(sheetTarget.foodId) ?? [])}
          onClose={() => setSheetTarget(null)}
          onConfirm={(next) => {
            setSheetTarget(null);
            void logItems([next], mealSlot, `Logged ${next.name}`);
          }}
        />
      ) : null}

      <Sheet
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        title="Name this template"
        footer={
          <Button type="button" size="lg" disabled={!templateName.trim()} onClick={() => void onSaveTemplate()}>
            Save
          </Button>
        }
      >
        <label className="flex flex-col gap-2">
          <span className="font-data text-caption uppercase tracking-[0.14em] text-muted">name</span>
          <input
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value.slice(0, 80))}
            placeholder="Baon"
            className="min-h-12 border-b border-line bg-transparent px-0 font-body text-body text-text outline-none placeholder:text-muted"
          />
        </label>
      </Sheet>

      {undo ? (
        <div className={toastDockClassName}>
          <Toast
            message={undo.message}
            action={
              <button type="button" onClick={() => void onUndo()} className="font-semibold text-accent">
                Undo
              </button>
            }
          />
        </div>
      ) : null}
    </section>
  );
}

function QuickChip({
  label,
  onTap,
  onLongPress,
  testId,
}: {
  label: string;
  onTap: () => void;
  onLongPress: () => void;
  testId?: string;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | 0>(0);
  const didLong = useRef(false);

  function clear() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = 0;
  }

  return (
    <button
      type="button"
      data-testid={testId}
      className="min-h-12 shrink-0 rounded-md bg-accent px-4 font-body text-body font-semibold text-accent-fg"
      onContextMenu={(event) => {
        event.preventDefault();
        onLongPress();
      }}
      onPointerDown={() => {
        didLong.current = false;
        timer.current = setTimeout(() => {
          didLong.current = true;
          onLongPress();
        }, 450);
      }}
      onPointerUp={() => {
        const held = didLong.current;
        clear();
        if (!held) onTap();
      }}
      onPointerCancel={clear}
      onPointerLeave={clear}
    >
      {label}
    </button>
  );
}
