export const PACKAGE = '@kayamo/ai';

export {
  completeObject,
  AiBudgetError,
  AiConfigError,
  type AiTier,
  type CompleteObjectDeps,
  type GenerateObjectFn,
} from './router';
export { extractNutritionLabel, LABEL_OCR_SYSTEM } from './ocr-label';
export { createMemoryAiBudgetGate, InMemoryCocoBudgetStore } from './budget';
export type { AiBudgetGate, CocoBudgetStore, CocoUsage } from './budget';
export {
  MUS_CONTEXT_PERMISSION_DOMAINS,
  defaultMusContextPermissions,
  musContextPermissionDomainSchema,
  musContextPermissionUpdateSchema,
  musContextPermissionsFromRows,
  musContextPermissionsSchema,
} from './context-permissions';
export type {
  MusContextPermissionDomain,
  MusContextPermissions,
} from './context-permissions';
export { buildAuthorizedCocoContext } from './context-gateway';
export type {
  FaithContextProjection,
  GoalsPlanningContextProjection,
  MemoryContextProjection,
  MusContextAuthorizationAudit,
  MusContextDomainLoaders,
  PhysicalSelfContextProjection,
} from './context-gateway';
export {
  foodExtractAmbiguitySchema,
  foodExtractItemSchema,
  foodExtractSchema,
  LLM_FOOD_LOGGING_SCHEMAS,
} from './food-extract';
export type { FoodExtract, FoodExtractAmbiguity, FoodExtractItem } from './food-extract';
export { MemoryPhraseCache, normalizeFoodPhrase } from './phrase-cache';
export type { PhraseCache } from './phrase-cache';
export { formatPhSupportFooter, PH_SUPPORT_RESOURCES } from './ph-support';
export type { PhSupportResource } from './ph-support';
export { nutritionKeysInZod, FORBIDDEN_LLM_NUTRITION_KEYS } from './llm-nutrition-guard';
export {
  cocoActionNameSchema,
  cocoActionProposalSchema,
  cocoCitationSchema,
  cocoContextSnapshotSchema,
  musEntryModuleSchema,
  musEntrySchema,
  cocoModeSchema,
  cocoModelOutputSchema,
  cocoRequestSchema,
  cocoResponseSchema,
  cocoSafetyResultSchema,
  cocoToneSchema,
  cocoToolCallSchema,
  cocoToolResultSchema,
} from './contracts';
export type {
  CocoActionName,
  CocoActionProposal,
  CocoCitation,
  CocoContextSnapshot,
  MusEntry,
  MusEntryModule,
  CocoMemory,
  CocoMode,
  CocoModelOutput,
  CocoRequest,
  CocoResponse,
  CocoSafetyResult,
  CocoTone,
  CocoToolCall,
  CocoToolResult,
} from './contracts';
export { createCocoRouter } from './coco-router';
export type {
  CocoProvider,
  CocoProviderRequest,
  CocoProviderResult,
  CocoRouterConfig,
  CocoRouterResult,
  CocoTelemetryEvent,
  CocoTelemetrySink,
} from './coco-router';
export { evaluateCocoSafety } from './safety';
export { authorizeCocoToolCall } from './tools';
export type { CocoToolAuthorization } from './tools';
