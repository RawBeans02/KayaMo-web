export const PACKAGE = '@kayamo/food';

export {
  cacheOnFirstHit,
  normalizedToFoodInsert,
  supabaseCanonicalStore,
  type CanonicalFoodStore,
} from './cache';
export {
  memoryResolveCatalog,
  phCoreToCatalog,
  type CatalogFood,
  type ResolveCatalog,
} from './catalog';
export { foodRowToCatalog, supabaseResolveCatalog } from './catalog-supabase';
export { DATA_LICENSES, OFF_ATTRIBUTION, USDA_SOURCE_NOTE } from './licenses';
export {
  dedupeKey,
  displayName,
  kjToKcal,
  looksLikeBarcode,
  mergeCandidates,
  normalizeBarcode,
  normalizeName,
  parseGramsFromText,
  perServingToPer100g,
  toGrams,
  withDefaultServings,
} from './normalize';
export { fromNumericString, toConfidenceString, toNutrientString } from './numeric';
export {
  atwaterDelta,
  atwaterKcal,
  issuesForFood,
  parsePhCoreDocument,
  validatePhCoreFoods,
  type PhCoreIssue,
  type PhCoreValidation,
} from './ph-core/validate';
export { diffPhCoreVsDb, type PhCoreFieldDiff } from './ph-core/diff';
export {
  ATWATER_TOLERANCE,
  UNVERIFIED_CONFIDENCE_MAX,
  phCoreFoodSchema,
  phCoreFileSchema,
  type PhCoreCategory,
  type PhCoreFood,
  type PhCoreFile,
} from './ph-core/schema';
export { toPhCoreFoodRow } from './ph-core/to-row';
export { resolvePortion } from './portion';
export {
  confirmConfidence,
  draftFromOcr,
  nutrientsFromLabel,
  nutritionLabelOcrSchema,
  OCR_LOW_CONFIDENCE,
  USER_FOOD_CONFIDENCE_MAX,
  userFoodConfirmSchema,
  userFoodToRows,
  type NutritionLabelOcr,
  type UserFoodConfirm,
  type UserFoodDraft,
} from './label-ocr';
export {
  parseAmountToken,
  parseFoodQuery,
  PH_UNITS,
  SIZE_MULTIPLIER,
  SIZE_WORDS,
  type FoodQuery,
  type ParsedFoodQuery,
} from './query-parse';
export {
  calorieRange,
  confidenceLevelFromSource,
  sourceTypeFromResolve,
  CONFIDENCE_LEVELS,
  type ConfidenceInput,
  type ConfidenceLevel,
} from './confidence';
export { calculateDailyNutrition, type DailyNutrition, type DailyNutritionEntry } from './daily-nutrition';
export {
  estimateEnergyBalance,
  formatKcalRange,
  type EnergyBalance,
  type EnergyBalanceInput,
} from './energy-balance';
export {
  applyAliases,
  DEFAULT_FOOD_ALIASES,
  lookupAlias,
  normalizeAlias,
} from './user-alias';
export {
  extractStatedNutrition,
  foodParseOperationSchema,
  foodParseSchema,
  mealQueryToSlot,
  parseFoodMessageHeuristic,
  FOOD_PARSE_OP_TYPES,
  type FoodParse,
  type FoodParseContext,
  type FoodParseLedgerEntry,
  type FoodParseOpType,
  type FoodParseOperation,
} from './food-parse';
export {
  createResolveQueryCache,
  resolveFood,
  shouldAutoPick,
  type FoodCandidate,
  type ResolveDeps,
  type ResolveNetwork,
} from './resolve';
export {
  affinityBoost,
  AUTO_PICK_MIN,
  LLM_CONFIDENCE_CAP,
  rankScore,
  SOURCE_PRIORITY,
  type ResolveSource,
} from './score';
export { searchExternalFoods, type SearchExternalDeps } from './search';
export { lookupOffBarcode, mapOffProduct, searchOff, type OffDeps } from './sources/off';
export { getUsdaFood, mapUsdaFood, searchUsda, type UsdaDeps } from './sources/usda';
export { HourlyLimiter, RateLimitError, noopLimiter } from './sources/limiter';
export { aliasMatchScore, bestAliasMatch, trigramSimilarity } from './trigram';
export {
  FoodSourceError,
  normalizedFoodSchema,
  type FoodServing,
  type NormalizedFood,
  type NutrientsPer100g,
  type RemoteSource,
} from './types';
