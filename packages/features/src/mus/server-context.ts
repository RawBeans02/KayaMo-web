import {
  CONTEXT_LIMITS,
  buildAuthorizedCocoContext,
  truncateWords,
  musContextPermissionsFromRows,
  type MusContextAuthorizationAudit,
} from '@kayamo/ai';
import {
  getDailyLoopPreferences,
  getLatestExpenditureEstimate,
  getProfileTimezone,
  listActiveRoutines,
  listAgentMemories,
  listEffectiveNutritionTargets,
  listFoodEntriesByLogicalDate,
  listGoals,
  getCompassForAi,
  getFutureSelfForAi,
  getLisCompanionProfile,
  listPersonalRulesForAi,
  listMusContextPermissions,
  listRoutineCompletionsForDate,
  listScriptureByTag,
  listTasksForDate,
  listWeightLogsByLogicalDate,
  listWorkoutsByLogicalDate,
  listWorkoutSets,
  type DbClient,
} from '@kayamo/db';

const LANGUAGE_REGISTERS = new Set(['english', 'taglish', 'match_me']);

/** smallint 0/1/2 -> the word each dial uses. Index is the stored value. */
const DIAL_SCALES = {
  encouragement: ['low', 'balanced', 'high'],
  accountability: ['gentle', 'balanced', 'firm'],
  humor: ['serious', 'balanced', 'playful'],
  proactivity: ['quiet', 'balanced', 'proactive'],
} as const;

