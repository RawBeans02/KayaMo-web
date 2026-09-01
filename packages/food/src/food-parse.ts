import { z } from 'zod';
import { asMealSlot, shiftLogicalDate, type MealSlot } from './meal-slot';
import { parseAmountToken, parseFoodQuery } from './query-parse';
import { applyAliases } from './user-alias';

export const FOOD_PARSE_OP_TYPES = [
  'ADD_FOOD',
  'UPDATE_FOOD',
  'DELETE_FOOD',
  'COPY_MEAL',
  'COPY_DAY',
  'START_NEW_DAY',
  'SAVE_PERSONAL_FOOD',
] as const;

export type FoodParseOpType = (typeof FOOD_PARSE_OP_TYPES)[number];

export const foodParseOperationSchema = z.object({
  type: z.enum(FOOD_PARSE_OP_TYPES),
  meal: z.string().nullable().optional(),
  query: z.string().nullable().optional(),
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  preparation: z.string().nullable().optional(),
  target_hint: z.string().nullable().optional(),
  source_date: z.string().nullable().optional(),
  source_meal: z.string().nullable().optional(),
  quantity_multiplier: z.number().nullable().optional(),
});

export const foodParseSchema = z.object({
  operations: z.array(foodParseOperationSchema),
  clarifications: z.array(z.string()).max(5),
});

export type FoodParseOperation = z.infer<typeof foodParseOperationSchema>;
export type FoodParse = z.infer<typeof foodParseSchema>;

export type FoodParseLedgerEntry = {
  id: string;
  displayName: string;
  mealSlot: string;
  quantity: number;
  unit?: string | null;
};

export type FoodParseContext = {
  logicalDate: string;
  entries: readonly FoodParseLedgerEntry[];
  aliases?: Readonly<Record<string, string>>;
};

const MEAL_WORDS: Record<string, MealSlot> = {
  breakfast: 'almusal',
  almusal: 'almusal',
  lunch: 'tanghalian',
  tanghalian: 'tanghalian',
  dinner: 'hapunan',
  hapunan: 'hapunan',
  snack: 'meryenda',
  meryenda: 'meryenda',
  merienda: 'meryenda',
  drink: 'meryenda',
  'pre-workout': 'meryenda',
  'pre workout': 'meryenda',
  'post-workout': 'meryenda',
  'post workout': 'meryenda',
};

const PREP_PATTERN =
  /\b(air[-\s]?fried|airfried|fried|boiled|roasted|grilled|with skin|no skin|with oil|no oil|sauce included|sauce excluded)\b/i;

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

const EMPTY: FoodParse = { operations: [], clarifications: [] };

export function mealQueryToSlot(meal: string | null | undefined): MealSlot | null {
  if (!meal) return null;
  const keyed = MEAL_WORDS[meal.trim().toLowerCase()];
  if (keyed) return keyed;
  return asMealSlot(meal);
}

export function parseFoodMessageHeuristic(message: string, context: FoodParseContext): FoodParse {
  const text = message.trim();
  if (!text) return EMPTY;
  const aliases = context.aliases ?? {};

  const newDay = parseNewDay(text);
  if (newDay) return newDay;

  const teach = parseTeach(text, aliases);
  if (teach) return teach;

  const copy = parseCopy(text, context);
  if (copy) return copy;

  const removal = parseRemoval(text);
  if (removal) return removal;

  const correction = parseCorrection(text, context);
  if (correction) return correction;

  return parseAdditions(text, aliases);
}

export function extractStatedNutrition(message: string): {
  kcal?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
} | null {
  const kcal = message.match(/(\d+(?:\.\d+)?)\s*(?:kcal|calories?)\b/i);
  const protein = message.match(/(\d+(?:\.\d+)?)\s*g(?:rams?)?\s*protein\b/i)
    ?? message.match(/protein[^\d]{0,12}(\d+(?:\.\d+)?)\s*g/i);
  const carbs = message.match(/(\d+(?:\.\d+)?)\s*g(?:rams?)?\s*carb/i);
  const fat = message.match(/(\d+(?:\.\d+)?)\s*g(?:rams?)?\s*fat\b/i);
  if (!kcal && !protein && !carbs && !fat) return null;
  return {
    ...(kcal ? { kcal: Number(kcal[1]) } : {}),
    ...(protein ? { protein_g: Number(protein[1]) } : {}),
    ...(carbs ? { carbs_g: Number(carbs[1]) } : {}),
    ...(fat ? { fat_g: Number(fat[1]) } : {}),
  };
}

