import { normalizeAlias } from '@kayamo/food';

export type PersonalFoodRecord = {
  displayName: string;
  alias: string;
  servingQuantity: number;
  servingUnit: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type PersonalFoodMemory = {
  aliases: Record<string, string>;
  foods: PersonalFoodRecord[];
};

const PREFIX = 'kayamo:personal-foods:';

export function emptyPersonalFoodMemory(): PersonalFoodMemory {
  return { aliases: {}, foods: [] };
}

export function loadPersonalFoodMemory(userId: string, storage?: Storage): PersonalFoodMemory {
  const raw = storage?.getItem(`${PREFIX}${userId}`);
  if (!raw) return emptyPersonalFoodMemory();
  try {
    const parsed = JSON.parse(raw) as PersonalFoodMemory;
    return {
      aliases: parsed.aliases ?? {},
      foods: Array.isArray(parsed.foods) ? parsed.foods : [],
    };
  } catch {
    return emptyPersonalFoodMemory();
  }
}

export function savePersonalFoodMemory(
  userId: string,
  memory: PersonalFoodMemory,
  storage?: Storage,
): void {
  storage?.setItem(`${PREFIX}${userId}`, JSON.stringify(memory));
}

export function rememberPersonalFood(
  memory: PersonalFoodMemory,
  record: PersonalFoodRecord,
): PersonalFoodMemory {
  const alias = normalizeAlias(record.alias || record.displayName);
  const foods = memory.foods.filter((row) => normalizeAlias(row.alias) !== alias);
  foods.push({ ...record, alias });
  return {
    aliases: { ...memory.aliases, [alias]: record.displayName },
    foods,
  };
}

export function findPersonalFood(
  memory: PersonalFoodMemory,
  query: string,
): PersonalFoodRecord | null {
  const needle = normalizeAlias(query);
  return (
    memory.foods.find(
      (row) =>
        normalizeAlias(row.alias) === needle ||
        normalizeAlias(row.displayName) === needle ||
        needle.includes(normalizeAlias(row.alias)),
    ) ?? null
  );
}

export function statedToPersonalFood(
  query: string,
  unit: string | null | undefined,
  stated: { kcal?: number; protein_g?: number; carbs_g?: number; fat_g?: number },
): PersonalFoodRecord | null {
  if (stated.kcal === undefined) return null;
  return {
    displayName: query,
    alias: query,
    servingQuantity: 1,
    servingUnit: unit ?? 'serving',
    kcal: stated.kcal,
    protein_g: stated.protein_g ?? 0,
    carbs_g: stated.carbs_g ?? 0,
    fat_g: stated.fat_g ?? 0,
  };
}
