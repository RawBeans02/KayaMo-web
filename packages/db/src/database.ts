import type { agentMemory, agentRuns } from './schema/agent';
import type { cocoConversations, cocoMessages } from './schema/coco';
import type {
  dailyLoopPreferences,
  dailyPlans,
  focusSessions,
  pushSubscriptions,
  scripturePassages,
} from './schema/daily-loop';
import type {
  foodAliases,
  foodEntries,
  foods,
  mealTemplates,
  offContributeRequests,
  recipeIngredients,
  recipes,
  servings,
} from './schema/foods';
import type {
  compasses,
  futureSelves,
  inboxItems,
  personalRules,
} from './schema/identity';
import type { musContextPermissions } from './schema/mus-context';
import type { lisCompanionProfile } from './schema/lis-companion';
import type { profiles } from './schema/profiles';
import type {
  achievementDefinitions,
  companionEvents,
  companionState,
  cosmeticDefinitions,
  cosmeticUnlocks,
  evolutionStages,
  goalMilestones,
  goals,
  habitCompletions,
  habits,
  userAchievements,
} from './schema/journey';
import type { routineCompletions, routines, tasks } from './schema/planning';
import type {
  exercises,
  workoutPlanExercises,
  workoutPlans,
  workoutSets,
  workouts,
} from './schema/training';
import type { expenditureEstimates, targets, weightLogs } from './schema/user-metrics';

type TableDef<
  T extends { $inferSelect: unknown; $inferInsert: unknown },
  Omitted extends PropertyKey = 'server_updated_at' | 'server_seq',