function parseNewDay(text: string): FoodParse | null {
  if (/^(new day|reset today'?s counter|another day|start a new day)\.?$/i.test(text)) {
    return { operations: [{ type: 'START_NEW_DAY' }], clarifications: [] };
  }
  return null;
}

function parseTeach(text: string, aliases: Readonly<Record<string, string>>): FoodParse | null {
  const stated = extractStatedNutrition(text);
  if (!stated?.kcal) return null;
  if (!/remember|save this|per (scoop|slice|serving)|actually \d/i.test(text)) {
    if (!/calories?.{0,24}protein|protein.{0,24}calories?/i.test(text)) return null;
  }
  const name = teachName(text);
  const serving = text.match(/\bper\s+(scoop|slice|serving|tbsp|piece|pc)\b/i);
  return {
    operations: [
      {
        type: 'SAVE_PERSONAL_FOOD',
        query: applyAliases(name, aliases),
        quantity: 1,
        unit: serving?.[1]?.toLowerCase() ?? 'serving',
      },
    ],
    clarifications: [],
  };
}

function teachName(text: string): string {
  const named = text.match(/^(?:this\s+)?(.+?)\s+is\s+\d/i);
  if (named?.[1]) return named[1].replace(/^(my|the)\s+/i, '').trim();
  const bread = text.match(/update\s+(.+?)(?:\?|$)/i);
  if (bread?.[1]) return bread[1].trim();
  return text.split(/\s+is\s+|\s+was\s+/)[0]?.trim() || text;
}

function parseRemoval(text: string): FoodParse | null {
  const match = text.match(/^(?:remove|delete|drop)\s+(?:the\s+)?(.+?)\.?$/i);
  if (!match?.[1]) return null;
  return {
    operations: [{ type: 'DELETE_FOOD', target_hint: match[1].replace(/\.$/, '').trim() }],
    clarifications: [],
  };
}

function parseCorrection(text: string, context: FoodParseContext): FoodParse | null {
  const half = text.match(/^i only ate half (?:of )?(?:the )?(.+?)\.?$/i);
  if (half?.[1]) {
    return {
      operations: [{ type: 'UPDATE_FOOD', target_hint: half[1].trim(), quantity_multiplier: 0.5 }],
      clarifications: [],
    };
  }

  const looksLikeCorrection =
    /^(actually|make (?:it|the)|change)\b/i.test(text) ||
    /\bwas\s+\d/i.test(text) ||
    /\b(?:make|change)\s+the\b/i.test(text);
  if (!looksLikeCorrection) return null;

  const qty = text.match(
    /(\d+\/\d+|\d+(?:\.\d+)?|½|half)\s*(g|kg|ml|oz|fl oz|tbsp|tsp|slice|slices|pc|pcs|piece|scoop|cup)?\b/i,
  );
  const hint =
    text
      .replace(/^(actually|make (?:it|the)|change)\s+/i, '')
      .replace(/\b(was|to|at)\b.+$/i, '')
      .replace(/^(the|that)\s+/i, '')
      .trim() || recentName(context);

  if (!hint) {
    return {
      operations: [],
      clarifications: ['Which food should I update?'],
    };
  }

  const matches = findTargets(context, hint);
  if (matches.length > 1) {
    return {
      operations: [],
      clarifications: [`I see more than one ${hint}. Which one?`],
    };
  }

  const amount = qty ? parseAmountToken(qty[1]) : null;
  const unit = qty?.[2]?.toLowerCase() ?? null;
  return {
    operations: [
      {
        type: 'UPDATE_FOOD',
        target_hint: hint,
        quantity: amount,
        unit,
      },
    ],
    clarifications: [],
  };
}

function parseCopy(text: string, context: FoodParseContext): FoodParse | null {
  const lower = text.toLowerCase();
  if (!/\b(same|copy|repeat|usual)\b/.test(lower)) return null;

  if (/repeat this meal tomorrow/.test(lower)) {
    return {
      operations: [
        {
          type: 'COPY_MEAL',
          source_date: context.logicalDate,
          source_meal: recentMeal(context),
          meal: recentMeal(context),
        },
      ],
      clarifications: [],
    };
  }

  const mealHit = Object.keys(MEAL_WORDS).find((word) => lower.includes(word));
  const meal = mealHit ? MEAL_WORDS[mealHit] : null;
  let sourceDate: string | null = null;
  if (/\byesterday\b/.test(lower)) sourceDate = shiftLogicalDate(context.logicalDate, -1);
  const weekday = WEEKDAYS.find((day) => lower.includes(day));
  if (weekday) sourceDate = mostRecentWeekday(context.logicalDate, weekday);
  if (/usual/.test(lower) && meal) sourceDate = shiftLogicalDate(context.logicalDate, -1);
  if (!sourceDate) sourceDate = shiftLogicalDate(context.logicalDate, -1);

  if (!meal) {
    if (/\b(copy yesterday|same as yesterday|repeat yesterday|copy the day|copy day)\b/.test(lower)) {
      return {
        operations: [{ type: 'COPY_DAY', source_date: sourceDate }],
        clarifications: [],
      };
    }
    return null;
  }

  const operations: FoodParseOperation[] = [
    {
      type: 'COPY_MEAL',
      source_date: sourceDate,
      source_meal: meal,
      meal,
    },
  ];

  const noItem = text.match(/\bbut no ([a-z0-9][\w'’\- ]+)/i);
  if (noItem?.[1]) {
    operations.push({ type: 'DELETE_FOOD', target_hint: noItem[1].trim() });
  }

  const butQty = text.match(/\bbut\s+(\d+\/\d+|\d+|two|one|three)\s+([a-z][\w'’\- ]+)/i);
  if (butQty?.[1] && butQty[2] && !/^no\b/i.test(butQty[2])) {
    operations.push({
      type: 'UPDATE_FOOD',
      target_hint: butQty[2].trim(),
      quantity: parseAmountToken(butQty[1]),
    });
  }

  return { operations, clarifications: [] };
}

function parseAdditions(text: string, aliases: Readonly<Record<string, string>>): FoodParse {
  const operations: FoodParseOperation[] = [];
  const clarifications: string[] = [];
  let meal: string | null = null;
  const clauses = splitClauses(text);

  for (const clause of clauses) {
    const mealLead = clause.match(
      /^(breakfast|lunch|dinner|snack|almusal|tanghalian|hapunan|meryenda|merienda)\s*(?:is|:)?\s*(.*)$/i,
    );
    let body = clause;
    if (mealLead) {
      meal = mealLead[1] ?? meal;
      body = (mealLead[2] ?? '').trim();
    }
    if (!body) continue;

    for (const item of splitFoodItems(body)) {
      const prep = readPreparation(item);
      const cleaned = item.replace(PREP_PATTERN, '').replace(/\s+/g, ' ').trim();
      const parsed = parseFoodQuery({ text: cleaned });
      if (!parsed.name) continue;
      operations.push({
        type: 'ADD_FOOD',
        meal,
        query: applyAliases(parsed.name, aliases),
        quantity: parsed.amount,
        unit: parsed.unit ?? null,
        preparation: prep,
      });
    }
  }

  return { operations, clarifications };
}

function splitClauses(text: string): string[] {
  return text
    .split(/[.;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function splitFoodItems(clause: string): string[] {
  const parts = clause
    .split(/,(?![^(]*\))/)
    .map((part) => part.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const part of parts) {
    const meat = part.match(/^about\s+(\d+(?:\.\d+)?)\s*(g|grams?)\s+of\s+meat$/i);
    const prev = out[out.length - 1];
    if (meat && prev && /\b(mackerel|fish|chicken|tuna|salmon|bangus)\b/i.test(prev)) {
      const name = prev
        .replace(/^(?:\d+\/\d+|\d+(?:\.\d+)?|one|two|a|an)\s+(?:small|malaki|maliit)?\s*/i, '')
        .trim();
      out[out.length - 1] = `${meat[1]} ${meat[2]} ${name}`;
      continue;
    }
    const shared = part.match(
      /^((?:\d+\/\d+|\d+(?:\.\d+)?|½|half|one|two|a)\s+(?:tbsp|tsp|slice|slices|pc|pcs|piece|scoop|cup|g)\s+)(.+)$/i,
    );
    if (shared?.[1] && shared[2] && /\band\b/i.test(shared[2]) && !/\band\s+(?:\d+|one|two|a)\b/i.test(shared[2])) {
      const names = shared[2].split(/\band\b/i).map((name) => name.trim()).filter(Boolean);
      for (const name of names) out.push(`${shared[1]}${name}`);
      continue;
    }
    if (/\band\s+(?:\d+|one|two|a)\b/i.test(part)) {
      out.push(...part.split(/\band\b/i).map((item) => item.trim()).filter(Boolean));
      continue;
    }
    out.push(part);
  }
  return out;
}

function readPreparation(text: string): string | null {
  const match = text.match(PREP_PATTERN);
  if (!match?.[1]) return null;
  return match[1].toLowerCase().replace(/airfried|air-fried/g, 'air fried');
}

function findTargets(context: FoodParseContext, hint: string): FoodParseLedgerEntry[] {
  const needle = hint.toLowerCase();
  return context.entries.filter((row) => row.displayName.toLowerCase().includes(needle) || needle.includes(row.displayName.toLowerCase()));
}

function recentName(context: FoodParseContext): string | null {
  return context.entries[context.entries.length - 1]?.displayName ?? null;
}

function recentMeal(context: FoodParseContext): string | null {
  return context.entries[context.entries.length - 1]?.mealSlot ?? null;
}

function mostRecentWeekday(today: string, weekday: string): string {
  const want = WEEKDAYS.indexOf(weekday as (typeof WEEKDAYS)[number]);
  for (let back = 1; back <= 7; back += 1) {
    const date = shiftLogicalDate(today, -back);
    const [year, month, day] = date.split('-').map(Number);
    const found = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1)).getUTCDay();
    if (found === want) return date;
  }
  return shiftLogicalDate(today, -1);
}
