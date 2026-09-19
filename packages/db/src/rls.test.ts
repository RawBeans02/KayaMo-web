import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from './database';
import { isDbTestConfigured } from './env';
import {
  insertFoodEntry,
  listFoodEntriesByLogicalDate,
  upsertFoodEntry,
} from './queries/food-entries';
import { recomputeLogicalDates } from './queries/profiles';
import {
  appendExpenditureEstimate,
  insertNutritionTargets,
  listEffectiveNutritionTargets,
  listExpenditureEstimates,
} from './queries/guidance';
import {
  listActiveRoutines,
  listRoutineCompletionsForDate,
  listTasksForDate,
  upsertRoutine,
  upsertRoutineCompletion,
  upsertTask,
} from './queries/planning';
import {
  listAgentMemories,
  listCocoConversations,
  listCocoMessages,
  upsertAgentMemory,
  upsertCocoConversation,
  upsertCocoMessage,
} from './queries/coco';
import { listWorkoutPlans, upsertWorkoutPlan } from './queries/training-plans';
import {
  insertWorkout,
  listWorkoutSets,
  upsertWorkout,
  upsertWorkoutSet,
} from './queries/workouts';
import {
  getCompanionState,
  listActiveHabits,
  listCompanionEvents,
  listGoals,
  listUserAchievements,
  recordCompanionEvent,
  upsertGoal,
  upsertHabit,
} from './queries/journey';
import {
  getDailyLoopPreferences,
  getDailyPlan,
  listFocusSessions,
  listScriptureByTag,
  upsertDailyLoopPreferences,
  upsertDailyPlan,
  upsertFocusSession,
} from './queries/daily-loop';
import {
  listMusContextPermissions,
  setMusContextPermission,
} from './queries/mus-context';

const configured = isDbTestConfigured();

type Authed = {
  id: string;
  email: string;
  client: SupabaseClient<Database>;
};

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('Missing Supabase env for RLS tests.');
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const describeWithDatabase = configured ? describe : describe.skip;