> = {
  Row: T['$inferSelect'];
  Insert: Omit<T['$inferInsert'], Extract<keyof T['$inferInsert'], Omitted>>;
  Update: Partial<Omit<T['$inferInsert'], Extract<keyof T['$inferInsert'], Omitted>>>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDef<typeof profiles>;
      future_selves: TableDef<typeof futureSelves>;
      compasses: TableDef<typeof compasses>;
      inbox_items: TableDef<typeof inboxItems>;
      personal_rules: TableDef<typeof personalRules>;
      mus_context_permissions: TableDef<typeof musContextPermissions>;
      lis_companion_profile: TableDef<typeof lisCompanionProfile>;
      foods: TableDef<typeof foods>;
      servings: TableDef<typeof servings>;
      food_aliases: TableDef<typeof foodAliases>;
      recipes: TableDef<typeof recipes>;
      recipe_ingredients: TableDef<typeof recipeIngredients>;
      food_entries: TableDef<
        typeof foodEntries,
        'server_updated_at' | 'server_seq' | 'logical_date'
      >;
      meal_templates: TableDef<typeof mealTemplates>;
      off_contribute_requests: TableDef<typeof offContributeRequests>;
      exercises: TableDef<typeof exercises>;
      workout_plans: TableDef<typeof workoutPlans>;
      workout_plan_exercises: TableDef<typeof workoutPlanExercises>;
      workouts: TableDef<
        typeof workouts,
        'server_updated_at' | 'server_seq' | 'logical_date'
      >;
      workout_sets: TableDef<typeof workoutSets>;
      weight_logs: TableDef<
        typeof weightLogs,
        'server_updated_at' | 'server_seq' | 'logical_date'
      >;
      expenditure_estimates: TableDef<typeof expenditureEstimates>;
      targets: TableDef<typeof targets>;
      agent_runs: TableDef<typeof agentRuns>;
      agent_memory: TableDef<typeof agentMemory>;
      coco_conversations: TableDef<typeof cocoConversations>;
      coco_messages: TableDef<typeof cocoMessages>;
      daily_plans: TableDef<typeof dailyPlans>;
      focus_sessions: TableDef<typeof focusSessions>;
      daily_loop_preferences: TableDef<typeof dailyLoopPreferences>;
      scripture_passages: TableDef<typeof scripturePassages>;
      push_subscriptions: TableDef<typeof pushSubscriptions>;
      tasks: TableDef<typeof tasks>;
      routines: TableDef<typeof routines>;
      routine_completions: TableDef<typeof routineCompletions>;
      goals: TableDef<typeof goals>;
      goal_milestones: TableDef<typeof goalMilestones>;
      habits: TableDef<typeof habits>;
      habit_completions: TableDef<typeof habitCompletions>;
      companion_events: TableDef<
        typeof companionEvents,
        'server_updated_at' | 'server_seq'
      >;
      companion_state: TableDef<typeof companionState>;
      achievement_definitions: TableDef<typeof achievementDefinitions>;
      user_achievements: TableDef<typeof userAchievements, 'server_updated_at'>;
      evolution_stages: TableDef<typeof evolutionStages>;
      cosmetic_definitions: TableDef<typeof cosmeticDefinitions>;
      cosmetic_unlocks: TableDef<typeof cosmeticUnlocks, 'server_updated_at'>;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      kayamo_logical_date: {
        Args: { p_at: string; p_tz: string | null; p_day_starts_at: string | null };
        Returns: string;
      };
      kayamo_recompute_logical_dates: {
        Args: Record<PropertyKey, never>;
        Returns: { food_entries: number; weight_logs: number; workouts: number };
      };
      kayamo_search_foods: {
        Args: { p_query: string; p_limit?: number };
        Returns: { food_id: string; similarity: number }[];
      };
      kayamo_food_log_counts: {
        Args: { p_food_ids: string[] };
        Returns: { food_id: string; times_logged: number }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Food = Database['public']['Tables']['foods']['Row'];
export type FoodInsert = Database['public']['Tables']['foods']['Insert'];
export type FoodEntry = Database['public']['Tables']['food_entries']['Row'];
export type FoodEntryInsert = Database['public']['Tables']['food_entries']['Insert'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type FutureSelf = Database['public']['Tables']['future_selves']['Row'];
export type FutureSelfInsert = Database['public']['Tables']['future_selves']['Insert'];
export type Compass = Database['public']['Tables']['compasses']['Row'];
export type CompassInsert = Database['public']['Tables']['compasses']['Insert'];
export type InboxItem = Database['public']['Tables']['inbox_items']['Row'];
export type InboxItemInsert = Database['public']['Tables']['inbox_items']['Insert'];
export type PersonalRule = Database['public']['Tables']['personal_rules']['Row'];
export type PersonalRuleInsert = Database['public']['Tables']['personal_rules']['Insert'];
export type MusContextPermission =
  Database['public']['Tables']['mus_context_permissions']['Row'];
export type LisCompanionProfile =
  Database['public']['Tables']['lis_companion_profile']['Row'];
export type LisCompanionProfileInsert =
  Database['public']['Tables']['lis_companion_profile']['Insert'];
export type WeightLog = Database['public']['Tables']['weight_logs']['Row'];
export type WeightLogInsert = Database['public']['Tables']['weight_logs']['Insert'];
export type ExpenditureEstimate =
  Database['public']['Tables']['expenditure_estimates']['Row'];
export type ExpenditureEstimateInsert =
  Database['public']['Tables']['expenditure_estimates']['Insert'];
export type NutritionTarget = Database['public']['Tables']['targets']['Row'];
export type NutritionTargetInsert = Database['public']['Tables']['targets']['Insert'];
export type Workout = Database['public']['Tables']['workouts']['Row'];
export type WorkoutInsert = Database['public']['Tables']['workouts']['Insert'];
export type WorkoutSet = Database['public']['Tables']['workout_sets']['Row'];
export type WorkoutSetInsert = Database['public']['Tables']['workout_sets']['Insert'];
export type Exercise = Database['public']['Tables']['exercises']['Row'];
export type ExerciseInsert = Database['public']['Tables']['exercises']['Insert'];
export type WorkoutPlan = Database['public']['Tables']['workout_plans']['Row'];
export type WorkoutPlanInsert = Database['public']['Tables']['workout_plans']['Insert'];
export type WorkoutPlanExercise =
  Database['public']['Tables']['workout_plan_exercises']['Row'];
export type WorkoutPlanExerciseInsert =
  Database['public']['Tables']['workout_plan_exercises']['Insert'];
export type Serving = Database['public']['Tables']['servings']['Row'];
export type ServingInsert = Database['public']['Tables']['servings']['Insert'];
export type Recipe = Database['public']['Tables']['recipes']['Row'];
export type MealTemplate = Database['public']['Tables']['meal_templates']['Row'];
export type AgentRun = Database['public']['Tables']['agent_runs']['Row'];
export type AgentMemory = Database['public']['Tables']['agent_memory']['Row'];
export type AgentMemoryInsert = Database['public']['Tables']['agent_memory']['Insert'];
export type CocoConversation = Database['public']['Tables']['coco_conversations']['Row'];
export type CocoConversationInsert =
  Database['public']['Tables']['coco_conversations']['Insert'];
export type CocoMessage = Database['public']['Tables']['coco_messages']['Row'];
export type CocoMessageInsert = Database['public']['Tables']['coco_messages']['Insert'];
export type DailyPlan = Database['public']['Tables']['daily_plans']['Row'];
export type DailyPlanInsert = Database['public']['Tables']['daily_plans']['Insert'];
export type FocusSession = Database['public']['Tables']['focus_sessions']['Row'];
export type FocusSessionInsert = Database['public']['Tables']['focus_sessions']['Insert'];
export type DailyLoopPreference =
  Database['public']['Tables']['daily_loop_preferences']['Row'];
export type DailyLoopPreferenceInsert =
  Database['public']['Tables']['daily_loop_preferences']['Insert'];
export type ScripturePassage = Database['public']['Tables']['scripture_passages']['Row'];
export type PushSubscriptionRow =
  Database['public']['Tables']['push_subscriptions']['Row'];
export type Task = Database['public']['Tables']['tasks']['Row'];
export type TaskInsert = Database['public']['Tables']['tasks']['Insert'];
export type Routine = Database['public']['Tables']['routines']['Row'];
export type RoutineInsert = Database['public']['Tables']['routines']['Insert'];
export type RoutineCompletion =
  Database['public']['Tables']['routine_completions']['Row'];
export type RoutineCompletionInsert =
  Database['public']['Tables']['routine_completions']['Insert'];
export type UserGoal = Database['public']['Tables']['goals']['Row'];
export type UserGoalInsert = Database['public']['Tables']['goals']['Insert'];
export type GoalMilestone = Database['public']['Tables']['goal_milestones']['Row'];
export type GoalMilestoneInsert =
  Database['public']['Tables']['goal_milestones']['Insert'];
export type Habit = Database['public']['Tables']['habits']['Row'];
export type HabitInsert = Database['public']['Tables']['habits']['Insert'];
export type HabitCompletion = Database['public']['Tables']['habit_completions']['Row'];
export type HabitCompletionInsert =
  Database['public']['Tables']['habit_completions']['Insert'];
export type CompanionEvent = Database['public']['Tables']['companion_events']['Row'];
export type CompanionEventInsert =
  Database['public']['Tables']['companion_events']['Insert'];
export type CompanionState = Database['public']['Tables']['companion_state']['Row'];
export type AchievementDefinitionRow =
  Database['public']['Tables']['achievement_definitions']['Row'];
export type UserAchievement = Database['public']['Tables']['user_achievements']['Row'];
export type EvolutionStage = Database['public']['Tables']['evolution_stages']['Row'];
export type CosmeticDefinition =
  Database['public']['Tables']['cosmetic_definitions']['Row'];
export type CosmeticUnlock = Database['public']['Tables']['cosmetic_unlocks']['Row'];
