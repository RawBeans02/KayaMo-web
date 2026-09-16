export type { DbClient } from './client';
export {
  DbQueryError,
  isMissingRpcError,
  isUnauthorizedError,
  isUniqueViolation,
} from './errors';
export { clampUpdatedAt, clampUpdatedAtIso, incomingWins, omitServerCursor } from './lww';
export {
  getDailyLoopPreferences,
  getDailyPlan,
  listFocusSessions,
  listScriptureByTag,
  upsertDailyLoopPreferences,
  upsertDailyPlan,
  upsertFocusSession,
  type DailyLoopPreferenceWrite,
  type DailyLoopUpsertResult,
  type DailyPlanWrite,
  type FocusSessionWrite,
} from './daily-loop';
export {
  insertFoodEntry,
  listFoodEntriesByLogicalDate,
  listFoodEntriesSince,
  tombstoneFoodEntry,
  upsertFoodEntry,
} from './food-entries';
export type { FoodEntryWrite, UpsertResult } from './food-entries';
export {
  getFood,
  getFoodBySource,
  getFoodsByBarcode,
  getFoodsByIds,
  getFoodLogCounts,
  insertCanonicalFood,
  insertFoodAliases,
  insertServings,
  insertUserFood,
  listFoodAliases,
  listFoodsBySource,
  listServings,
  listServingsByFoodIds,
  listVisibleFoods,
  queueOffContribute,
  searchFoods,
  tombstoneUserFood,
} from './foods';
export type { FoodSearchHit } from './foods';
export {
  getCompanionState,
  listAchievementDefinitions,
  listActiveHabits,
  listCompanionEvents,
  listCosmeticDefinitions,
  listCosmeticUnlocks,
  listEvolutionStages,
  listGoalMilestones,
  listGoals,
  listHabitCompletions,
  listUserAchievements,
  recordCompanionEvent,
  selectCompanionCosmetic,
  tombstoneGoal,
  tombstoneGoalMilestone,
  tombstoneHabit,
  tombstoneHabitCompletion,
  upsertGoal,
  upsertGoalMilestone,
  upsertHabit,
  upsertHabitCompletion,
  type CompanionEventWrite,
  type GoalMilestoneWrite,
  type GoalWrite,
  type HabitCompletionWrite,
  type HabitWrite,
  type JourneyUpsertResult,
} from './journey';
export {
  upsertCompass,
  upsertFutureSelf,
  upsertInboxItem,
  upsertPersonalRule,
  type CompassWrite,
  type FutureSelfWrite,
  type IdentityUpsertResult,
  type InboxItemWrite,
  type PersonalRuleWrite,
} from './identity';
export { listMusContextPermissions, setMusContextPermission } from './mus-context';
export {
  getLisCompanionProfile,
  upsertLisCompanionProfile,
  type LisCompanionProfilePatch,
} from './lis-companion';
export {
  getProfile,
  getProfileTimezone,
  recomputeLogicalDates,
  updateProfile,
} from './profiles';
export type { LogicalDateRecomputeResult } from './profiles';
export {
  insertWeightLog,
  listWeightLogsByLogicalDate,
  listWeightLogsSince,
  tombstoneWeightLog,
  upsertWeightLog,
} from './weight-logs';
export type { UpsertWeightLogResult, WeightLogWrite } from './weight-logs';
export {
  appendExpenditureEstimate,
  getLatestExpenditureEstimate,
  insertNutritionTargets,
  listEffectiveNutritionTargets,
  listExpenditureEstimates,
} from './guidance';
export type { ExpenditureEstimateWrite, NutritionTargetWrite } from './guidance';
export {
  listMealTemplates,
  mealTemplateItemSchema,
  mealTemplateWriteSchema,
  tombstoneMealTemplate,
  upsertMealTemplate,
} from './meal-templates';
export type { MealTemplateWrite, UpsertMealTemplateResult } from './meal-templates';
export {
  insertWorkout,
  listWorkoutSets,
  listWorkoutHistory,
  listWorkoutsByLogicalDate,
  tombstoneWorkout,
  tombstoneWorkoutSet,
  upsertWorkout,
  upsertWorkoutSet,
} from './workouts';
export {
  getExercise,
  listExercises,
  listWorkoutPlanExercises,
  listWorkoutPlans,
  tombstoneUserExercise,
  tombstoneWorkoutPlan,
  tombstoneWorkoutPlanExercise,
  upsertUserExercise,
  upsertWorkoutPlan,
  upsertWorkoutPlanExercise,
  type TrainingUpsertResult,
  type UserExerciseWrite,
  type WorkoutPlanExerciseWrite,
  type WorkoutPlanWrite,
} from './training-plans';
export type {
  UpsertWorkoutResult,
  UpsertWorkoutSetResult,
  WorkoutSetWrite,
  WorkoutWrite,
} from './workouts';
export {
  getAgentSpendUsd,
  insertAgentRunTelemetry,
  listAgentRuns,
  markAgentRunScrubbed,
} from './agent';
export type { AgentRunTelemetryWrite } from './agent';
export {
  listAgentMemories,
  listCocoConversations,
  listCocoMessages,
  tombstoneAgentMemory,
  tombstoneCocoConversation,
  tombstoneCocoMessage,
  upsertAgentMemory,
  upsertCocoConversation,
  upsertCocoMessage,
} from './coco';
export type {
  AgentMemoryWrite,
  CocoConversationWrite,
  CocoMessageWrite,
  CocoUpsertResult,
} from './coco';
export {
  listActiveRoutines,
  listRoutineCompletionsForDate,
  listTasksForDate,
  tombstoneRoutine,
  tombstoneRoutineCompletion,
  tombstoneTask,
  upsertRoutine,
  upsertRoutineCompletion,
  upsertTask,
} from './planning';
export type {
  PlanningUpsertResult,
  RoutineCompletionWrite,
  RoutineWrite,
  TaskWrite,
} from './planning';
