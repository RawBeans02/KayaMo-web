import {
  calculateDailyNutrition,
  extractStatedNutrition,
  mealQueryToSlot,
  parseFoodQuery,
  type FoodParse,
  type FoodParseOperation,
} from '@kayamo/food';
import { rescaleNutrientSnapshot, shiftLogicalDate } from '@kayamo/food/quick-log';
import { nutrientsFromPer100g, persistableFoodId, type FoodCandidate } from '@kayamo/food/search-ui';
import type { LogFoodEntryInput } from '@kayamo/offline';
import { asLogSource, asResolvedVia, toLogInputFromCandidate } from './command-log-model';
import {
  findPersonalFood,
  rememberPersonalFood,
  statedToPersonalFood,
  type PersonalFoodMemory,
  type PersonalFoodRecord,
} from './personal-food-memory';

export type LedgerEntry = {
  id: string;
  user_id: string;
  food_id: string | null;
  food_name_snapshot: string;
  meal_slot: string;
  quantity: string;
  grams: string;
  serving_label_snapshot: string | null;
  kcal: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  fiber_g: string;
  sugar_g: string;
  sodium_mg: string;
  source: string;
  resolved_via: string;
  confidence: string;
  logical_date: string;
  deleted_at?: string | null;
};

export type ApplyParseInput = {
  userId: string;
  logicalDate: string;
  today: string;
  timeZone: string;
  dayStartsAt: string;
  parsed: FoodParse;
  rawMessage: string;
  entries: LedgerEntry[];
  history: LedgerEntry[];
  memory: PersonalFoodMemory;
  confirmed?: boolean;
};

export type AppliedLine = {
  id?: string;
  name: string;
  detail: string;
  kcal?: number;
  deltaKcal?: number;
};

export type UndoAction =
  | { kind: 'create'; id: string }
  | { kind: 'delete'; id: string }
  | { kind: 'revise'; before: ReviseFoodInput };

export type ApplyParseResult = {
  memory: PersonalFoodMemory;
  nextDate: string;
  lines: AppliedLine[];
  pending: FoodParseOperation[];
  clarifications: string[];
  undo: UndoAction[];
  undoIds: string[];
  totals: ReturnType<typeof calculateDailyNutrition>;
  needsConfirm: boolean;
};