export async function buildServerMusContext(input: {
  client: DbClient;
  userId: string;
  logicalDate: string;
}): Promise<Awaited<ReturnType<typeof buildAuthorizedCocoContext>>> {
  const { client, userId, logicalDate } = input;
  const timezone = await getProfileTimezone(client, userId);

  return buildAuthorizedCocoContext({
    logicalDate,
    timezone: timezone ?? 'Asia/Manila',
    readPermissions: async () =>
      musContextPermissionsFromRows(await listMusContextPermissions(client, userId)),
    readCompanionProfile: async () => {
      const row = await getLisCompanionProfile(client, userId);
      if (!row) return null;
      return {
        displayName: row.display_name?.trim() || null,
        pronouns: row.pronouns?.trim() || null,
        languageRegister: LANGUAGE_REGISTERS.has(row.language_register)
          ? (row.language_register as 'english' | 'taglish' | 'match_me')
          : 'match_me',
        dials: {
          encouragement: DIAL_SCALES.encouragement[row.encouragement] ?? 'balanced',
          accountability: DIAL_SCALES.accountability[row.accountability] ?? 'balanced',
          humor: DIAL_SCALES.humor[row.humor] ?? 'balanced',
          proactivity: DIAL_SCALES.proactivity[row.proactivity] ?? 'balanced',
        },
        aboutMe: row.about_me?.trim() || null,
        avoidTopics: row.avoid_topics.map((topic: string) => topic.trim()).filter(Boolean),
      };
    },
    loaders: {
      goals_planning: async () => {
        const weekday = new Date(`${logicalDate}T12:00:00.000Z`).getUTCDay();
        const [tasks, routines, completions, goals] = await Promise.all([
          listTasksForDate(client, { userId, logicalDate }),
          listActiveRoutines(client, { userId, weekday }),
          listRoutineCompletionsForDate(client, { userId, logicalDate }),
          listGoals(client, userId),
        ]);
        const completedRoutineIds = new Set(completions.map((row) => row.routine_id));
        const nextTask = tasks.find((row) => !row.completed_at);
        const nextRoutine = routines.find((row) => !completedRoutineIds.has(row.id));
        return {
          recommendedAction: nextTask
            ? { kind: 'task' as const, recordId: nextTask.id, title: nextTask.title }
            : nextRoutine
              ? {
                  kind: 'routine' as const,
                  recordId: nextRoutine.id,
                  title: nextRoutine.title,
                }
              : null,
          tasks: tasks.map((row) => ({
            id: row.id,
            title: row.title,
            completed: row.completed_at !== null,
            dueAt: row.due_at,
          })),
          routines: routines.map((row) => ({
            id: row.id,
            title: row.title,
            completed: completedRoutineIds.has(row.id),
          })),
          goals: goals.map((goal) => ({
            id: goal.id,
            title: goal.title,
            status:
              goal.status === 'completed' || goal.status === 'paused'
                ? goal.status
                : ('active' as const),
            kind:
              goal.kind === 'campaign' || goal.kind === 'chapter'
                ? goal.kind
                : ('goal' as const),
          })),
        };
      },
      physical_self: async () => {
        const [foodEntries, weightLogs, workouts, targets, expenditure] =
          await Promise.all([
            listFoodEntriesByLogicalDate(client, { userId, logicalDate }),
            listWeightLogsByLogicalDate(client, { userId, logicalDate }),
            listWorkoutsByLogicalDate(client, { userId, logicalDate }),
            listEffectiveNutritionTargets(client, { userId, date: logicalDate }),
            getLatestExpenditureEstimate(client, { userId, throughDate: logicalDate }),
          ]);
        const workoutSets = await Promise.all(
          workouts.map((workout) => listWorkoutSets(client, workout.id)),
        );
        const guidanceDayType = workouts.length > 0 ? 'training' : 'rest';
        const nutritionTarget = targets.find((row) => row.day_type === guidanceDayType);
        const loggedKcal = foodEntries.reduce((sum, row) => sum + Number(row.kcal), 0);
        const loggedProteinG = foodEntries.reduce(
          (sum, row) => sum + Number(row.protein_g),
          0,
        );
        return {
          recommendedAction:
            foodEntries.length === 0
              ? {
                  kind: 'food' as const,
                  recordId: null,
                  title: 'Log your first meal',
                }
              : null,
          health: {
            mealsLogged: foodEntries.length,
            weightLogged: weightLogs.length > 0,
            workoutStatus:
              workouts.length === 0
                ? 'none'
                : workouts.some((row) => row.ended_at === null)
                  ? 'active'
                  : 'completed',
            confirmedWorkouts: workouts.map((workout, index) => {
              const sets = workoutSets[index] ?? [];
              const bestE1rmKg = sets.reduce<number | null>((best, set) => {
                const estimates = [set.e1rm_epley_kg, set.e1rm_brzycki_kg]
                  .filter((value): value is string => value !== null)
                  .map(Number)
                  .filter(Number.isFinite);
                const current = estimates.length
                  ? estimates.reduce((sum, value) => sum + value, 0) / estimates.length
                  : null;
                return current === null ? best : Math.max(best ?? current, current);
              }, null);
              return {
                id: workout.id,
                status:
                  workout.status === 'completed' || workout.status === 'abandoned'
                    ? workout.status
                    : ('active' as const),
                startedAt: workout.started_at,
                endedAt: workout.ended_at,
                setsCompleted: sets.filter((set) => set.completed_at !== null).length,
                exerciseNames: [
                  ...new Set(sets.map((set) => set.exercise_name_snapshot)),
                ],
                bestE1rmKg,
                isDeload: workout.is_deload,
              };
            }),
            nutritionGuidance:
              nutritionTarget && expenditure
                ? {
                    targetId: nutritionTarget.id,
                    expenditureId: expenditure.id,
                    targetKcal: Number(nutritionTarget.kcal),
                    targetProteinG: Number(nutritionTarget.protein_g),
                    loggedKcal,
                    loggedProteinG,
                    source: 'target_engine' as const,
                    confidence: Number(nutritionTarget.confidence),
                  }
                : null,
          },
        };
      },
      memory: async () => ({
        memories: (await listAgentMemories(client, userId)).map((row) => ({
          id: row.id,
          kind: row.kind,
          content: row.content,
        })),
      }),
      identity: async () => {
        // Every read here filters on mus_may_read. RLS cannot do it: the user
        // owns these rows, so ownership alone would grant the server access.
        // inbox_items is deliberately absent — unreviewed capture, and the
        // highest-risk injection surface in the schema.
        const [futureSelf, compass, rules] = await Promise.all([
          getFutureSelfForAi(client, userId),
          getCompassForAi(client, userId),
          listPersonalRulesForAi(client, userId, CONTEXT_LIMITS.personalRules),
        ]);
        const trim = (value: string | null, max: number) =>
          value?.trim() ? truncateWords(value.trim(), max) : null;
        return {
          identity: {
            futureSelf: futureSelf?.statement?.trim()
              ? {
                  id: 'self' as const,
                  statement: truncateWords(
                    futureSelf.statement.trim(),
                    CONTEXT_LIMITS.futureSelfChars,
                  ),
                }
              : null,
            compass: compass
              ? {
                  id: 'self' as const,
                  mattersNow: trim(compass.matters_now, CONTEXT_LIMITS.compassFieldChars),
                  protect: trim(compass.protect, CONTEXT_LIMITS.compassFieldChars),
                  strugglingWith: trim(
                    compass.struggling_with,
                    CONTEXT_LIMITS.compassFieldChars,
                  ),
                  doNotBecome: trim(compass.do_not_become, CONTEXT_LIMITS.compassFieldChars),
                  activeAreas: (compass.active_areas ?? []).slice(0, 8),
                }
              : null,
            rules: rules.map((rule) => ({
              id: rule.id,
              title: truncateWords(rule.title.trim(), 120),
            })),
          },
        };
      },

      faith: async () => {
        const preferences = await getDailyLoopPreferences(client, userId);
        if (preferences?.faith_enabled !== true) return { scripture: [] };
        const scripture = await listScriptureByTag(client, {
          faithEnabled: true,
          limit: 10,
        });
        return {
          scripture: scripture.map((passage) => ({
            id: passage.id,
            reference: passage.reference,
            text: passage.text,
            translation: 'engwebp' as const,
            sourceUrl: passage.source_url,
            tags: passage.tags,
          })),
        };
      },
    },
  });
}

export type { MusContextAuthorizationAudit };