describeWithDatabase('RLS and tombstones', () => {
  const runId = randomUUID();
  const password = `${randomUUID()}Aa1!`;
  let service: ReturnType<typeof createServiceClient>;
  let userA: Authed;
  let userB: Authed;
  let anon: SupabaseClient<Database>;
  let foodId: string;
  let exerciseId: string;

  beforeAll(async () => {
    // Vitest still evaluates suite hooks for a conditionally skipped suite.
    if (!configured) return;
    service = createServiceClient();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
    anon = createClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    userA = await createAuthedUser(
      service,
      url,
      anonKey,
      `ch04-a-${runId}@kayamo.test`,
      password,
    );
    userB = await createAuthedUser(
      service,
      url,
      anonKey,
      `ch04-b-${runId}@kayamo.test`,
      password,
    );

    foodId = randomUUID();
    const { error } = await service.from('foods').insert({
      id: foodId,
      source: 'ph_core',
      source_id: `rls-${runId}`,
      name: 'RLS fixture food',
      kcal: '100',
      protein_g: '1',
      carbs_g: '1',
      fat_g: '1',
      fiber_g: '0',
      sugar_g: '0',
      sodium_mg: '0',
      confidence: '0.50',
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;

    exerciseId = randomUUID();
    const { error: exerciseError } = await service.from('exercises').insert({
      id: exerciseId,
      source: 'canonical',
      name: 'RLS fixture squat',
      muscles: ['quadriceps'],
      default_rep_min: 5,
      default_rep_max: 8,
      updated_at: new Date().toISOString(),
    });
    if (exerciseError) throw exerciseError;
  });

  afterAll(async () => {
    if (!service) return;
    if (foodId) {
      await service.from('food_entries').delete().eq('food_id', foodId);
      await service.from('foods').delete().eq('id', foodId);
    }
    if (userA) await service.auth.admin.deleteUser(userA.id);
    if (userB) await service.auth.admin.deleteUser(userB.id);
    if (exerciseId) await service.from('exercises').delete().eq('id', exerciseId);
  });

  it('blocks user B from reading user A food_entries', async () => {
    const entryId = randomUUID();
    const loggedAt = '2026-08-16T04:00:00.000Z';
    await insertFoodEntry(userA.client, {
      id: entryId,
      user_id: userA.id,
      logged_at: loggedAt,
      meal_slot: 'tanghalian',
      food_id: foodId,
      quantity: '1',
      grams: '100',
      kcal: '100',
      protein_g: '1',
      carbs_g: '1',
      fat_g: '1',
      fiber_g: '0',
      sugar_g: '0',
      sodium_mg: '0',
      source: 'ph_core',
      confidence: '0.50',
      input_method: 'search',
      food_name_snapshot: 'RLS fixture food',
      serving_label_snapshot: '100 g',
      resolved_via: 'ph_core',
      updated_at: loggedAt,
    });

    const asOwner = await listFoodEntriesByLogicalDate(userA.client, {
      userId: userA.id,
      logicalDate: '2026-08-16',
    });
    expect(asOwner.some((row) => row.id === entryId)).toBe(true);

    const asOther = await listFoodEntriesByLogicalDate(userB.client, {
      userId: userA.id,
      logicalDate: '2026-08-16',
    });
    expect(asOther).toEqual([]);

    const { data: byId } = await userB.client
      .from('food_entries')
      .select('id')
      .eq('id', entryId);
    expect(byId ?? []).toEqual([]);
  });

  it('blocks user B from reading or mutating user A tasks', async () => {
    const taskId = randomUUID();
    const updatedAt = '2026-08-22T06:00:00.000Z';
    const inserted = await upsertTask(userA.client, {
      id: taskId,
      user_id: userA.id,
      title: 'Private task',
      notes: null,
      scheduled_for: '2026-08-22',
      due_at: null,
      completed_at: null,
      sort_order: 0,
      origin: 'user',
      updated_at: updatedAt,
      deleted_at: null,
    });
    expect(inserted.applied).toBe(true);

    const ownerRows = await listTasksForDate(userA.client, {
      userId: userA.id,
      logicalDate: '2026-08-22',
    });
    expect(ownerRows.some((row) => row.id === taskId)).toBe(true);

    const otherRows = await listTasksForDate(userB.client, {
      userId: userA.id,
      logicalDate: '2026-08-22',
    });
    expect(otherRows).toEqual([]);

    const { data, error } = await userB.client
      .from('tasks')
      .update({ title: 'Stolen', updated_at: '2026-08-22T07:00:00.000Z' })
      .eq('id', taskId)
      .select('id');
    if (error) throw error;
    expect(data).toEqual([]);
  });

  it('lets a user scrub their own agent run but never rewrite its cost', async () => {
    // Migration 0023. The per-user AI budget reads cost_usd from this table, and
    // the row-scoped update policy alone let a user zero it through PostgREST.
    const runId = randomUUID();
    const now = new Date().toISOString();
    const { error: insertError } = await userA.client.from('agent_runs').insert({
      id: runId,
      user_id: userA.id,
      agent: 'rls_fixture',
      trigger: 'rls_test',
      input: {},
      output: {},
      model: 'test-model',
      tokens: 10,
      cost_usd: '0.010000',
      status: 'model',
      logical_date: '2026-08-22',
      updated_at: now,
    });
    if (insertError) throw insertError;

    const zeroed = await userA.client
      .from('agent_runs')
      .update({ cost_usd: '0', updated_at: now })
      .eq('id', runId)
      .select('id');
    // 42501 is insufficient_privilege: the column grant, not the row policy.
    expect(zeroed.error?.code).toBe('42501');

    const scrubbed = await userA.client
      .from('agent_runs')
      .update({ scrubbed_at: now })
      .eq('id', runId)
      .select('id');
    if (scrubbed.error) throw scrubbed.error;
    expect(scrubbed.data).toHaveLength(1);

    const { data: kept, error: readError } = await service
      .from('agent_runs')
      .select('cost_usd, scrubbed_at')
      .eq('id', runId)
      .single();
    if (readError) throw readError;
    expect(Number(kept.cost_usd)).toBeCloseTo(0.01);
    expect(kept.scrubbed_at).not.toBeNull();
  });

  it('isolates daily plans, focus sessions, and daily-loop preferences', async () => {
    const at = '2026-08-22T06:00:00.000Z';
    const planId = randomUUID();
    const focusId = randomUUID();
    expect((await upsertDailyPlan(userA.client, {
      id: planId, user_id: userA.id, logical_date: '2026-08-22',
      selected_action_kind: 'custom', selected_record_id: null,
      selected_label_snapshot: 'Private next action', morning_completed_at: at,
      evening_completed_at: null, updated_at: at, deleted_at: null,
    })).applied).toBe(true);
    expect((await upsertFocusSession(userA.client, {
      id: focusId, user_id: userA.id, daily_plan_id: planId,
      logical_date: '2026-08-22', target_kind: 'custom', target_record_id: null,
      target_label_snapshot: 'Private next action', planned_minutes: 25,
      status: 'scheduled', started_at: null, ends_at: null, completed_at: null,
      cancelled_at: null, updated_at: at, deleted_at: null,
    })).applied).toBe(true);
    expect((await upsertDailyLoopPreferences(userA.client, {
      user_id: userA.id, notifications_enabled: true,
      morning_reminder_at: '08:00:00', evening_reminder_at: '20:00:00',
      quiet_starts_at: '22:00:00', quiet_ends_at: '07:00:00',
      faith_enabled: true, updated_at: at, deleted_at: null,
    })).applied).toBe(true);

    expect(await getDailyPlan(userB.client, { userId: userA.id, logicalDate: '2026-08-22' })).toBeNull();
    expect(await listFocusSessions(userB.client, { userId: userA.id, logicalDate: '2026-08-22' })).toEqual([]);
    expect(await getDailyLoopPreferences(userB.client, userA.id)).toBeNull();

    const mutation = await userB.client.from('daily_plans')
      .update({ selected_label_snapshot: 'Stolen', updated_at: '2026-08-22T07:00:00.000Z' })
      .eq('id', planId).select('id');
    if (mutation.error) throw mutation.error;
    expect(mutation.data).toEqual([]);
  });

  it('keeps Scripture authenticated-only and query-gated by faith opt-in', async () => {
    const { data: anonRows, error: anonError } = await anon
      .from('scripture_passages').select('id');
    expect(anonRows ?? []).toEqual([]);
    expect(anonError).toBeTruthy();
    expect(await listScriptureByTag(userA.client, { faithEnabled: false, tag: 'hope' })).toEqual([]);
    expect((await listScriptureByTag(userA.client, { faithEnabled: true, tag: 'hope' })).length).toBeGreaterThan(0);
  });

  it('isolates web-push subscriptions by owner', async () => {
    const endpoint = `https://push.example.test/${randomUUID()}`;
    const { error: insertError } = await userA.client.from('push_subscriptions').insert({
      user_id: userA.id, endpoint, p256dh: 'public-key', auth: 'auth-secret',
      expires_at: null, updated_at: new Date().toISOString(),
    });
    if (insertError) throw insertError;
    const other = await userB.client.from('push_subscriptions').select('id')
      .eq('user_id', userA.id);
    if (other.error) throw other.error;
    expect(other.data).toEqual([]);
    const deleted = await userB.client.from('push_subscriptions').delete()
      .eq('endpoint', endpoint).select('id');
    if (deleted.error) throw deleted.error;
    expect(deleted.data).toEqual([]);
  });

  it('isolates routines and routine completions by owner', async () => {
    const routineId = randomUUID();
    const completionId = randomUUID();
    const updatedAt = '2026-08-22T06:00:00.000Z';
    const routine = await upsertRoutine(userA.client, {
      id: routineId,
      user_id: userA.id,
      title: 'Private routine',
      notes: null,
      schedule_days: [6],
      preferred_time: '07:00:00',
      active: true,
      sort_order: 0,
      updated_at: updatedAt,
      deleted_at: null,
    });
    expect(routine.applied).toBe(true);
    const completion = await upsertRoutineCompletion(userA.client, {
      id: completionId,
      user_id: userA.id,
      routine_id: routineId,
      logical_date: '2026-08-22',
      completed_at: updatedAt,
      updated_at: updatedAt,
      deleted_at: null,
    });
    expect(completion.applied).toBe(true);

    const ownerRoutines = await listActiveRoutines(userA.client, {
      userId: userA.id,
      weekday: 6,
    });
    expect(ownerRoutines.some((row) => row.id === routineId)).toBe(true);
    const ownerCompletions = await listRoutineCompletionsForDate(userA.client, {
      userId: userA.id,
      logicalDate: '2026-08-22',
    });
    expect(ownerCompletions.some((row) => row.id === completionId)).toBe(true);

    expect(
      await listActiveRoutines(userB.client, { userId: userA.id, weekday: 6 }),
    ).toEqual([]);
    expect(
      await listRoutineCompletionsForDate(userB.client, {
        userId: userA.id,
        logicalDate: '2026-08-22',
      }),
    ).toEqual([]);

    const { data: routineMutation, error: routineError } = await userB.client
      .from('routines')
      .update({ title: 'Stolen', updated_at: '2026-08-22T07:00:00.000Z' })
      .eq('id', routineId)
      .select('id');
    if (routineError) throw routineError;
    expect(routineMutation).toEqual([]);

    const { data: completionMutation, error: completionError } = await userB.client
      .from('routine_completions')
      .update({
        completed_at: '2026-08-22T07:00:00.000Z',
        updated_at: '2026-08-22T07:00:00.000Z',
      })
      .eq('id', completionId)
      .select('id');
    if (completionError) throw completionError;
    expect(completionMutation).toEqual([]);
  });

  it('isolates Coco conversations, messages, and explicit memories by owner', async () => {
    const conversationId = randomUUID();
    const messageId = randomUUID();
    const memoryId = randomUUID();
    const updatedAt = '2026-08-22T08:00:00.000Z';
    expect(
      (
        await upsertCocoConversation(userA.client, {
          id: conversationId,
          user_id: userA.id,
          title: 'Private Coco chat',
          updated_at: updatedAt,
          deleted_at: null,
        })
      ).applied,
    ).toBe(true);
    expect(
      (
        await upsertCocoMessage(userA.client, {
          id: messageId,
          user_id: userA.id,
          conversation_id: conversationId,
          role: 'user',
          content: 'Private ordinary chat message',
          response_source: null,
          updated_at: updatedAt,
          deleted_at: null,
        })
      ).applied,
    ).toBe(true);
    expect(
      (
        await upsertAgentMemory(userA.client, {
          id: memoryId,
          user_id: userA.id,
          kind: 'preference',
          content: 'I prefer quiet mornings.',
          embedding: null,
          embedding_model: 'none',
          explicit: true,
          updated_at: updatedAt,
          deleted_at: null,
        })
      ).applied,
    ).toBe(true);

    expect(await listCocoConversations(userB.client, userA.id)).toEqual([]);
    expect(
      await listCocoMessages(userB.client, {
        userId: userA.id,
        conversationId,
      }),
    ).toEqual([]);
    expect(await listAgentMemories(userB.client, userA.id)).toEqual([]);

    const { data: conversationMutation, error: conversationError } = await userB.client
      .from('coco_conversations')
      .update({ title: 'Stolen', updated_at: '2026-08-22T09:00:00.000Z' })
      .eq('id', conversationId)
      .select('id');
    if (conversationError) throw conversationError;
    expect(conversationMutation).toEqual([]);

    const { data: messageMutation, error: messageError } = await userB.client
      .from('coco_messages')
      .update({ content: 'Stolen', updated_at: '2026-08-22T09:00:00.000Z' })
      .eq('id', messageId)
      .select('id');
    if (messageError) throw messageError;
    expect(messageMutation).toEqual([]);

    const { data: memoryMutation, error: memoryError } = await userB.client
      .from('agent_memory')
      .update({ content: 'Stolen', updated_at: '2026-08-22T09:00:00.000Z' })
      .eq('id', memoryId)
      .select('id');
    if (memoryError) throw memoryError;
    expect(memoryMutation).toEqual([]);
  });

  it('appends expenditure revisions, isolates guidance, and rejects unsafe targets', async () => {
    const at = '2026-08-22T10:00:00.000Z';
    const baseEstimate = {
      user_id: userA.id,
      date: '2026-08-22',
      tdee_kcal: '2200',
      ci_low: '1900',
      ci_high: '2500',
      method: 'blended',
      source: 'expenditure_engine' as const,
      confidence: '0.60',
      completeness: '0.75',
      days_of_data: 21,
      inputs_hash: 'hash-a',
      updated_at: at,
    };
    const first = await appendExpenditureEstimate(userA.client, {
      ...baseEstimate,
      id: randomUUID(),
    });
    const correction = await appendExpenditureEstimate(userA.client, {
      ...baseEstimate,
      id: randomUUID(),
      tdee_kcal: '2250',
      inputs_hash: 'hash-b',
    });
    expect(first.revision).toBe(1);
    expect(correction.revision).toBe(2);
    expect(await listExpenditureEstimates(userB.client, { userId: userA.id })).toEqual(
      [],
    );

    const unsafe = await userA.client.from('targets').insert({
      id: randomUUID(),
      user_id: userA.id,
      effective_from: '2026-08-22',
      kcal: '1',
      protein_g: '1',
      carbs_g: '1',
      fat_g: '1',
      day_type: 'rest',
      source: 'target_engine',
      confidence: '0.60',
      updated_at: at,
    });
    expect(unsafe.error?.code).toBe('23514');

    await insertNutritionTargets(userA.client, [
      {
        id: randomUUID(),
        user_id: userA.id,
        effective_from: '2026-08-22',
        kcal: '1800',
        protein_g: '120',
        carbs_g: '180',
        fat_g: '66',
        day_type: 'rest',
        clamped: false,
        weekly_rate_percent: '0.5',
        clamp_reasons: [],
        source: 'target_engine',
        confidence: '0.60',
        updated_at: at,
      },
    ]);
    expect(
      await listEffectiveNutritionTargets(userB.client, {
        userId: userA.id,
        date: '2026-08-22',
      }),
    ).toEqual([]);
  });

  it.each(['foods', 'servings', 'exercises'] as const)(
    'does not let anon select %s',
    async (table) => {
      const { data, error } = await anon.from(table).select('id').limit(1);
      expect(data === null || data.length === 0).toBe(true);
      expect(error).toBeTruthy();
    },
  );

  it('does not let user A forge server_updated_at', async () => {
    const entryId = randomUUID();
    const loggedAt = '2026-08-16T04:30:00.000Z';
    const forgedCursor = '2099-01-01T00:00:00.000Z';
    const { data, error } = await userA.client
      .from('food_entries')
      .insert({
        id: entryId,
        user_id: userA.id,
        logged_at: loggedAt,
        meal_slot: 'tanghalian',
        food_id: foodId,
        quantity: '1',
        grams: '100',
        kcal: '100',
        protein_g: '1',
        carbs_g: '1',
        fat_g: '1',
        fiber_g: '0',
        sugar_g: '0',
        sodium_mg: '0',
        source: 'ph_core',
        confidence: '0.50',
        input_method: 'search',
        food_name_snapshot: 'RLS fixture food',
        serving_label_snapshot: '100 g',
        resolved_via: 'ph_core',
        updated_at: loggedAt,
        // Compile-time generated types exclude this field. The cast simulates
        // an untrusted REST client attempting to forge the sync cursor.
        server_updated_at: forgedCursor,
      } as never)
      .select('server_updated_at')
      .single();
    if (error) throw error;
    expect(data.server_updated_at).not.toBe(forgedCursor);
  });

  it('assigns unforgeable sequence cursors and returns owner tombstones incrementally', async () => {
    const firstId = randomUUID();
    const secondId = randomUUID();
    const firstAt = '2026-08-16T05:00:00.000Z';
    const secondAt = '2026-08-16T05:01:00.000Z';
    const forgedSeq = 999_999;

    const { data: first, error: firstError } = await userA.client
      .from('tasks')
      .insert({
        id: firstId,
        user_id: userA.id,
        title: 'First sequence fixture',
        updated_at: firstAt,
        server_seq: forgedSeq,
      } as never)
      .select('id, server_seq')
      .single();
    if (firstError) throw firstError;
    expect(first.server_seq).not.toBe(forgedSeq);
    expect(Number.isSafeInteger(first.server_seq)).toBe(true);

    const { data: second, error: secondError } = await userA.client
      .from('tasks')
      .insert({
        id: secondId,
        user_id: userA.id,
        title: 'Second sequence fixture',
        updated_at: secondAt,
        server_seq: 1,
      } as never)
      .select('id, server_seq')
      .single();
    if (secondError) throw secondError;
    expect(second.server_seq).toBeGreaterThan(first.server_seq);

    const { data: otherRows, error: otherError } = await userB.client
      .from('tasks')
      .select('id, server_seq')
      .eq('user_id', userA.id)
      .gt('server_seq', 0)
      .order('server_seq', { ascending: true });
    if (otherError) throw otherError;
    expect(otherRows).toEqual([]);

    const deletedAt = '2026-08-16T05:02:00.000Z';
    const { data: tombstone, error: tombstoneError } = await userA.client
      .from('tasks')
      .update({
        deleted_at: deletedAt,
        updated_at: deletedAt,
        server_seq: 1,
      } as never)
      .eq('id', secondId)
      .select('id, server_seq, deleted_at')
      .single();
    if (tombstoneError) throw tombstoneError;
    expect(tombstone.server_seq).toBeGreaterThan(second.server_seq);
    expect(new Date(tombstone.deleted_at!).toISOString()).toBe(deletedAt);

    const { data: incremental, error: incrementalError } = await userA.client
      .from('tasks')
      .select('id, server_seq, deleted_at')
      .eq('user_id', userA.id)
      .gt('server_seq', second.server_seq)
      .order('server_seq', { ascending: true });
    if (incrementalError) throw incrementalError;
    expect(incremental).toContainEqual(tombstone);

    const { data: staleLive, error: staleLiveError } = await userA.client
      .from('tasks')
      .update({
        deleted_at: null,
        title: 'Stale resurrection attempt',
        updated_at: '2026-08-16T05:03:00.000Z',
      })
      .eq('id', secondId)
      .select('id');
    if (staleLiveError) throw staleLiveError;
    expect(staleLive).toEqual([]);
  });

  it('clamps a raw client updated_at more than five minutes in the future', async () => {
    const entryId = randomUUID();
    const loggedAt = '2026-08-16T04:45:00.000Z';
    const forgedUpdatedAt = '2099-01-01T00:00:00.000Z';
    const beforeWrite = Date.now();
    const { data, error } = await userA.client
      .from('food_entries')
      .insert({
        id: entryId,
        user_id: userA.id,
        logged_at: loggedAt,
        meal_slot: 'tanghalian',
        food_id: foodId,
        quantity: '1',
        grams: '100',
        kcal: '100',
        protein_g: '1',
        carbs_g: '1',
        fat_g: '1',
        fiber_g: '0',
        sugar_g: '0',
        sodium_mg: '0',
        source: 'ph_core',
        confidence: '0.50',
        input_method: 'search',
        food_name_snapshot: 'RLS fixture food',
        serving_label_snapshot: '100 g',
        resolved_via: 'ph_core',
        updated_at: forgedUpdatedAt,
      })
      .select('updated_at')
      .single();
    if (error) throw error;
    const clamped = new Date(data.updated_at).getTime();
    expect(data.updated_at).not.toBe(forgedUpdatedAt);
    expect(clamped).toBeGreaterThanOrEqual(beforeWrite - 60_000);
    expect(clamped).toBeLessThanOrEqual(Date.now() + 60_000);
  });

  it('preserves logical_date until the explicit recompute operation', async () => {
    const entryId = randomUUID();
    const loggedAt = '2026-08-16T00:30:00.000Z';
    const { data: inserted, error: insertError } = await userA.client
      .from('food_entries')
      .insert({
        id: entryId,
        user_id: userA.id,
        logged_at: loggedAt,
        logical_date: '2099-01-01',
        meal_slot: 'almusal',
        food_id: foodId,
        quantity: '1',
        grams: '100',
        kcal: '100',
        protein_g: '1',
        carbs_g: '1',
        fat_g: '1',
        fiber_g: '0',
        sugar_g: '0',
        sodium_mg: '0',
        source: 'ph_core',
        confidence: '0.50',
        input_method: 'search',
        food_name_snapshot: 'RLS fixture food',
        serving_label_snapshot: '100 g',
        resolved_via: 'ph_core',
        updated_at: loggedAt,
      } as never)
      .select('logical_date')
      .single();
    if (insertError) throw insertError;
    expect(inserted.logical_date).toBe('2026-08-16');

    const { error: profileError } = await userA.client
      .from('profiles')
      .update({ day_starts_at: '09:00:00', updated_at: new Date().toISOString() })
      .eq('user_id', userA.id);
    if (profileError) throw profileError;

    const { data: preserved, error: preserveError } = await userA.client
      .from('food_entries')
      .update({
        serving_label_snapshot: 'forged logical date attempt',
        logical_date: '2099-01-01',
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', entryId)
      .select('logical_date')
      .single();
    if (preserveError) throw preserveError;
    expect(preserved.logical_date).toBe('2026-08-16');

    const recomputed = await recomputeLogicalDates(userA.client);
    expect(recomputed.food_entries).toBeGreaterThanOrEqual(1);
    const { data: afterRecompute, error: readError } = await userA.client
      .from('food_entries')
      .select('logical_date')
      .eq('id', entryId)
      .single();
    if (readError) throw readError;
    expect(afterRecompute.logical_date).toBe('2026-08-15');

    const { error: restoreError } = await userA.client
      .from('profiles')
      .update({ day_starts_at: '00:00:00', updated_at: new Date().toISOString() })
      .eq('user_id', userA.id);
    if (restoreError) throw restoreError;
  });

  it('keeps a tombstoned food_entry deleted after an offline/server sync round-trip', async () => {
    const entryId = randomUUID();
    const t1 = '2026-08-16T05:00:00.000Z';
    const t2 = '2026-08-16T06:00:00.000Z';
    const live = {
      id: entryId,
      user_id: userA.id,
      logged_at: t1,
      meal_slot: 'hapunan' as const,
      food_id: foodId,
      quantity: '1',
      grams: '100',
      kcal: '100',
      protein_g: '1',
      carbs_g: '1',
      fat_g: '1',
      fiber_g: '0',
      sugar_g: '0',
      sodium_mg: '0',
      source: 'ph_core' as const,
      confidence: '0.50',
      input_method: 'search' as const,
      food_name_snapshot: 'RLS fixture food',
      serving_label_snapshot: '100 g',
      resolved_via: 'ph_core' as const,
      updated_at: t1,
    };

    await insertFoodEntry(userA.client, live);
    const tombstoned = await upsertFoodEntry(userA.client, {
      ...live,
      deleted_at: t2,
      updated_at: t2,
    });
    expect(tombstoned.applied).toBe(true);
    if (!tombstoned.applied) throw new Error('tombstone sync was not applied');
    expect(tombstoned.row.deleted_at).toBeTruthy();

    const stale = await upsertFoodEntry(userA.client, live);
    expect(stale.applied).toBe(false);
    expect(stale.row?.deleted_at).toBeTruthy();

    const listed = await listFoodEntriesByLogicalDate(userA.client, {
      userId: userA.id,
      logicalDate: '2026-08-16',
    });
    expect(listed.some((row) => row.id === entryId)).toBe(false);

    const { data: raw, error } = await service
      .from('food_entries')
      .select('deleted_at')
      .eq('id', entryId)
      .maybeSingle();
    if (error) throw error;
    expect(raw?.deleted_at).toBeTruthy();
  });

  it('isolates workout plans by owner', async () => {
    const planId = randomUUID();
    const updatedAt = '2026-08-22T08:00:00.000Z';
    const inserted = await upsertWorkoutPlan(userA.client, {
      id: planId,
      user_id: userA.id,
      title: 'Private strength plan',
      description: null,
      active: true,
      updated_at: updatedAt,
      deleted_at: null,
    });
    expect(inserted.applied).toBe(true);
    expect(
      (await listWorkoutPlans(userA.client, userA.id)).some((p) => p.id === planId),
    ).toBe(true);
    expect(await listWorkoutPlans(userB.client, userA.id)).toEqual([]);

    const { data, error } = await userB.client
      .from('workout_plans')
      .update({ title: 'Stolen plan', updated_at: '2026-08-22T09:00:00.000Z' })
      .eq('id', planId)
      .select('id');
    if (error) throw error;
    expect(data).toEqual([]);
  });

  it.each([
    {
      table: 'future_selves' as const,
      ownerPayload: () => ({
        user_id: userA.id,
        statement: 'I consistently keep promises to myself.',
        updated_at: '2026-08-23T06:00:00.000Z',
        deleted_at: null,
      }),
      forgedPayload: () => ({
        user_id: userA.id,
        statement: 'Forged future self',
        updated_at: '2026-08-23T06:00:00.000Z',
        deleted_at: null,
      }),
      ownerMutation: { statement: 'I recover and keep going.' },
    },
    {
      table: 'compasses' as const,
      ownerPayload: () => ({
        user_id: userA.id,
        matters_now: 'Health and faithful work',
        updated_at: '2026-08-23T06:00:00.000Z',
        deleted_at: null,
      }),
      forgedPayload: () => ({
        user_id: userA.id,
        matters_now: 'Forged compass',
        updated_at: '2026-08-23T06:00:00.000Z',
        deleted_at: null,
      }),
      ownerMutation: { matters_now: 'Recovery and faithful work' },
    },
    {
      table: 'inbox_items' as const,
      ownerPayload: () => ({
        id: `00000000-0000-4000-8000-${runId.replaceAll('-', '').slice(0, 12)}`,
        user_id: userA.id,
        kind: 'note',
        content: 'Private inbox note',
        updated_at: '2026-08-23T06:00:00.000Z',
        deleted_at: null,
      }),
      forgedPayload: () => ({
        id: randomUUID(),
        user_id: userA.id,
        kind: 'note',
        content: 'Forged inbox note',
        updated_at: '2026-08-23T06:00:00.000Z',
        deleted_at: null,
      }),
      ownerMutation: { content: 'Updated private inbox note' },
    },
    {
      table: 'personal_rules' as const,
      ownerPayload: () => ({
        id: `10000000-0000-4000-8000-${runId.replaceAll('-', '').slice(0, 12)}`,
        user_id: userA.id,
        title: 'Do the next honest action',
        updated_at: '2026-08-23T06:00:00.000Z',
        deleted_at: null,
      }),
      forgedPayload: () => ({
        id: randomUUID(),
        user_id: userA.id,
        title: 'Forged personal rule',
        updated_at: '2026-08-23T06:00:00.000Z',
        deleted_at: null,
      }),
      ownerMutation: { title: 'Do the next faithful action' },
    },
  ])('enforces owner-only RLS and tombstones for $table', async (fixture) => {
    const inserted = await userA.client
      .from(fixture.table)
      .insert(fixture.ownerPayload() as never)
      .select('*')
      .single();
    if (inserted.error) throw inserted.error;

    const ownerRead = await userA.client
      .from(fixture.table)
      .select('*')
      .eq('user_id', userA.id);
    if (ownerRead.error) throw ownerRead.error;
    expect(ownerRead.data).toHaveLength(1);

    const otherRead = await userB.client
      .from(fixture.table)
      .select('*')
      .eq('user_id', userA.id);
    if (otherRead.error) throw otherRead.error;
    expect(otherRead.data).toEqual([]);

    const forgedInsert = await userB.client
      .from(fixture.table)
      .insert(fixture.forgedPayload() as never);
    expect(forgedInsert.error).toBeTruthy();

    const updatedAt = '2026-08-23T06:01:00.000Z';
    const ownerUpdate = await userA.client
      .from(fixture.table)
      .update({ ...fixture.ownerMutation, updated_at: updatedAt } as never)
      .eq('user_id', userA.id)
      .select('*');
    if (ownerUpdate.error) throw ownerUpdate.error;
    expect(ownerUpdate.data).toHaveLength(1);

    const otherUpdate = await userB.client
      .from(fixture.table)
      .update({ ...fixture.ownerMutation, updated_at: '2026-08-23T06:02:00.000Z' } as never)
      .eq('user_id', userA.id)
      .select('*');
    if (otherUpdate.error) throw otherUpdate.error;
    expect(otherUpdate.data).toEqual([]);

    const otherTombstone = await userB.client
      .from(fixture.table)
      .update({ deleted_at: updatedAt, updated_at: updatedAt } as never)
      .eq('user_id', userA.id)
      .select('*');
    if (otherTombstone.error) throw otherTombstone.error;
    expect(otherTombstone.data).toEqual([]);

    const ownerDelete = await userA.client
      .from(fixture.table)
      .delete()
      .eq('user_id', userA.id);
    expect(ownerDelete.error).toBeTruthy();

    const otherDelete = await userB.client
      .from(fixture.table)
      .delete()
      .eq('user_id', userA.id);
    expect(otherDelete.error).toBeTruthy();

    const anonRead = await anon.from(fixture.table).select('*').eq('user_id', userA.id);
    expect(anonRead.error).toBeTruthy();
    const anonInsert = await anon.from(fixture.table).insert(fixture.forgedPayload() as never);
    expect(anonInsert.error).toBeTruthy();

    const deletedAt = '2026-08-23T06:03:00.000Z';
    const tombstone = await userA.client
      .from(fixture.table)
      .update({ deleted_at: deletedAt, updated_at: deletedAt } as never)
      .eq('user_id', userA.id)
      .select('*');
    if (tombstone.error) throw tombstone.error;
    expect(tombstone.data).toHaveLength(1);
    expect(tombstone.data?.[0]?.deleted_at).toBeTruthy();

    const ownerTombstoneRead = await userA.client
      .from(fixture.table)
      .select('deleted_at')
      .eq('user_id', userA.id);
    if (ownerTombstoneRead.error) throw ownerTombstoneRead.error;
    expect(ownerTombstoneRead.data).toHaveLength(1);
    expect(new Date(ownerTombstoneRead.data?.[0]?.deleted_at ?? '').toISOString()).toBe(deletedAt);

    const otherTombstoneRead = await userB.client
      .from(fixture.table)
      .select('deleted_at')
      .eq('user_id', userA.id);
    if (otherTombstoneRead.error) throw otherTombstoneRead.error;
    expect(otherTombstoneRead.data).toEqual([]);

    const staleResurrection = await userA.client
      .from(fixture.table)
      .update({ deleted_at: null, updated_at: '2026-08-23T06:04:00.000Z' } as never)
      .eq('user_id', userA.id)
      .select('*');
    if (staleResurrection.error) throw staleResurrection.error;
    expect(staleResurrection.data).toEqual([]);
  });

  it('derives workout-set ownership and stores Brzycki only from the source set', async () => {
    const workoutId = randomUUID();
    const setId = randomUUID();
    const at = '2026-08-22T10:00:00.000Z';
    const workout = await insertWorkout(userA.client, {
      id: workoutId,
      user_id: userA.id,
      started_at: at,
      ended_at: null,
      notes: null,
      routine_id: null,
      plan_id: null,
      plan_day_index: null,
      status: 'active',
      is_deload: false,
      updated_at: at,
      deleted_at: null,
    });
    const inserted = await upsertWorkoutSet(userA.client, {
      id: setId,
      user_id: userB.id,
      workout_id: workoutId,
      exercise_id: exerciseId,
      exercise_order: 0,
      exercise_name_snapshot: 'forged name',
      set_index: 0,
      set_type: 'normal',
      superset_group: null,
      weight_kg: '100',
      reps: 5,
      rpe: '8',
      rir: '2',
      is_warmup: false,
      completed_at: at,
      rest_seconds: 120,
      e1rm_epley_kg: '999',
      e1rm_brzycki_kg: '999',
      e1rm_low_confidence: true,
      updated_at: at,
      deleted_at: null,
    });
    expect(inserted.applied).toBe(true);
    if (!inserted.applied) throw new Error('set insert failed');
    expect(inserted.row.user_id).toBe(userA.id);
    expect(inserted.row.exercise_name_snapshot).toBe('RLS fixture squat');
    // PostgREST serialises numeric as a JSON number, so these arrive parsed
    // rather than as the string Drizzle's own numeric type would give back.
    expect(inserted.row.e1rm_epley_kg).toBe(116.6667);
    expect(inserted.row.e1rm_brzycki_kg).toBe(112.5);
    expect(inserted.row.e1rm_low_confidence).toBe(false);
    expect(await listWorkoutSets(userB.client, workoutId)).toEqual([]);

    const unrelated = await upsertWorkoutSet(userA.client, {
      ...inserted.row,
      rpe: '9',
      e1rm_brzycki_kg: '999',
      updated_at: '2026-08-22T10:01:00.000Z',
    });
    expect(unrelated.applied).toBe(true);
    if (!unrelated.applied) throw new Error('set update failed');
    expect(unrelated.row.e1rm_brzycki_kg).toBe(112.5);

    const sourceChanged = await upsertWorkoutSet(userA.client, {
      ...unrelated.row,
      reps: 6,
      updated_at: '2026-08-22T10:02:00.000Z',
    });
    expect(sourceChanged.applied).toBe(true);
    if (!sourceChanged.applied) throw new Error('set source update failed');
    expect(sourceChanged.row.e1rm_brzycki_kg).toBe(116.129);

    const deletedAt = '2026-08-22T10:03:00.000Z';
    await upsertWorkout(userA.client, {
      ...workout,
      deleted_at: deletedAt,
      updated_at: deletedAt,
    });
    const staleRoundTrip = await upsertWorkout(userA.client, {
      ...workout,
      deleted_at: null,
      updated_at: at,
    });
    expect(staleRoundTrip.applied).toBe(false);

    const { data: rawWorkout, error: workoutError } = await service
      .from('workouts')
      .select('deleted_at')
      .eq('id', workoutId)
      .single();
    if (workoutError) throw workoutError;
    const { data: rawSet, error: setError } = await service
      .from('workout_sets')
      .select('deleted_at')
      .eq('id', setId)
      .single();
    if (setError) throw setError;
    expect(rawWorkout.deleted_at).toBeTruthy();
    expect(rawSet.deleted_at).toBeTruthy();
  });

  it('isolates goals and habits and keeps a tombstoned goal deleted', async () => {
    const goalId = randomUUID();
    const habitId = randomUUID();
    const at = '2026-08-22T11:00:00.000Z';
    const goal = await upsertGoal(userA.client, {
      id: goalId,
      user_id: userA.id,
      title: 'Private long-term chapter',
      description: null,
      kind: 'chapter',
      status: 'active',
      starts_on: '2026-08-22',
      target_date: null,
      completed_at: null,
      origin: 'user',
      updated_at: at,
      deleted_at: null,
    });
    expect(goal.applied).toBe(true);
    const habit = await upsertHabit(userA.client, {
      id: habitId,
      user_id: userB.id,
      goal_id: goalId,
      title: 'Private daily action',
      notes: null,
      frequency: 'daily',
      target_per_period: 1,
      active: true,
      origin: 'user',
      updated_at: at,
      deleted_at: null,
    });
    expect(habit.applied).toBe(true);
    if (!habit.applied) throw new Error('habit insert failed');
    expect(habit.row.user_id).toBe(userA.id);

    expect(await listGoals(userB.client, userA.id)).toEqual([]);
    expect(await listActiveHabits(userB.client, userA.id)).toEqual([]);
    const { data: mutation, error: mutationError } = await userB.client
      .from('goals')
      .update({ title: 'Stolen', updated_at: '2026-08-22T11:01:00.000Z' })
      .eq('id', goalId)
      .select('id');
    if (mutationError) throw mutationError;
    expect(mutation).toEqual([]);

    const deletedAt = '2026-08-22T11:02:00.000Z';
    await upsertGoal(userA.client, {
      ...(goal.applied ? goal.row : null),
      id: goalId,
      user_id: userA.id,
      title: 'Private long-term chapter',
      description: null,
      kind: 'chapter',
      status: 'active',
      starts_on: '2026-08-22',
      target_date: null,
      completed_at: null,
      origin: 'user',
      updated_at: deletedAt,
      deleted_at: deletedAt,
    });
    const stale = await upsertGoal(userA.client, {
      id: goalId,
      user_id: userA.id,
      title: 'Stale resurrection',
      description: null,
      kind: 'chapter',
      status: 'active',
      starts_on: '2026-08-22',
      target_date: null,
      completed_at: null,
      origin: 'user',
      updated_at: at,
      deleted_at: null,
    });
    expect(stale.applied).toBe(false);
    expect(await listGoals(userA.client, userA.id)).toEqual([]);
    const { data: rawGoal, error: rawGoalError } = await service
      .from('goals')
      .select('deleted_at')
      .eq('id', goalId)
      .single();
    if (rawGoalError) throw rawGoalError;
    const { data: rawHabit, error: rawHabitError } = await service
      .from('habits')
      .select('deleted_at')
      .eq('id', habitId)
      .single();
    if (rawHabitError) throw rawHabitError;
    expect(rawGoal.deleted_at).toBeTruthy();
    expect(rawHabit.deleted_at).toBeTruthy();
  });

  it('awards a confirmed event once and traces the achievement to its source', async () => {
    const taskId = randomUUID();
    const eventId = randomUUID();
    const duplicateId = randomUUID();
    const at = '2026-08-22T12:00:00.000Z';
    await upsertTask(userA.client, {
      id: taskId,
      user_id: userA.id,
      title: 'Confirmed source action',
      notes: null,
      scheduled_for: '2026-08-22',
      due_at: null,
      completed_at: at,
      sort_order: 0,
      origin: 'user',
      updated_at: at,
      deleted_at: null,
    });
    const eventKey = `task_completed:tasks:${taskId}`;
    const first = await recordCompanionEvent(userA.client, {
      id: eventId,
      user_id: userA.id,
      event_key: eventKey,
      event_type: 'task_completed',
      source_table: 'tasks',
      source_id: taskId,
      logical_date: '2099-01-01',
    });
    const duplicate = await recordCompanionEvent(userA.client, {
      id: duplicateId,
      user_id: userA.id,
      event_key: eventKey,
      event_type: 'task_completed',
      source_table: 'tasks',
      source_id: taskId,
      logical_date: '2099-01-01',
    });
    expect(first.inserted).toBe(true);
    expect(first.row.points).toBe(10);
    expect(first.row.logical_date).toBe('2026-08-22');
    expect(duplicate.inserted).toBe(false);
    expect(duplicate.row.id).toBe(first.row.id);
    expect(await listCompanionEvents(userA.client, userA.id)).toHaveLength(1);
    expect(await listCompanionEvents(userB.client, userA.id)).toEqual([]);
    expect((await getCompanionState(userA.client, userA.id))?.total_points).toBe(10);
    expect(await getCompanionState(userB.client, userA.id)).toBeNull();

    const earned = await listUserAchievements(userA.client, userA.id);
    expect(earned).toHaveLength(1);
    expect(earned[0]?.source_event_id).toBe(first.row.id);

    const { error: unsafeError } = await userA.client.from('companion_events').insert({
      id: randomUUID(),
      user_id: userA.id,
      event_key: `weight_loss:weight_logs:${randomUUID()}`,
      event_type: 'weight_loss',
      source_table: 'weight_logs',
      source_id: randomUUID(),
      logical_date: '2026-08-22',
      points: 9999,
    } as never);
    expect(unsafeError).toBeTruthy();
    expect((await getCompanionState(userA.client, userA.id))?.total_points).toBe(10);
  });

  it('keeps Mus context permissions default-off and owner isolated', async () => {
    expect(await listMusContextPermissions(userA.client, userA.id)).toEqual([]);

    const physicalId = randomUUID();
    const { data: inserted, error: insertError } = await userA.client
      .from('mus_context_permissions')
      .insert({
        id: physicalId,
        user_id: userA.id,
        domain: 'physical_self',
        updated_at: '2026-08-28T01:00:00.000Z',
      })
      .select('*')
      .single();
    if (insertError) throw insertError;
    expect(inserted.allowed).toBe(false);

    const enabled = await setMusContextPermission(userA.client, {
      userId: userA.id,
      domain: 'physical_self',
      allowed: true,
      updatedAt: '2026-08-28T01:01:00.000Z',
    });
    expect(enabled.allowed).toBe(true);
    expect(await listMusContextPermissions(userB.client, userA.id)).toEqual([]);

    const { data: crossUpdate, error: crossUpdateError } = await userB.client
      .from('mus_context_permissions')
      .update({ allowed: false, updated_at: '2026-08-28T01:02:00.000Z' })
      .eq('id', physicalId)
      .select('id');
    if (crossUpdateError) throw crossUpdateError;
    expect(crossUpdate).toEqual([]);

    const { error: forgedInsertError } = await userB.client
      .from('mus_context_permissions')
      .insert({
        id: randomUUID(),
        user_id: userA.id,
        domain: 'memory',
        allowed: true,
        updated_at: '2026-08-28T01:03:00.000Z',
      });
    expect(forgedInsertError).toBeTruthy();

    const { error: invalidDomainError } = await userA.client
      .from('mus_context_permissions')
      .insert({
        id: randomUUID(),
        user_id: userA.id,
        domain: 'journal',
        allowed: true,
        updated_at: '2026-08-28T01:04:00.000Z',
      } as never);
    expect(invalidDomainError).toBeTruthy();

    const { error: ownerDeleteError } = await userA.client
      .from('mus_context_permissions')
      .delete()
      .eq('id', physicalId);
    expect(ownerDeleteError).toBeTruthy();

    const { error: anonSelectError } = await anon
      .from('mus_context_permissions')
      .select('*');
    expect(anonSelectError).toBeTruthy();
    const { error: anonInsertError } = await anon
      .from('mus_context_permissions')
      .insert({
        id: randomUUID(),
        user_id: userA.id,
        domain: 'goals_planning',
        allowed: true,
        updated_at: '2026-08-28T01:04:30.000Z',
      });
    expect(anonInsertError).toBeTruthy();

    const revoked = await setMusContextPermission(userA.client, {
      userId: userA.id,
      domain: 'physical_self',
      allowed: false,
      updatedAt: '2026-08-28T01:05:00.000Z',
    });
    expect(revoked.allowed).toBe(false);
    expect((await listMusContextPermissions(userA.client, userA.id))[0]?.allowed).toBe(false);
  });
});

async function createAuthedUser(
  service: ReturnType<typeof createServiceClient>,
  url: string,
  anonKey: string,
  email: string,
  password: string,
): Promise<Authed> {
  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw created.error ?? new Error('createUser returned no user');
  }
  const client = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.user) {
    throw signedIn.error ?? new Error('signInWithPassword failed');
  }
  return { id: signedIn.data.user.id, email, client };
}