const RESTAURANT = /\b(frankie'?s|jollibee|mcdonald|kfc|chowking|greenwich|mang inasal)\b/i;

export type ReviseFoodInput = {
  id: string;
  userId: string;
  quantity: string;
  grams: string;
  kcal: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  fiber_g: string;
  sugar_g: string;
  sodium_mg: string;
};

export async function applyFoodParse(
  input: ApplyParseInput,
  deps: {
    resolve: (query: string) => Promise<FoodCandidate[]>;
    log: (row: LogFoodEntryInput) => Promise<LedgerEntry>;
    revise: (row: ReviseFoodInput) => Promise<LedgerEntry | null>;
    tombstone: (id: string) => Promise<void>;
  },
): Promise<ApplyParseResult> {
  const lines: AppliedLine[] = [];
  const undo: UndoAction[] = [];
  const pending: FoodParseOperation[] = [];
  let memory = input.memory;
  let nextDate = input.logicalDate;
  const live = () => input.entries.filter((row) => !row.deleted_at && row.logical_date === nextDate);

  const needsConfirm =
    !input.confirmed &&
    input.parsed.operations.some(
      (op) =>
        op.type === 'COPY_DAY' ||
        (op.type === 'ADD_FOOD' && RESTAURANT.test(op.query ?? '')) ||
        op.type === 'SAVE_PERSONAL_FOOD',
    );

  if (needsConfirm) {
    const restaurant = input.parsed.operations.some(
      (op) => op.type === 'ADD_FOOD' && RESTAURANT.test(op.query ?? ''),
    );
    return {
      memory,
      nextDate,
      lines,
      pending: input.parsed.operations,
      clarifications: [
        ...input.parsed.clarifications,
        restaurant
          ? 'Restaurant portions are estimates. Confirm to save.'
          : 'Confirm to apply this.',
      ],
      undo,
      undoIds: [],
      totals: calculateDailyNutrition(live()),
      needsConfirm: true,
    };
  }

  if (input.parsed.clarifications.length > 0 && input.parsed.operations.length === 0) {
    return {
      memory,
      nextDate,
      lines,
      pending,
      clarifications: input.parsed.clarifications,
      undo,
      undoIds: [],
      totals: calculateDailyNutrition(live()),
      needsConfirm: false,
    };
  }

  for (const op of input.parsed.operations) {
    if (op.type === 'START_NEW_DAY') {
      nextDate = input.logicalDate === input.today ? shiftLogicalDate(input.today, 1) : input.today;
      lines.push({ name: 'New day', detail: nextDate });
      continue;
    }

    if (op.type === 'SAVE_PERSONAL_FOOD') {
      const stated = extractStatedNutrition(input.rawMessage);
      const record = statedToPersonalFood(op.query ?? 'Food', op.unit, stated ?? {});
      if (!record) {
        pending.push(op);
        continue;
      }
      memory = rememberPersonalFood(memory, record);
      lines.push({
        name: record.displayName,
        detail: `Remembered ${record.kcal} kcal / ${record.servingUnit}`,
      });
      continue;
    }

    if (op.type === 'COPY_MEAL' || op.type === 'COPY_DAY') {
      const cloned = await copyEntries(op, input, deps, nextDate);
      for (const row of cloned) {
        undo.push({ kind: 'create', id: row.id });
        lines.push({ name: row.food_name_snapshot, detail: 'Copied', kcal: Number(row.kcal) });
      }
      continue;
    }

    if (op.type === 'DELETE_FOOD') {
      const target = findLedgerTarget(live(), op.target_hint ?? '');
      if (!target) {
        pending.push(op);
        continue;
      }
      const before = calculateDailyNutrition(live()).calories;
      await deps.tombstone(target.id);
      target.deleted_at = new Date().toISOString();
      const after = calculateDailyNutrition(live()).calories;
      undo.push({ kind: 'delete', id: target.id });
      lines.push({
        name: target.food_name_snapshot,
        detail: 'Removed',
        kcal: Number(target.kcal),
        deltaKcal: after - before,
      });
      continue;
    }

    if (op.type === 'UPDATE_FOOD') {
      const target = findLedgerTarget(live(), op.target_hint ?? op.query ?? '');
      if (!target) {
        pending.push(op);
        continue;
      }
      const beforeKcal = Number(target.kcal);
      const oldQty = target.quantity;
      const snapshot = reviseSnapshot(target);
      const next = patchEntry(target, op);
      const revised = await deps.revise(next);
      if (revised) {
        Object.assign(target, revised);
        undo.push({ kind: 'revise', before: snapshot });
        lines.push({
          name: target.food_name_snapshot,
          detail: `${oldQty} → ${revised.quantity}`,
          kcal: Number(revised.kcal),
          deltaKcal: Number(revised.kcal) - beforeKcal,
        });
      }
      continue;
    }

    if (op.type === 'ADD_FOOD') {
      const query = op.query?.trim();
      if (!query) continue;
      const personal = findPersonalFood(memory, query);
      if (personal) {
        const logged = await deps.log(fromPersonalFood(input, op, personal, nextDate));
        input.entries.push(logged);
        undo.push({ kind: 'create', id: logged.id });
        lines.push({
          name: logged.food_name_snapshot,
          detail: `${logged.quantity} ${personal.servingUnit}`,
          kcal: Number(logged.kcal),
        });
        continue;
      }
      const hits = await deps.resolve(resolveText(query, op.quantity, op.unit));
      const pick = hits[0];
      if (!pick || (hits[1] && pick.rankScore < 0.85)) {
        pending.push(op);
        continue;
      }
      const logged = await logCandidate(input, op, pick, deps, nextDate);
      if (!logged) {
        pending.push(op);
        continue;
      }
      input.entries.push(logged);
      undo.push({ kind: 'create', id: logged.id });
      lines.push({
        name: logged.food_name_snapshot,
        detail: `${logged.quantity}${op.unit ? ` ${op.unit}` : ''}`,
        kcal: Number(logged.kcal),
      });
    }
  }

  const unmatched = pending.map((op) => {
    if (op.type === 'ADD_FOOD') return `I could not match “${op.query}”. Try a brand or grams.`;
    if (op.type === 'UPDATE_FOOD' || op.type === 'DELETE_FOOD') {
      return `I could not find “${op.target_hint ?? op.query ?? 'that food'}” on this day.`;
    }
    return `I could not apply ${op.type.replaceAll('_', ' ').toLowerCase()}.`;
  });

  return {
    memory,
    nextDate,
    lines,
    pending,
    clarifications: [...input.parsed.clarifications, ...unmatched],
    undo,
    undoIds: undo.map((action) => (action.kind === 'revise' ? action.before.id : action.id)),
    totals: calculateDailyNutrition(live()),
    needsConfirm: false,
  };
}

function resolveText(query: string, quantity: number | null | undefined, unit: string | null | undefined): string {
  const parsed = parseFoodQuery({ text: query });
  const amount = quantity ?? parsed.amount;
  const useUnit = unit ?? parsed.unit;
  return [amount && amount !== 1 ? String(amount) : null, useUnit, parsed.name || query]
    .filter(Boolean)
    .join(' ');
}

async function logCandidate(
  input: ApplyParseInput,
  op: FoodParseOperation,
  candidate: FoodCandidate,
  deps: { log: (row: LogFoodEntryInput) => Promise<LedgerEntry> },
  logicalDate: string,
): Promise<LedgerEntry | null> {
  const mealSlot = mealQueryToSlot(op.meal) ?? mealQueryToSlot(input.entries.at(-1)?.meal_slot) ?? 'meryenda';
  const row = toLogInputFromCandidate({
    userId: input.userId,
    mealSlot,
    candidate,
    servingId: persistableFoodId(candidate.foodId) ? null : null,
    timeZone: input.timeZone,
    dayStartsAt: input.dayStartsAt,
    quantityOverride: op.quantity ?? undefined,
  });
  if (!row) {
    if (!persistableFoodId(candidate.foodId)) {
      const grams = candidate.portion.grams * ((op.quantity ?? candidate.portion.amount) / (candidate.portion.amount || 1));
      const nutrients = nutrientsFromPer100g(candidate.per100g, grams);
      return deps.log({
        userId: input.userId,
        mealSlot,
        foodId: null,
        foodName: candidate.name,
        quantity: String(op.quantity ?? candidate.portion.amount),
        grams: String(grams),
        ...nutrients,
        source: asLogSource(candidate.source),
        resolvedVia: asResolvedVia(candidate.source),
        inputMethod: 'chat',
        servingLabel: candidate.portion.servingLabel,
        confidence: restaurantConfidence(op.query) ?? String(candidate.confidence),
        timeZone: input.timeZone,
        dayStartsAt: input.dayStartsAt,
        loggedAt: isoOnLogicalDate(logicalDate),
      });
    }
    return null;
  }
  return deps.log({
    ...row,
    inputMethod: 'chat',
    loggedAt: isoOnLogicalDate(logicalDate),
    confidence: restaurantConfidence(op.query) ?? row.confidence,
  });
}

function fromPersonalFood(
  input: ApplyParseInput,
  op: FoodParseOperation,
  food: PersonalFoodRecord,
  logicalDate: string,
): LogFoodEntryInput {
  const quantity = op.quantity ?? food.servingQuantity;
  const factor = food.servingQuantity > 0 ? quantity / food.servingQuantity : quantity;
  const mealSlot = mealQueryToSlot(op.meal) ?? 'almusal';
  return {
    userId: input.userId,
    mealSlot,
    foodId: null,
    foodName: food.displayName,
    quantity: String(quantity),
    grams: String(Math.max(1, quantity)),
    kcal: String(food.kcal * factor),
    protein_g: String(food.protein_g * factor),
    carbs_g: String(food.carbs_g * factor),
    fat_g: String(food.fat_g * factor),
    fiber_g: '0',
    sugar_g: '0',
    sodium_mg: '0',
    source: 'user',
    resolvedVia: 'user',
    inputMethod: 'chat',
    servingLabel: `${food.servingQuantity} ${food.servingUnit}`,
    confidence: '1',
    timeZone: input.timeZone,
    dayStartsAt: input.dayStartsAt,
    loggedAt: isoOnLogicalDate(logicalDate),
  };
}

async function copyEntries(
  op: FoodParseOperation,
  input: ApplyParseInput,
  deps: { log: (row: LogFoodEntryInput) => Promise<LedgerEntry> },
  logicalDate: string,
): Promise<LedgerEntry[]> {
  const sourceDate = op.source_date ?? shiftLogicalDate(input.logicalDate, -1);
  const meal = mealQueryToSlot(op.source_meal ?? op.meal);
  const source = input.history.filter(
    (row) =>
      !row.deleted_at &&
      row.logical_date === sourceDate &&
      (op.type === 'COPY_DAY' || !meal || row.meal_slot === meal),
  );
  const cloned: LedgerEntry[] = [];
  for (const row of source) {
    const logged = await deps.log({
      userId: input.userId,
      mealSlot: mealQueryToSlot(op.meal) ?? mealQueryToSlot(row.meal_slot) ?? 'meryenda',
      foodId: row.food_id,
      foodName: row.food_name_snapshot,
      quantity: row.quantity,
      grams: row.grams,
      kcal: row.kcal,
      protein_g: row.protein_g,
      carbs_g: row.carbs_g,
      fat_g: row.fat_g,
      fiber_g: row.fiber_g,
      sugar_g: row.sugar_g,
      sodium_mg: row.sodium_mg,
      source: asLogSource(row.source),
      resolvedVia: asResolvedVia(row.resolved_via),
      inputMethod: 'chat',
      servingLabel: row.serving_label_snapshot,
      confidence: row.confidence,
      timeZone: input.timeZone,
      dayStartsAt: input.dayStartsAt,
      loggedAt: isoOnLogicalDate(logicalDate),
    });
    input.entries.push(logged);
    cloned.push(logged);
  }
  return cloned;
}

function reviseSnapshot(target: LedgerEntry): ReviseFoodInput {
  return {
    id: target.id,
    userId: target.user_id,
    quantity: target.quantity,
    grams: target.grams,
    kcal: target.kcal,
    protein_g: target.protein_g,
    carbs_g: target.carbs_g,
    fat_g: target.fat_g,
    fiber_g: target.fiber_g,
    sugar_g: target.sugar_g,
    sodium_mg: target.sodium_mg,
  };
}

function restaurantConfidence(query: string | null | undefined): string | null {
  return RESTAURANT.test(query ?? '') ? '0.4' : null;
}

function findLedgerTarget(entries: LedgerEntry[], hint: string): LedgerEntry | null {
  const needle = hint.toLowerCase().trim();
  if (!needle) return entries[entries.length - 1] ?? null;
  const hits = entries.filter((row) => namesOverlap(row.food_name_snapshot, needle));
  return hits[hits.length - 1] ?? null;
}

function namesOverlap(name: string, hint: string): boolean {
  const left = name.toLowerCase();
  const right = hint.toLowerCase();
  if (left.includes(right) || right.includes(left)) return true;
  const stem = (value: string) => value.replace(/s$/, '');
  return stem(left) === stem(right) || left.includes(stem(right)) || right.includes(stem(left));
}

function patchEntry(target: LedgerEntry, op: FoodParseOperation) {
  const oldQty = Number(target.quantity) || 1;
  const oldGrams = Number(target.grams) || 0;
  let quantity = op.quantity ?? oldQty;
  if (op.quantity_multiplier) quantity = oldQty * op.quantity_multiplier;
  const grams = oldGrams > 0 ? (oldGrams / oldQty) * quantity : oldGrams;
  const nutrients = rescaleNutrientSnapshot(target, oldGrams || 100, grams || 100);
  return {
    id: target.id,
    userId: target.user_id,
    quantity: String(quantity),
    grams: String(grams || 1),
    ...nutrients,
  };
}

function isoOnLogicalDate(logicalDate: string): string {
  return `${logicalDate}T12:00:00.000Z`;
}
